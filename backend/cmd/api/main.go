package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/indiestack/indiestack/internal/queue"
	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB
var jwtSecret []byte
var jwtRefreshSecret []byte
var queueClient *queue.Client

// --- Rate Limiter ---
type rateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
}

type visitor struct {
	count    int
	lastSeen time.Time
}

var limiter = &rateLimiter{visitors: make(map[string]*visitor)}

func (rl *rateLimiter) allow(ip string, limit int) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	v, exists := rl.visitors[ip]
	if !exists || time.Since(v.lastSeen) > time.Minute {
		rl.visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
		return true
	}
	v.count++
	v.lastSeen = time.Now()
	return v.count <= limit
}

// --- Types ---
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type User struct {
	ID             string    `json:"id"`
	Email          string    `json:"email"`
	Username       string    `json:"username"`
	DisplayName    string    `json:"display_name"`
	Bio            string    `json:"bio"`
	AvatarURL      string    `json:"avatar_url"`
	Website        string    `json:"website"`
	Location       string    `json:"location"`
	IsVerified     bool      `json:"is_verified"`
	IsPremium      bool      `json:"is_premium"`
	FollowerCount  int       `json:"follower_count"`
	FollowingCount int       `json:"following_count"`
	CreatedAt      time.Time `json:"created_at"`
}

type Post struct {
	ID                 string          `json:"id"`
	AuthorID           string          `json:"author_id"`
	AuthorUsername     string          `json:"author_username,omitempty"`
	AuthorName         string          `json:"author_name,omitempty"`
	AuthorAvatar       string          `json:"author_avatar,omitempty"`
	Slug               string          `json:"slug"`
	Title              string          `json:"title"`
	Content            json.RawMessage `json:"content"`
	Excerpt            string          `json:"excerpt"`
	Tags               []string        `json:"tags"`
	CoverImageURL      string          `json:"cover_image_url"`
	ReadingTimeMinutes int             `json:"reading_time_minutes"`
	WordCount          int             `json:"word_count"`
	Status             string          `json:"status"`
	PublishedAt        *time.Time      `json:"published_at"`
	ViewCount          int             `json:"view_count"`
	LikeCount          int             `json:"like_count"`
	CommentCount       int             `json:"comment_count"`
	RepostCount        int             `json:"repost_count"`
	IsPremium          bool            `json:"is_premium"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          *time.Time      `json:"updated_at"`
}

type AuthTokens struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	TokenType    string    `json:"token_type"`
}

type APIKey struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id,omitempty"`
	Name       string     `json:"name"`
	KeyPrefix  string     `json:"key_prefix"`
	Scopes     []string   `json:"scopes"`
	LastUsedAt *time.Time `json:"last_used_at"`
	ExpiresAt  *time.Time `json:"expires_at"`
	IsActive   bool       `json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
}

// Valid API key scopes
var validScopes = map[string]bool{
	"posts:read":    true,
	"posts:write":   true,
	"profile:read":  true,
	"profile:write": true,
	"feed:read":     true,
}

// --- Validation ---
var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func validateEmail(email string) bool {
	return emailRegex.MatchString(email) && len(email) <= 254
}

func validatePassword(password string) bool {
	return len(password) >= 8 && len(password) <= 128
}

func validateUsername(username string) bool {
	if len(username) < 3 || len(username) > 30 {
		return false
	}
	matched, _ := regexp.MatchString(`^[a-zA-Z0-9_]+$`, username)
	return matched
}

// --- Auth Helpers ---
func generateTokens(userID string) (string, string, time.Time, error) {
	accessExpiry := time.Now().Add(24 * time.Hour)
	access := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  userID,
		"exp":  accessExpiry.Unix(),
		"iat":  time.Now().Unix(),
		"type": "access",
	})
	accessToken, err := access.SignedString(jwtSecret)
	if err != nil {
		return "", "", time.Time{}, err
	}
	refresh := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  userID,
		"exp":  time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":  time.Now().Unix(),
		"type": "refresh",
	})
	refreshToken, err := refresh.SignedString(jwtRefreshSecret)
	if err != nil {
		return "", "", time.Time{}, err
	}
	return accessToken, refreshToken, accessExpiry, nil
}

// extractUserID extracts user ID from JWT only (not API keys).
// Used for operations that require JWT auth (e.g., API key management).
func extractUserID(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", fmt.Errorf("missing authorization header")
	}
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenString == authHeader {
		return "", fmt.Errorf("invalid authorization format")
	}
	if strings.HasPrefix(tokenString, "isk_") {
		return "", fmt.Errorf("JWT required, API keys not accepted for this endpoint")
	}
	return parseJWT(tokenString)
}

// extractAuth supports both JWT tokens and API keys (isk_ prefix).
// Returns userID, scopes (["*"] for JWT), and error.
func extractAuth(r *http.Request) (string, []string, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", nil, fmt.Errorf("missing authorization header")
	}
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenString == authHeader {
		return "", nil, fmt.Errorf("invalid authorization format")
	}

	// API key path
	if strings.HasPrefix(tokenString, "isk_") {
		return validateAPIKey(tokenString)
	}

	// JWT path
	userID, err := parseJWT(tokenString)
	if err != nil {
		return "", nil, err
	}
	return userID, []string{"*"}, nil
}

func parseJWT(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return "", fmt.Errorf("invalid token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("invalid claims")
	}
	userID, ok := claims["sub"].(string)
	if !ok {
		return "", fmt.Errorf("invalid user id in token")
	}
	return userID, nil
}

func validateAPIKey(key string) (string, []string, error) {
	prefix := key[:8]
	rows, err := db.Query(
		`SELECT id, user_id, key_hash, scopes, expires_at, is_active FROM api_keys WHERE key_prefix = $1 AND is_active = true`,
		prefix,
	)
	if err != nil {
		return "", nil, fmt.Errorf("invalid api key")
	}
	defer rows.Close()

	for rows.Next() {
		var id, userID, keyHash string
		var scopesRaw string
		var expiresAt *time.Time
		var isActive bool
		if err := rows.Scan(&id, &userID, &keyHash, &scopesRaw, &expiresAt, &isActive); err != nil {
			continue
		}
		if !isActive {
			continue
		}
		if expiresAt != nil && time.Now().After(*expiresAt) {
			continue
		}
		if err := bcrypt.CompareHashAndPassword([]byte(keyHash), []byte(key)); err != nil {
			continue
		}
		// Match found — update last_used_at
		if _, err := db.Exec(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, id); err != nil {

			log.Printf("Failed to update last_used_at for API key %s: %v", id, err)
		}
		scopes := parseScopes(scopesRaw)
		return userID, scopes, nil
	}
	return "", nil, fmt.Errorf("invalid api key")

}

// parseScopes parses PostgreSQL TEXT[] format "{a,b,c}" into a Go slice.
func parseScopes(raw string) []string {
	raw = strings.Trim(raw, "{}")
	if raw == "" {
		return []string{}
	}
	return strings.Split(raw, ",")
}

func hasScope(scopes []string, required string) bool {
	for _, s := range scopes {
		if s == "*" || s == required {
			return true
		}
	}
	return false
}

func generateRandomKey() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "isk_" + hex.EncodeToString(b), nil
}

func jsonError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(Response{Success: false, Error: &APIError{Code: code, Message: message}})
}

func jsonSuccess(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if status != http.StatusOK {
		w.WriteHeader(status)
	}
	json.NewEncoder(w).Encode(Response{Success: true, Data: data})
}

func getClientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return strings.Split(fwd, ",")[0]
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// --- CORS Middleware ---
// corsOrigin is resolved once at startup (see main), not per request.
var corsOrigin string

// resolveCORSOrigin determines the allowed origin once and logs any warning a
// single time, instead of spamming a warning on every API request.
func resolveCORSOrigin() string {
	origin := os.Getenv("ALLOWED_ORIGINS")
	if origin == "" {
		if os.Getenv("APP_ENV") == "production" {
			origin = "https://indiestack.io"
			log.Println("WARNING: ALLOWED_ORIGINS not set in production; defaulting to https://indiestack.io")
		} else {
			origin = "*"
		}
	}
	return origin
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := corsOrigin
		if origin == "" {
			origin = resolveCORSOrigin() // fallback if main() didn't set it (e.g. tests)
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Main ---
func main() {
	// JWT Secret from env (required in production)

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		if os.Getenv("APP_ENV") == "production" {
			log.Fatal("JWT_SECRET environment variable is required in production")
		}
		secret = "dev-only-fallback-secret-min-32-bytes"
		log.Println("WARNING: Using fallback JWT secret — set JWT_SECRET for production")

	}
	jwtSecret = []byte(secret)

	refreshSecret := os.Getenv("JWT_REFRESH_SECRET")
	if refreshSecret == "" {
		if os.Getenv("APP_ENV") == "production" {
			log.Fatal("JWT_REFRESH_SECRET environment variable is required in production")
		}
		refreshSecret = secret + "-refresh"
		log.Println("WARNING: Using fallback JWT refresh secret — set JWT_REFRESH_SECRET for production")
	}
	jwtRefreshSecret = []byte(refreshSecret)

	// Database
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://indiestack:indiestack_secret@postgres:5432/indiestack?sslmode=disable"
	}
	var err error
	for i := 0; i < 5; i++ {
		db, err = sql.Open("pgx", databaseURL)
		if err == nil {
			err = db.Ping()
		}
		if err == nil {
			break
		}
		log.Printf("Database connection attempt %d failed: %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("Failed to connect to database after retries: %v", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	log.Println("Connected to database")

	// Initialize queue client for publishing worker events
	queueClient = queue.NewClient()

	// Routes
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/ready", readyHandler)
	mux.HandleFunc("/api/v1/health", healthHandler)
	mux.HandleFunc("/api/v1/ready", readyHandler)
	mux.HandleFunc("/api/v1/auth/register", registerHandler)
	mux.HandleFunc("/api/v1/auth/login", loginHandler)
	mux.HandleFunc("/api/v1/auth/me", meHandler)
	mux.HandleFunc("/api/v1/auth/refresh", refreshHandler)
	mux.HandleFunc("/api/v1/auth/logout", logoutHandler)
	mux.HandleFunc("/api/v1/users/", usersHandler)
	mux.HandleFunc("/api/v1/posts/", postsHandler)
	mux.HandleFunc("/api/v1/feed", feedHandler)
	mux.HandleFunc("/api/v1/feed/latest", latestFeedHandler)
	mux.HandleFunc("/api/v1/feed/trending", trendingFeedHandler)
	mux.HandleFunc("/api/v1/feed/by-tag", byTagFeedHandler)
	mux.HandleFunc("/api/v1/feed/trending-posts", trendingPostsHandler)
	mux.HandleFunc("/api/v1/feed/trending-topics", trendingTopicsHandler)
	mux.HandleFunc("/api/v1/feed/following-topics", followingTopicsFeedHandler)
	mux.HandleFunc("/api/v1/topics/follow", topicFollowHandler)
	mux.HandleFunc("/api/v1/topics/following", followedTopicsHandler)
	mux.HandleFunc("/api/v1/tags", tagsHandler)
	mux.HandleFunc("/api/v1/api-keys", apiKeysHandler)
	mux.HandleFunc("/api/v1/api-keys/", apiKeysHandler)
	mux.HandleFunc("/api/v1/posts/mine", listMyPostsHandler)
	mux.HandleFunc("/api/v1/upload", uploadHandler)

	// SEO endpoints (RSS, sitemap, robots.txt) — routed to the backend via Caddy.
	mux.HandleFunc("/rss", rssHandler)
	mux.HandleFunc("/rss/", rssHandler)
	mux.HandleFunc("/sitemap.xml", sitemapHandler)
	mux.HandleFunc("/robots.txt", robotsHandler)

	// Serve uploaded files (images) from the upload directory.
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadDir))))

	registerPenmarkRoutes(mux)
	registerSettingsRoutes(mux)

	// JSON 404 for any unmatched /api/v1/* route, so API error responses are
	// consistent (instead of Go's default plain-text "404 page not found").
	mux.HandleFunc("/api/v1/", func(w http.ResponseWriter, r *http.Request) {
		jsonError(w, http.StatusNotFound, "NOT_FOUND", "Not found")
	})

	// Resolve the CORS origin once at startup (logs the production warning a
	// single time instead of on every request).
	corsOrigin = resolveCORSOrigin()

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "3001"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      corsMiddleware(mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Printf("IndieStack API server running on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced shutdown: %v", err)
	}
	if queueClient != nil {
		queueClient.Close()
	}
	log.Println("Server stopped")
}

// --- Handlers ---

func healthHandler(w http.ResponseWriter, r *http.Request) {
	jsonSuccess(w, http.StatusOK, map[string]string{"status": "healthy"})
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	if err := db.Ping(); err != nil {
		jsonError(w, http.StatusServiceUnavailable, "NOT_READY", "Database not available")
		return
	}
	jsonSuccess(w, http.StatusOK, map[string]string{"status": "ready"})
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	ip := getClientIP(r)
	if !limiter.allow(ip, 10) {
		jsonError(w, http.StatusTooManyRequests, "RATE_LIMITED", "Too many requests, try again later")
		return
	}

	var req struct {
		Email       string `json:"email"`
		Username    string `json:"username"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
		return
	}

	// Validation
	if !validateEmail(req.Email) {
		jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid email format")
		return
	}
	if !validateUsername(req.Username) {
		jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Username must be 3-30 characters, alphanumeric and underscores only")
		return
	}
	if !validatePassword(req.Password) {
		jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Password must be 8-128 characters")
		return
	}
	if len(req.DisplayName) == 0 || len(req.DisplayName) > 100 {

		jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Display name must be 1-100 characters")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to process registration")
		return
	}

	userID := uuid.New().String()
	tx, err := db.Begin()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to process registration")
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(
		`INSERT INTO users (id, email, username, password_hash, display_name, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
		userID, req.Email, req.Username, string(hashedPassword), req.DisplayName,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			jsonError(w, http.StatusConflict, "CONFLICT", "Email or username already exists")
		} else {
			log.Printf("Register error: %v", err)
			jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create user")
		}
		return
	}

	if err := tx.Commit(); err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to complete registration")
		return
	}

	user := User{ID: userID, Email: req.Email, Username: req.Username, DisplayName: req.DisplayName, CreatedAt: time.Now()}
	accessToken, refreshToken, expiresAt, err := generateTokens(userID)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to generate tokens")
		return
	}

	jsonSuccess(w, http.StatusCreated, map[string]interface{}{
		"user":   user,
		"tokens": AuthTokens{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresAt: expiresAt, TokenType: "Bearer"},
	})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	ip := getClientIP(r)
	if !limiter.allow(ip, 5) {
		jsonError(w, http.StatusTooManyRequests, "RATE_LIMITED", "Too many login attempts, try again later")
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Email and password required")
		return
	}

	var user User
	var passwordHash string
	err := db.QueryRow(
		`SELECT id, email, username, display_name, password_hash, bio, avatar_url, is_verified, is_premium,
		 follower_count, following_count, created_at FROM users WHERE email = $1`,
		req.Email,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &passwordHash, &user.Bio, &user.AvatarURL,
		&user.IsVerified, &user.IsPremium, &user.FollowerCount, &user.FollowingCount, &user.CreatedAt)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid email or password")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid email or password")
		return
	}

	accessToken, refreshToken, expiresAt, err := generateTokens(user.ID)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to generate tokens")
		return
	}

	// Record this login as an active session (powers the security page's
	// session list, connected devices, and logout-from-all-devices).
	createSession(user.ID, refreshToken, r)

	jsonSuccess(w, http.StatusOK, map[string]interface{}{
		"user":   user,
		"tokens": AuthTokens{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresAt: expiresAt, TokenType: "Bearer"},
	})
}

// createSession inserts a session row for a freshly-issued refresh token.
// The refresh token's SHA-256 hash is stored (never the raw token) as the
// unique refresh_token_id so a session can be revoked without exposing tokens.
func createSession(userID, refreshToken string, r *http.Request) {
	sum := sha256.Sum256([]byte(refreshToken))
	tokenID := hex.EncodeToString(sum[:])
	ua := r.UserAgent()
	ip := getClientIP(r)
	device := deviceFromUA(ua)
	if _, err := db.Exec(`INSERT INTO sessions (user_id, refresh_token_id, user_agent, ip, device)
		VALUES ($1::uuid, $2, $3, $4, $5) ON CONFLICT (refresh_token_id) DO UPDATE SET last_used_at = NOW()`,
		userID, tokenID, ua, ip, device); err != nil {
		log.Printf("create session error: %v", err)
	}
}

// deviceFromUA makes a rough human-readable device label from the User-Agent.
func deviceFromUA(ua string) string {
	l := strings.ToLower(ua)
	switch {
	case strings.Contains(l, "iphone"), strings.Contains(l, "android"):
		return "Mobile"
	case strings.Contains(l, "ipad"), strings.Contains(l, "tablet"):
		return "Tablet"
	case strings.Contains(l, "windows"):
		return "Windows PC"
	case strings.Contains(l, "mac os"), strings.Contains(l, "macintosh"):
		return "Mac"
	case strings.Contains(l, "linux"):
		return "Linux"
	case ua == "":
		return "Unknown device"
	default:
		return "Desktop"
	}
}

func meHandler(w http.ResponseWriter, r *http.Request) {
	userID, scopes, err := extractAuth(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", err.Error())
		return
	}
	if !hasScope(scopes, "profile:read") {
		jsonError(w, http.StatusForbidden, "FORBIDDEN", "Insufficient scope: profile:read required")
		return
	}

	var user User
	err = db.QueryRow(
		`SELECT id, email, username, display_name, bio, avatar_url, website, location,
		 is_verified, is_premium, follower_count, following_count, created_at
		 FROM users WHERE id::text = $1`, userID,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.Bio, &user.AvatarURL,
		&user.Website, &user.Location, &user.IsVerified, &user.IsPremium, &user.FollowerCount,
		&user.FollowingCount, &user.CreatedAt)
	if err != nil {
		jsonError(w, http.StatusNotFound, "NOT_FOUND", "User not found")
		return
	}
	jsonSuccess(w, http.StatusOK, user)
}

func refreshHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request")
		return
	}
	token, err := jwt.Parse(req.RefreshToken, func(token *jwt.Token) (interface{}, error) {

		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return jwtRefreshSecret, nil
	})
	if err != nil || !token.Valid {
		jsonError(w, http.StatusUnauthorized, "INVALID_TOKEN", "Invalid refresh token")
		return
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		jsonError(w, http.StatusUnauthorized, "INVALID_TOKEN", "Invalid token claims")
		return
	}
	tokenType, _ := claims["type"].(string)
	if tokenType != "refresh" {
		jsonError(w, http.StatusUnauthorized, "INVALID_TOKEN", "Not a refresh token")
		return
	}
	userID, _ := claims["sub"].(string)
	accessToken, refreshToken, expiresAt, err := generateTokens(userID)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to generate tokens")
		return
	}
	jsonSuccess(w, http.StatusOK, AuthTokens{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresAt: expiresAt, TokenType: "Bearer"})
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	jsonSuccess(w, http.StatusOK, map[string]string{"message": "Logged out"})
}

func usersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodOptions && r.Method != http.MethodHead {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Only GET is supported for user profiles")
		return
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/v1/users/")

	parts := strings.Split(path, "/")
	username := parts[0]

	if username == "" {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Username required")
		return
	}

	// Handle /users/:username/posts
	if len(parts) >= 2 && parts[1] == "posts" {
		userPostsHandler(w, r, username)
		return
	}

	// Handle /users/:username/followers and /users/:username/following
	if len(parts) >= 2 && parts[1] == "followers" {
		userFollowListHandler(w, r, username, "followers")
		return
	}
	if len(parts) >= 2 && parts[1] == "following" {
		userFollowListHandler(w, r, username, "following")
		return
	}

	var user User
	// LEFT JOIN profiles and prefer its non-empty values (COALESCE + NULLIF) so the
	// public profile reflects edits saved via the profiles endpoint (which writes
	// to the profiles table, not users).
	err := db.QueryRow(
		`SELECT u.id, u.email, u.username,
			COALESCE(NULLIF(p.name, ''), u.display_name),
			COALESCE(NULLIF(p.bio, ''), u.bio),
			u.avatar_url,
			COALESCE(NULLIF(p.website, ''), u.website),
			COALESCE(NULLIF(p.location, ''), u.location),
			u.is_verified, u.is_premium, u.follower_count, u.following_count, u.created_at
		 FROM users u
		 LEFT JOIN profiles p ON p.user_id = u.id
		 WHERE u.username = $1`, username,
	).Scan(&user.ID, &user.Email, &user.Username, &user.DisplayName, &user.Bio, &user.AvatarURL,
		&user.Website, &user.Location, &user.IsVerified, &user.IsPremium, &user.FollowerCount,
		&user.FollowingCount, &user.CreatedAt)
	if err != nil {
		jsonError(w, http.StatusNotFound, "NOT_FOUND", "User not found")
		return
	}
	jsonSuccess(w, http.StatusOK, user)
}

func userPostsHandler(w http.ResponseWriter, r *http.Request, username string) {
	rows, err := db.Query(`
		SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
		 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
		 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
		 FROM posts p JOIN users u ON p.author_id = u.id
		 WHERE u.username = $1 AND p.status = 'published'
		 ORDER BY p.published_at DESC NULLS LAST
		 LIMIT 50`, username)
	if err != nil {
		jsonSuccess(w, http.StatusOK, []Post{})
		return
	}
	defer rows.Close()
	posts := scanFeedPosts(rows)
	jsonSuccess(w, http.StatusOK, posts)
}

// FollowListUser is a compact user representation for follower/following lists.
type FollowListUser struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	Bio         string `json:"bio"`
}

// userFollowListHandler returns the list of users who follow `username`
// (kind="followers") or whom `username` follows (kind="following").
func userFollowListHandler(w http.ResponseWriter, r *http.Request, username, kind string) {
	var userID string
	if err := db.QueryRow(`SELECT id FROM users WHERE username = $1`, username).Scan(&userID); err != nil {
		jsonError(w, http.StatusNotFound, "NOT_FOUND", "User not found")
		return
	}

	var query string
	if kind == "followers" {
		// People who follow this user: follows.following_id = userID, return follower.
		query = `SELECT u.id, u.username, u.display_name, u.avatar_url, COALESCE(u.bio, '')
			 FROM follows f JOIN users u ON u.id = f.follower_id
			 WHERE f.following_id = $1 ORDER BY f.created_at DESC LIMIT 200`
	} else {
		// People this user follows: follows.follower_id = userID, return following.
		query = `SELECT u.id, u.username, u.display_name, u.avatar_url, COALESCE(u.bio, '')
			 FROM follows f JOIN users u ON u.id = f.following_id
			 WHERE f.follower_id = $1 ORDER BY f.created_at DESC LIMIT 200`
	}

	rows, err := db.Query(query, userID)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	defer rows.Close()
	users := []FollowListUser{}
	for rows.Next() {
		var u FollowListUser
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.AvatarURL, &u.Bio); err != nil {
			continue
		}
		users = append(users, u)
	}
	jsonSuccess(w, http.StatusOK, users)
}

func postsHandler(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/posts/")

	if strings.HasPrefix(path, "slug/") {
		parts := strings.Split(strings.TrimPrefix(path, "slug/"), "/")
		if len(parts) >= 2 {
			getPostBySlug(w, r, parts[0], parts[1])
			return
		}
	}

	// GET /api/v1/posts/{id}/related — related posts (tags-first, then full-text)
	if r.Method == http.MethodGet && strings.HasSuffix(path, "/related") {
		postID := strings.TrimSuffix(path, "/related")
		postID = strings.Trim(postID, "/")
		if postID != "" && !strings.Contains(postID, "/") {
			relatedPostsHandler(w, r, postID)
			return
		}
	}

	// GET /api/v1/posts/{id} — fetch a single post by ID (any status). Used by the
	// editor to load an existing draft/post for editing. Ownership not required for
	// published posts; drafts/archived are restricted to their author.
	if r.Method == http.MethodGet && path != "" && !strings.Contains(path, "/") && path != "mine" {
		getPostByIDHandler(w, r, path)
		return
	}

	// PUT /api/v1/posts/{id} — update post
	if r.Method == http.MethodPut && path != "" && !strings.Contains(path, "/") {
		updatePostHandler(w, r, path)
		return
	}

	// DELETE /api/v1/posts/{id} — archive post
	if r.Method == http.MethodDelete && path != "" && !strings.Contains(path, "/") {
		deletePostHandler(w, r, path)
		return
	}

	if r.Method == http.MethodPost {
		createPost(w, r)
		return
	}

	jsonError(w, http.StatusNotFound, "NOT_FOUND", "Not found")
}

func getPostBySlug(w http.ResponseWriter, r *http.Request, username, slug string) {
	var post Post
	var authorName, authorAvatar string
	var tagsJSON []byte
	err := db.QueryRow(`
		SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
		 p.slug, p.title, p.content, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
		 p.word_count, p.status, p.published_at, p.view_count, p.like_count, p.comment_count,
		 p.is_premium, p.created_at, p.repost_count, p.updated_at
		 FROM posts p JOIN users u ON p.author_id = u.id
		 WHERE u.username = $1 AND p.slug = $2 AND p.status = 'published'`,
		username, slug,
	).Scan(&post.ID, &post.AuthorID, &post.AuthorUsername, &authorName, &authorAvatar,
		&post.Slug, &post.Title, &post.Content, &post.Excerpt, &tagsJSON, &post.CoverImageURL,
		&post.ReadingTimeMinutes, &post.WordCount, &post.Status, &post.PublishedAt,
		&post.ViewCount, &post.LikeCount, &post.CommentCount, &post.IsPremium, &post.CreatedAt,
		&post.RepostCount, &post.UpdatedAt)
	if err != nil {
		jsonError(w, http.StatusNotFound, "NOT_FOUND", "Post not found")
		return
	}
	if len(tagsJSON) > 0 {
		_ = json.Unmarshal(tagsJSON, &post.Tags)
	}
	if post.Tags == nil {
		post.Tags = []string{}
	}
	post.AuthorName = authorName
	post.AuthorAvatar = authorAvatar

	// Log this view for the trending system (one view per reader per post per hour,
	// to avoid inflated numbers). userID may be empty for anonymous readers.
	viewerID, _ := extractUserID(r)
	logPostView(post.ID, viewerID)

	jsonSuccess(w, http.StatusOK, post)
}

// getPostByIDHandler returns a single post by ID, including drafts and archived
// posts. Drafts/archived posts are only visible to their author (so the editor can
// load them); published posts are visible to anyone. Does NOT log a view (this is
// an editor/lookup fetch, not a public read).
func getPostByIDHandler(w http.ResponseWriter, r *http.Request, postID string) {
	var post Post
	var authorName, authorAvatar string
	var tagsJSON []byte
	err := db.QueryRow(`
		SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
		 p.slug, p.title, p.content, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
		 p.word_count, p.status, p.published_at, p.view_count, p.like_count, p.comment_count,
		 p.is_premium, p.created_at, p.repost_count, p.updated_at
		 FROM posts p JOIN users u ON p.author_id = u.id
		 WHERE p.id = $1`,
		postID,
	).Scan(&post.ID, &post.AuthorID, &post.AuthorUsername, &authorName, &authorAvatar,
		&post.Slug, &post.Title, &post.Content, &post.Excerpt, &tagsJSON, &post.CoverImageURL,
		&post.ReadingTimeMinutes, &post.WordCount, &post.Status, &post.PublishedAt,
		&post.ViewCount, &post.LikeCount, &post.CommentCount, &post.IsPremium, &post.CreatedAt,
		&post.RepostCount, &post.UpdatedAt)
	if err != nil {
		jsonError(w, http.StatusNotFound, "NOT_FOUND", "Post not found")
		return
	}
	// Non-published posts are only visible to their author.
	if post.Status != "published" {
		viewerID, verr := extractUserID(r)
		if verr != nil || viewerID != post.AuthorID {
			jsonError(w, http.StatusNotFound, "NOT_FOUND", "Post not found")
			return
		}
	}
	if len(tagsJSON) > 0 {
		_ = json.Unmarshal(tagsJSON, &post.Tags)
	}
	if post.Tags == nil {
		post.Tags = []string{}
	}
	post.AuthorName = authorName
	post.AuthorAvatar = authorAvatar
	jsonSuccess(w, http.StatusOK, post)
}

// logPostView records a post view in post_views, guarding against inflated
// counts: it only inserts if this reader (or an anonymous reader) hasn't viewed
// the same post within the last hour.
func logPostView(postID, userID string) {
	var uid interface{}
	if userID == "" {
		uid = nil // anonymous
	} else {
		uid = userID
	}
	_, err := db.Exec(`
		INSERT INTO post_views (post_id, user_id, viewed_at)
		SELECT $1::uuid, $2, now()
		WHERE NOT EXISTS (
		  SELECT 1 FROM post_views
		  WHERE post_id = $1::uuid
		    AND (($2::uuid IS NOT NULL AND user_id = $2::uuid) OR ($2::uuid IS NULL AND user_id IS NULL))
		    AND viewed_at > now() - interval '1 hour'
		)`, postID, uid)
	if err != nil {
		log.Printf("log post view error: %v", err)
	}
}

// excerptMaxLen is the target length for an auto-generated excerpt.
const excerptMaxLen = 160

// extractTextFromTipTap walks a TipTap/ProseMirror JSON document and returns
// its visible text content, concatenated with single spaces between blocks.
// It ignores marks, images, and other non-text nodes.
func extractTextFromTipTap(node map[string]interface{}) string {
	var sb strings.Builder
	var walk func(n map[string]interface{})
	walk = func(n map[string]interface{}) {
		if n == nil {
			return
		}
		// Text node: append its text.
		if t, ok := n["type"].(string); ok && t == "text" {
			if txt, ok := n["text"].(string); ok {
				s := strings.TrimSpace(txt)
				if s != "" {
					if sb.Len() > 0 {
						sb.WriteString(" ")
					}
					sb.WriteString(s)
				}
			}
		}
		// Recurse into children.
		if children, ok := n["content"].([]interface{}); ok {
			for _, c := range children {
				if cm, ok := c.(map[string]interface{}); ok {
					walk(cm)
				}
			}
		}
	}
	walk(node)
	return strings.Join(strings.Fields(sb.String()), " ")
}

// autoExcerpt builds a plain-text excerpt from a TipTap document, truncated to
// excerptMaxLen characters (on a word boundary) with an ellipsis when truncated.
func autoExcerpt(content map[string]interface{}) string {
	text := extractTextFromTipTap(content)
	runes := []rune(text)
	if len(runes) <= excerptMaxLen {
		return text
	}
	// Cut on a word boundary at or before excerptMaxLen.
	cut := string(runes[:excerptMaxLen])
	if idx := strings.LastIndex(cut, " "); idx > 0 {
		cut = cut[:idx]
	}
	return strings.TrimRight(cut, " ") + "..."
}

func createPost(w http.ResponseWriter, r *http.Request) {
	userID, scopes, err := extractAuth(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}
	if !hasScope(scopes, "posts:write") {
		jsonError(w, http.StatusForbidden, "FORBIDDEN", "Insufficient scope: posts:write required")
		return
	}

	var req struct {
		Title         string                 `json:"title"`
		Content       map[string]interface{} `json:"content"`
		Excerpt       string                 `json:"excerpt"`
		Tags          []string               `json:"tags"`
		CoverImageURL string                 `json:"cover_image_url"`
		IsPremium     bool                   `json:"is_premium"`
		Slug          string                 `json:"slug"`
		Status        string                 `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
		return
	}
	if len(req.Title) == 0 || len(req.Title) > 300 {
		jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Title must be 1-300 characters")
		return
	}

	postID := uuid.New().String()
	slug := req.Slug
	if slug == "" {
		slug = strings.ToLower(strings.ReplaceAll(req.Title, " ", "-"))
	}
	status := req.Status
	if status == "" {
		status = "draft"
	}

	contentJSON, _ := json.Marshal(req.Content)
	// Count words in the extracted plain-text body (not the serialized JSON, which
	// inflates the count with markup keys) for an accurate reading time.
	wordCount := len(strings.Fields(extractTextFromTipTap(req.Content)))
	readingTime := wordCount/200 + 1

	// Use the author-supplied excerpt if present; otherwise auto-generate one
	// from the post body so the feed preview reflects the actual content.
	excerpt := strings.TrimSpace(req.Excerpt)
	if excerpt == "" {
		excerpt = autoExcerpt(req.Content)
	}

	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}
	tagsJSON, _ := json.Marshal(tags)

	publishedAt := "NOW()"
	if status != "published" {
		publishedAt = "NULL"
	}

	tx, err := db.Begin()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create post")
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO posts (id, author_id, slug, title, content, excerpt, tags, cover_image_url,
		reading_time_minutes, word_count, status, published_at, is_premium, created_at, updated_at)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, `+publishedAt+`, $12, NOW(), NOW())`,
		postID, userID, slug, req.Title, contentJSON, excerpt, tagsJSON, req.CoverImageURL,
		readingTime, wordCount, status, req.IsPremium,
	)
	if err != nil {
		log.Printf("Create post error: %v", err)
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create post")
		return
	}
	if err := tx.Commit(); err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to save post")
		return
	}

	if status == "published" {
		queueClient.PublishFeedUpdate(queue.FeedEvent{
			Type:        "post_published",
			PostID:      postID,
			AuthorID:    userID,
			PublishedAt: time.Now().UTC().Format(time.RFC3339),
		})
	}

	jsonSuccess(w, http.StatusCreated, Post{
		ID: postID, AuthorID: userID, Slug: slug, Title: req.Title,
		Content: contentJSON, Excerpt: excerpt, Tags: tags, CoverImageURL: req.CoverImageURL,
		ReadingTimeMinutes: readingTime, WordCount: wordCount, Status: status,
		IsPremium: req.IsPremium, CreatedAt: time.Now(),
	})
}

func scanFeedPosts(rows *sql.Rows) []Post {
	var posts []Post
	for rows.Next() {
		var post Post
		var tagsJSON []byte
		if err := rows.Scan(&post.ID, &post.AuthorID, &post.AuthorUsername, &post.AuthorName, &post.AuthorAvatar,
			&post.Slug, &post.Title, &post.Excerpt, &tagsJSON, &post.CoverImageURL, &post.ReadingTimeMinutes,
			&post.PublishedAt, &post.ViewCount, &post.LikeCount, &post.IsPremium, &post.Status, &post.CreatedAt); err != nil {
			log.Printf("Scan feed post error: %v", err)
			continue
		}
		if len(tagsJSON) > 0 {
			_ = json.Unmarshal(tagsJSON, &post.Tags)
		}
		if post.Tags == nil {
			post.Tags = []string{}
		}
		posts = append(posts, post)
	}
	if err := rows.Err(); err != nil {
		log.Printf("Feed rows error: %v", err)
	}
	if posts == nil {
		posts = []Post{}
	}
	return posts
}

func feedHandler(w http.ResponseWriter, r *http.Request) {
	// Personalized feed placeholder: currently returns the latest published posts.
	// A full personalized feed (Redis pull + push) is outside Modules 2/3/8 scope.
	latestFeedHandler(w, r)
}

func latestFeedHandler(w http.ResponseWriter, r *http.Request) {
	// Filter out posts from muted authors if user is authenticated
	userID, _ := extractUserID(r)
	var mutedIDs []string

	if userID != "" {
		rows, err := db.Query("SELECT muted_user_id::text FROM mutes WHERE user_id = $1", userID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var mutedID string
				if err := rows.Scan(&mutedID); err == nil {
					mutedIDs = append(mutedIDs, mutedID)
				}
			}
		}
	}

	var baseQuery string
	if len(mutedIDs) > 0 {
		baseQuery = `
			SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
			 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
			 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
			 FROM posts p JOIN users u ON p.author_id = u.id
			 WHERE p.status = 'published' AND u.id != ANY($1::uuid[])
			 ORDER BY p.published_at DESC NULLS LAST
			 LIMIT 20`
		rows, err := db.Query(baseQuery, mutedIDs)
		if err != nil {
			jsonSuccess(w, http.StatusOK, []Post{})
			return
		}
		defer rows.Close()
		jsonSuccess(w, http.StatusOK, scanFeedPosts(rows))
	} else {
		rows, err := db.Query(`
			SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
			 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
			 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
			 FROM posts p JOIN users u ON p.author_id = u.id
			 WHERE p.status = 'published'
			 ORDER BY p.published_at DESC NULLS LAST
			 LIMIT 20`)
		if err != nil {
			jsonSuccess(w, http.StatusOK, []Post{})
			return
		}
		defer rows.Close()
		jsonSuccess(w, http.StatusOK, scanFeedPosts(rows))
	}
}

func trendingFeedHandler(w http.ResponseWriter, r *http.Request) {
	// Filter out posts from muted authors if user is authenticated
	userID, _ := extractUserID(r)
	var mutedIDs []string

	if userID != "" {
		rows, err := db.Query("SELECT muted_user_id::text FROM mutes WHERE user_id = $1", userID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var mutedID string
				if err := rows.Scan(&mutedID); err == nil {
					mutedIDs = append(mutedIDs, mutedID)
				}
			}
		}
	}

	var baseQuery string
	if len(mutedIDs) > 0 {
		baseQuery = `
			SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
			 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
			 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
			 FROM posts p JOIN users u ON p.author_id = u.id
			 WHERE p.status = 'published' AND u.id != ALL($1::uuid[])
			 ORDER BY (p.like_count + p.comment_count * 2 + p.repost_count * 3) DESC NULLS FIRST, p.published_at DESC NULLS LAST
			 LIMIT 50`
		rows, err := db.Query(baseQuery, mutedIDs)
		if err != nil {
			jsonSuccess(w, http.StatusOK, []Post{})
			return
		}
		defer rows.Close()
		jsonSuccess(w, http.StatusOK, scanFeedPosts(rows))
	} else {
		rows, err := db.Query(`
			SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
			 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
			 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
			 FROM posts p JOIN users u ON p.author_id = u.id
			 WHERE p.status = 'published'
			 ORDER BY (p.like_count + p.comment_count * 2 + p.repost_count * 3) DESC NULLS FIRST, p.published_at DESC NULLS LAST
			 LIMIT 50`)
		if err != nil {
			jsonSuccess(w, http.StatusOK, []Post{})
			return
		}
		defer rows.Close()
		jsonSuccess(w, http.StatusOK, scanFeedPosts(rows))
	}
}

// byTagFeedHandler returns published posts that have a given tag (topic).
// Usage: GET /api/v1/feed/by-tag?tag=Technology
func byTagFeedHandler(w http.ResponseWriter, r *http.Request) {
	tag := strings.TrimSpace(r.URL.Query().Get("tag"))
	if tag == "" {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "tag query param required")
		return
	}
	// tags is a JSONB array of strings; use @> containment (case-insensitive match
	// by lower-casing both sides via a LOWER() cast comparison).
	rows, err := db.Query(`
		SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
		 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
		 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
		 FROM posts p JOIN users u ON p.author_id = u.id
		 WHERE p.status = 'published'
		   AND EXISTS (
		     SELECT 1 FROM jsonb_array_elements_text(p.tags) t
		     WHERE LOWER(t) = LOWER($1)
		   )
		 ORDER BY (p.like_count + p.comment_count * 2 + p.repost_count * 3) DESC NULLS FIRST, p.published_at DESC NULLS LAST
		 LIMIT 50`, tag)
	if err != nil {
		log.Printf("by-tag feed error: %v", err)
		jsonSuccess(w, http.StatusOK, []Post{})
		return
	}
	defer rows.Close()
	jsonSuccess(w, http.StatusOK, scanFeedPosts(rows))
}

// relatedPostsHandler returns posts related to the given post. Ranking:
//  1. number of shared tags (strongest signal)
//  2. tsvector full-text similarity (ts_rank) of the source post's title + tags
//     queried against each candidate's full search_vector
//
// The current post and non-published posts are excluded.
func relatedPostsHandler(w http.ResponseWriter, r *http.Request, postID string) {
	rows, err := db.Query(`
		WITH src AS (
		  SELECT p.tags,
		    (p.title || ' ' || coalesce((SELECT string_agg(value, ' ')
		      FROM jsonb_array_elements_text(p.tags)), '')) AS query_text
		  FROM posts p WHERE p.id::text = $1 AND p.status = 'published'
		)
		SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
		 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
		 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
		 FROM posts p
		 JOIN users u ON p.author_id = u.id
		 CROSS JOIN src
		 WHERE p.status = 'published' AND p.id::text <> $1
		 ORDER BY
		   (SELECT COUNT(*) FROM jsonb_array_elements_text(p.tags) t
		    WHERE t IN (SELECT value FROM jsonb_array_elements_text(src.tags))) DESC,
		   ts_rank(p.search_vector, websearch_to_tsquery('english', src.query_text)) DESC,
		   p.published_at DESC NULLS LAST
		 LIMIT 6`, postID)
	if err != nil {
		log.Printf("related posts error: %v", err)
		jsonSuccess(w, http.StatusOK, []Post{})
		return
	}
	defer rows.Close()
	jsonSuccess(w, http.StatusOK, scanFeedPosts(rows))
}

// tagsHandler returns the distinct set of tags used across published posts,
// with counts, so the write page can suggest relevant tags.
func tagsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	rows, err := db.Query(`
		SELECT value AS tag, COUNT(*) AS count
		FROM posts, jsonb_array_elements_text(posts.tags)
		WHERE posts.status = 'published'
		GROUP BY value
		ORDER BY count DESC, tag ASC
		LIMIT 100`)
	if err != nil {
		log.Printf("tags list error: %v", err)
		jsonSuccess(w, http.StatusOK, []map[string]interface{}{})
		return
	}
	defer rows.Close()
	type tagCount struct {
		Tag   string `json:"tag"`
		Count int    `json:"count"`
	}
	out := []tagCount{}
	for rows.Next() {
		var t tagCount
		if err := rows.Scan(&t.Tag, &t.Count); err == nil {
			out = append(out, t)
		}
	}
	jsonSuccess(w, http.StatusOK, out)
}

// ============================================================
// TRENDING + TOPIC FOLLOW HANDLERS
// ============================================================

// trendingPostsHandler returns the most-viewed posts in the last 24 hours,
// based on the post_views event log. Falls back to the all-time trending feed
// when there are too few recent views (keeps the panel from going empty).
func trendingPostsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	rows, err := db.Query(`
		SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
		 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
		 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
		 FROM post_views pv
		 JOIN posts p ON p.id = pv.post_id
		 JOIN users u ON p.author_id = u.id
		 WHERE pv.viewed_at > now() - interval '24 hours' AND p.status = 'published'
		 GROUP BY p.id, u.username, u.display_name, u.avatar_url
		 ORDER BY COUNT(*) DESC, MAX(pv.viewed_at) DESC
		 LIMIT 10`)
	if err != nil {
		log.Printf("trending posts error: %v", err)
		jsonSuccess(w, http.StatusOK, []Post{})
		return
	}
	posts := scanFeedPosts(rows)
	rows.Close()

	// Fallback: if the event log has no recent views yet, order by engagement
	// (likes + comments) then recency so the panel never renders empty.
	if len(posts) == 0 {
		fallback, err := db.Query(`
			SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
			 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
			 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
			 FROM posts p JOIN users u ON p.author_id = u.id
			 WHERE p.status = 'published'
			 ORDER BY (p.like_count + p.comment_count * 2 + p.repost_count * 3) DESC NULLS LAST,
			          p.published_at DESC NULLS LAST
			 LIMIT 10`)
		if err == nil {
			posts = scanFeedPosts(fallback)
			fallback.Close()
		}
	}
	jsonSuccess(w, http.StatusOK, posts)
}

// trendingTopicsHandler returns the hottest tags by recent views (last 24h),
// falling back to tag usage count when there's little view data.
func trendingTopicsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	rows, err := db.Query(`
		SELECT tag, COUNT(*) AS recent_views
		 FROM post_views pv
		 JOIN posts p ON p.id = pv.post_id,
		 jsonb_array_elements_text(p.tags) AS tag
		 WHERE pv.viewed_at > now() - interval '24 hours' AND p.status = 'published'
		 GROUP BY tag
		 ORDER BY recent_views DESC, tag ASC
		 LIMIT 10`)
	if err != nil {
		log.Printf("trending topics error: %v", err)
	}
	type topicCount struct {
		Tag   string `json:"tag"`
		Count int    `json:"count"`
	}
	out := []topicCount{}
	if err == nil {
		for rows.Next() {
			var t topicCount
			if err := rows.Scan(&t.Tag, &t.Count); err == nil {
				out = append(out, t)
			}
		}
		rows.Close()
	}
	// Fallback: if no recent view data, surface the most-used tags overall.
	if len(out) == 0 {
		rows2, err2 := db.Query(`
			SELECT value AS tag, COUNT(*) AS count
			 FROM posts, jsonb_array_elements_text(posts.tags)
			 WHERE posts.status = 'published'
			 GROUP BY value ORDER BY count DESC, tag ASC LIMIT 10`)
		if err2 == nil {
			for rows2.Next() {
				var t topicCount
				if err := rows2.Scan(&t.Tag, &t.Count); err == nil {
					out = append(out, t)
				}
			}
			rows2.Close()
		}
	}
	jsonSuccess(w, http.StatusOK, out)
}

// topicFollowHandler follows (POST) or unfollows (DELETE) a topic tag for the user.
func topicFollowHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}
	var req struct {
		Tag string `json:"tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
		return
	}
	tag := strings.TrimSpace(req.Tag)
	if tag == "" {
		jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "tag required")
		return
	}
	switch r.Method {
	case http.MethodPost:
		if _, err := db.Exec(`INSERT INTO topic_follows (user_id, tag) VALUES ($1::uuid, $2) ON CONFLICT (user_id, tag) DO NOTHING`, userID, tag); err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to follow topic")
			return
		}
		jsonSuccess(w, http.StatusOK, map[string]string{"status": "following", "tag": tag})
	case http.MethodDelete:
		if _, err := db.Exec(`DELETE FROM topic_follows WHERE user_id::text=$1 AND tag=$2`, userID, tag); err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to unfollow topic")
			return
		}
		jsonSuccess(w, http.StatusOK, map[string]string{"status": "unfollowed", "tag": tag})
	default:
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
	}
}

// followedTopicsHandler lists the tags the current user follows.
func followedTopicsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}
	rows, err := db.Query(`SELECT tag FROM topic_follows WHERE user_id::text=$1 ORDER BY tag ASC`, userID)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to load followed topics")
		return
	}
	defer rows.Close()
	tags := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err == nil {
			tags = append(tags, t)
		}
	}
	jsonSuccess(w, http.StatusOK, tags)
}

// followingTopicsFeedHandler returns published posts whose tags intersect the
// user's followed topics. If the user follows nothing OR there are no matching
// posts, it falls back to the latest posts from all topics.
func followingTopicsFeedHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	userID, _ := extractUserID(r)

	var posts []Post
	if userID != "" {
		rows, err := db.Query(`
			SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
			 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
			 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
			 FROM posts p JOIN users u ON p.author_id = u.id
			 WHERE p.status = 'published'
			   AND EXISTS (
			     SELECT 1 FROM jsonb_array_elements_text(p.tags) t
			     WHERE t IN (SELECT tag FROM topic_follows WHERE user_id::text = $1)
			   )
			 ORDER BY p.published_at DESC NULLS LAST
			 LIMIT 50`, userID)
		if err == nil {
			posts = scanFeedPosts(rows)
			rows.Close()
		}
	}

	// Fallback: no followed topics or no matching posts -> latest from all topics.
	if len(posts) == 0 {
		rows, err := db.Query(`
			SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
			 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
			 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
			 FROM posts p JOIN users u ON p.author_id = u.id
			 WHERE p.status = 'published'
			 ORDER BY p.published_at DESC NULLS LAST
			 LIMIT 50`)
		if err != nil {
			jsonSuccess(w, http.StatusOK, []Post{})
			return
		}
		posts = scanFeedPosts(rows)
		rows.Close()
	}
	jsonSuccess(w, http.StatusOK, posts)
}

// ============================================================
// API KEY MANAGEMENT HANDLERS
// ============================================================

func apiKeysHandler(w http.ResponseWriter, r *http.Request) {
	// Only JWT auth allowed for key management (not API keys themselves)
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "JWT authentication required to manage API keys")
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/v1/api-keys")
	path = strings.TrimPrefix(path, "/")

	switch {
	case r.Method == http.MethodPost && path == "":
		createAPIKeyHandler(w, r, userID)
	case r.Method == http.MethodGet && path == "":
		listAPIKeysHandler(w, r, userID)
	case r.Method == http.MethodDelete && path != "":
		deleteAPIKeyHandler(w, r, userID, path)
	default:
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
	}
}

func createAPIKeyHandler(w http.ResponseWriter, r *http.Request, userID string) {
	var req struct {
		Name          string   `json:"name"`
		Scopes        []string `json:"scopes"`
		ExpiresInDays *int     `json:"expires_in_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
		return
	}
	if req.Name == "" || len(req.Name) > 100 {
		jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Name must be 1-100 characters")
		return
	}
	if len(req.Scopes) == 0 {
		jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "At least one scope required")
		return
	}
	for _, s := range req.Scopes {
		if !validScopes[s] {
			jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", fmt.Sprintf("Invalid scope: %s", s))
			return
		}
	}

	// Check max 10 keys per user
	var keyCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM api_keys WHERE user_id::text = $1 AND is_active = true`, userID).Scan(&keyCount); err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to check API key count")
		return
	}
	if keyCount >= 10 {
		jsonError(w, http.StatusBadRequest, "LIMIT_REACHED", "Maximum 10 active API keys per user")
		return
	}

	rawKey, err := generateRandomKey()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to generate key")
		return
	}
	prefix := rawKey[:8]
	hash, err := bcrypt.GenerateFromPassword([]byte(rawKey), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to process key")
		return
	}

	var expiresAt *time.Time
	if req.ExpiresInDays != nil && *req.ExpiresInDays > 0 {
		t := time.Now().Add(time.Duration(*req.ExpiresInDays) * 24 * time.Hour)
		expiresAt = &t
	}

	id := uuid.New().String()

	_, err = db.Exec(`

		INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, scopes, expires_at, created_at, updated_at)
		VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, NOW(), NOW())`,
		id, userID, req.Name, prefix, string(hash), req.Scopes, expiresAt,
	)

	if err != nil {
		log.Printf("Create API key error: %v", err)
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create API key")
		return
	}

	apiKey := APIKey{
		ID:        id,
		Name:      req.Name,
		KeyPrefix: prefix,
		Scopes:    req.Scopes,
		ExpiresAt: expiresAt,
		IsActive:  true,
		CreatedAt: time.Now(),
	}

	jsonSuccess(w, http.StatusCreated, map[string]interface{}{
		"key":     rawKey,
		"api_key": apiKey,
	})
}

func listAPIKeysHandler(w http.ResponseWriter, r *http.Request, userID string) {
	rows, err := db.Query(`
		SELECT id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at
		FROM api_keys WHERE user_id::text = $1
		ORDER BY created_at DESC`, userID)
	if err != nil {
		log.Printf("List API keys error: %v", err)
		jsonSuccess(w, http.StatusOK, []APIKey{})
		return
	}
	defer rows.Close()

	var keys []APIKey
	for rows.Next() {
		var k APIKey
		var scopesRaw string
		if err := rows.Scan(&k.ID, &k.Name, &k.KeyPrefix, &scopesRaw, &k.LastUsedAt, &k.ExpiresAt, &k.IsActive, &k.CreatedAt); err != nil {
			log.Printf("Scan API key error: %v", err)
			continue
		}
		k.Scopes = parseScopes(scopesRaw)
		keys = append(keys, k)
	}
	if err := rows.Err(); err != nil {
		log.Printf("List API keys rows error: %v", err)
	}
	if keys == nil {
		keys = []APIKey{}
	}
	jsonSuccess(w, http.StatusOK, keys)
}

func deleteAPIKeyHandler(w http.ResponseWriter, r *http.Request, userID, keyID string) {
	result, err := db.Exec(`UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id::text = $2`, keyID, userID)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to revoke key")
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		jsonError(w, http.StatusNotFound, "NOT_FOUND", "API key not found")
		return
	}
	jsonSuccess(w, http.StatusOK, map[string]string{"message": "API key revoked"})
}

// ============================================================
// PROGRAMMATIC CONTENT ENDPOINTS
// ============================================================

func listMyPostsHandler(w http.ResponseWriter, r *http.Request) {
	userID, scopes, err := extractAuth(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}
	if !hasScope(scopes, "posts:read") {
		jsonError(w, http.StatusForbidden, "FORBIDDEN", "Insufficient scope: posts:read required")
		return
	}

	rows, err := db.Query(`
		SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
		 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
		 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at, p.updated_at
		 FROM posts p JOIN users u ON p.author_id = u.id
		 WHERE p.author_id::text = $1 AND p.status != 'archived'
		 ORDER BY p.created_at DESC
		 LIMIT 100`, userID)
	if err != nil {
		jsonSuccess(w, http.StatusOK, []Post{})
		return
	}
	defer rows.Close()

	posts := []Post{}
	for rows.Next() {
		var post Post
		var tagsJSON []byte
		if err := rows.Scan(&post.ID, &post.AuthorID, &post.AuthorUsername, &post.AuthorName, &post.AuthorAvatar,
			&post.Slug, &post.Title, &post.Excerpt, &tagsJSON, &post.CoverImageURL, &post.ReadingTimeMinutes,
			&post.PublishedAt, &post.ViewCount, &post.LikeCount, &post.IsPremium, &post.Status,
			&post.CreatedAt, &post.UpdatedAt); err != nil {
			log.Printf("Scan my post error: %v", err)
			continue
		}
		if len(tagsJSON) > 0 {
			_ = json.Unmarshal(tagsJSON, &post.Tags)
		}
		if post.Tags == nil {
			post.Tags = []string{}
		}
		posts = append(posts, post)
	}
	jsonSuccess(w, http.StatusOK, posts)
}

func updatePostHandler(w http.ResponseWriter, r *http.Request, postID string) {
	userID, scopes, err := extractAuth(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}
	if !hasScope(scopes, "posts:write") {
		jsonError(w, http.StatusForbidden, "FORBIDDEN", "Insufficient scope: posts:write required")
		return
	}

	// Verify ownership
	var ownerID string
	err = db.QueryRow(`SELECT author_id::text FROM posts WHERE id = $1`, postID).Scan(&ownerID)
	if err != nil {
		jsonError(w, http.StatusNotFound, "NOT_FOUND", "Post not found")
		return
	}
	if ownerID != userID {
		jsonError(w, http.StatusForbidden, "FORBIDDEN", "You can only update your own posts")
		return
	}

	var req struct {
		Title         *string                `json:"title"`
		Content       map[string]interface{} `json:"content"`
		Excerpt       *string                `json:"excerpt"`
		Tags          *[]string              `json:"tags"`
		CoverImageURL *string                `json:"cover_image_url"`
		IsPremium     *bool                  `json:"is_premium"`
		Status        *string                `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
		return
	}

	// Build dynamic update
	sets := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argIdx := 1

	if req.Title != nil {
		sets = append(sets, fmt.Sprintf("title = $%d", argIdx))
		args = append(args, *req.Title)
		argIdx++
	}
	if req.Content != nil {
		contentJSON, _ := json.Marshal(req.Content)
		sets = append(sets, fmt.Sprintf("content = $%d", argIdx))
		args = append(args, contentJSON)
		argIdx++
		wordCount := len(strings.Fields(extractTextFromTipTap(req.Content)))
		sets = append(sets, fmt.Sprintf("word_count = $%d", argIdx))
		args = append(args, wordCount)
		argIdx++
		sets = append(sets, fmt.Sprintf("reading_time_minutes = $%d", argIdx))
		args = append(args, wordCount/200+1)
		argIdx++
	}
	if req.Excerpt != nil {
		// Author explicitly set the excerpt (may be empty to clear it).
		sets = append(sets, fmt.Sprintf("excerpt = $%d", argIdx))
		args = append(args, *req.Excerpt)
		argIdx++
	} else if req.Content != nil {
		// Content changed but no excerpt supplied: regenerate the excerpt from
		// the new body so the feed preview stays in sync with the content.
		sets = append(sets, fmt.Sprintf("excerpt = $%d", argIdx))
		args = append(args, autoExcerpt(req.Content))
		argIdx++
	}
	if req.CoverImageURL != nil {
		sets = append(sets, fmt.Sprintf("cover_image_url = $%d", argIdx))
		args = append(args, *req.CoverImageURL)
		argIdx++
	}
	if req.Tags != nil {
		tags := *req.Tags
		if tags == nil {
			tags = []string{}
		}
		tagsJSON, _ := json.Marshal(tags)
		sets = append(sets, fmt.Sprintf("tags = $%d::jsonb", argIdx))
		args = append(args, tagsJSON)
		argIdx++
	}
	if req.IsPremium != nil {
		sets = append(sets, fmt.Sprintf("is_premium = $%d", argIdx))
		args = append(args, *req.IsPremium)
		argIdx++
	}
	if req.Status != nil {
		sets = append(sets, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
		if *req.Status == "published" {
			sets = append(sets, "published_at = COALESCE(published_at, NOW())")
		}
	}

	args = append(args, postID)
	query := fmt.Sprintf("UPDATE posts SET %s WHERE id = $%d", strings.Join(sets, ", "), argIdx)

	_, err = db.Exec(query, args...)
	if err != nil {
		log.Printf("Update post error: %v", err)
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update post")
		return
	}

	jsonSuccess(w, http.StatusOK, map[string]string{"message": "Post updated", "id": postID})
}

func deletePostHandler(w http.ResponseWriter, r *http.Request, postID string) {
	userID, scopes, err := extractAuth(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}
	if !hasScope(scopes, "posts:write") {
		jsonError(w, http.StatusForbidden, "FORBIDDEN", "Insufficient scope: posts:write required")
		return
	}

	result, err := db.Exec(`UPDATE posts SET status = 'archived', updated_at = NOW() WHERE id = $1 AND author_id::text = $2`, postID, userID)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to delete post")
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		jsonError(w, http.StatusNotFound, "NOT_FOUND", "Post not found or not owned by you")
		return
	}
	jsonSuccess(w, http.StatusOK, map[string]string{"message": "Post archived"})
}
