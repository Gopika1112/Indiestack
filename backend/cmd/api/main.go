package main

import (
	"context"
	"crypto/rand"
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
	CoverImageURL      string          `json:"cover_image_url"`
	ReadingTimeMinutes int             `json:"reading_time_minutes"`
	WordCount          int             `json:"word_count"`
	Status             string          `json:"status"`
	PublishedAt        *time.Time      `json:"published_at"`
	ViewCount          int             `json:"view_count"`
	LikeCount          int             `json:"like_count"`
	CommentCount       int             `json:"comment_count"`
	IsPremium          bool            `json:"is_premium"`
	CreatedAt          time.Time       `json:"created_at"`
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
		db.Exec(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, id)
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
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
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
	mux.HandleFunc("/api/v1/api-keys", apiKeysHandler)
	mux.HandleFunc("/api/v1/api-keys/", apiKeysHandler)
	mux.HandleFunc("/api/v1/posts/mine", listMyPostsHandler)
	registerPenmarkRoutes(mux)

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

	jsonSuccess(w, http.StatusOK, map[string]interface{}{
		"user":   user,
		"tokens": AuthTokens{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresAt: expiresAt, TokenType: "Bearer"},
	})
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

	var user User
	err := db.QueryRow(
		`SELECT id, email, username, display_name, bio, avatar_url, website, location,
		 is_verified, is_premium, follower_count, following_count, created_at
		 FROM users WHERE username = $1`, username,
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
		 p.slug, p.title, p.excerpt, p.cover_image_url, p.reading_time_minutes,
		 p.published_at, p.view_count, p.like_count, p.is_premium
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

func postsHandler(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/posts/")

	if strings.HasPrefix(path, "slug/") {
		parts := strings.Split(strings.TrimPrefix(path, "slug/"), "/")
		if len(parts) >= 2 {
			getPostBySlug(w, parts[0], parts[1])
			return
		}
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

func getPostBySlug(w http.ResponseWriter, username, slug string) {
	var post Post
	var authorName, authorAvatar string
	err := db.QueryRow(`
		SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
		 p.slug, p.title, p.content, p.excerpt, p.cover_image_url, p.reading_time_minutes,
		 p.word_count, p.status, p.published_at, p.view_count, p.like_count, p.comment_count,
		 p.is_premium, p.created_at
		 FROM posts p JOIN users u ON p.author_id = u.id
		 WHERE u.username = $1 AND p.slug = $2 AND p.status = 'published'`,
		username, slug,
	).Scan(&post.ID, &post.AuthorID, &post.AuthorUsername, &authorName, &authorAvatar,
		&post.Slug, &post.Title, &post.Content, &post.Excerpt, &post.CoverImageURL,
		&post.ReadingTimeMinutes, &post.WordCount, &post.Status, &post.PublishedAt,
		&post.ViewCount, &post.LikeCount, &post.CommentCount, &post.IsPremium, &post.CreatedAt)
	if err != nil {
		jsonError(w, http.StatusNotFound, "NOT_FOUND", "Post not found")
		return
	}
	post.AuthorName = authorName
	post.AuthorAvatar = authorAvatar
	jsonSuccess(w, http.StatusOK, post)
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
	wordCount := len(strings.Fields(string(contentJSON)))
	readingTime := wordCount/200 + 1

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
		INSERT INTO posts (id, author_id, slug, title, content, excerpt, cover_image_url,
		reading_time_minutes, word_count, status, published_at, is_premium, created_at, updated_at)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, `+publishedAt+`, $11, NOW(), NOW())`,
		postID, userID, slug, req.Title, contentJSON, req.Excerpt, req.CoverImageURL,
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
		Content: contentJSON, Excerpt: req.Excerpt, CoverImageURL: req.CoverImageURL,
		ReadingTimeMinutes: readingTime, WordCount: wordCount, Status: status,
		IsPremium: req.IsPremium, CreatedAt: time.Now(),
	})
}

func scanFeedPosts(rows *sql.Rows) []Post {
	var posts []Post
	for rows.Next() {
		var post Post
		rows.Scan(&post.ID, &post.AuthorID, &post.AuthorUsername, &post.AuthorName, &post.AuthorAvatar,
			&post.Slug, &post.Title, &post.Excerpt, &post.CoverImageURL, &post.ReadingTimeMinutes,
			&post.PublishedAt, &post.ViewCount, &post.LikeCount, &post.IsPremium)
		posts = append(posts, post)
	}
	if posts == nil {
		posts = []Post{}
	}
	return posts
}

func feedHandler(w http.ResponseWriter, r *http.Request) {
	latestFeedHandler(w, r)
}

func latestFeedHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
		 p.slug, p.title, p.excerpt, p.cover_image_url, p.reading_time_minutes,
		 p.published_at, p.view_count, p.like_count, p.is_premium
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

func trendingFeedHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
		 p.slug, p.title, p.excerpt, p.cover_image_url, p.reading_time_minutes,
		 p.published_at, p.view_count, p.like_count, p.is_premium
		 FROM posts p JOIN users u ON p.author_id = u.id
		 WHERE p.status = 'published'
		 ORDER BY (p.view_count + p.like_count * 2) DESC
		 LIMIT 20`)
	if err != nil {
		jsonSuccess(w, http.StatusOK, []Post{})
		return
	}
	defer rows.Close()
	jsonSuccess(w, http.StatusOK, scanFeedPosts(rows))
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
		jsonSuccess(w, http.StatusOK, []APIKey{})
		return
	}
	defer rows.Close()

	var keys []APIKey
	for rows.Next() {
		var k APIKey
		var scopesRaw string
		if err := rows.Scan(&k.ID, &k.Name, &k.KeyPrefix, &scopesRaw, &k.LastUsedAt, &k.ExpiresAt, &k.IsActive, &k.CreatedAt); err != nil {
			continue
		}
		k.Scopes = parseScopes(scopesRaw)
		keys = append(keys, k)
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
		 p.slug, p.title, p.excerpt, p.cover_image_url, p.reading_time_minutes,
		 p.published_at, p.view_count, p.like_count, p.is_premium
		 FROM posts p JOIN users u ON p.author_id = u.id
		 WHERE p.author_id::text = $1 AND p.status != 'archived'
		 ORDER BY p.created_at DESC
		 LIMIT 100`, userID)
	if err != nil {
		jsonSuccess(w, http.StatusOK, []Post{})
		return
	}
	defer rows.Close()
	jsonSuccess(w, http.StatusOK, scanFeedPosts(rows))
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
		wordCount := len(strings.Fields(string(contentJSON)))
		sets = append(sets, fmt.Sprintf("word_count = $%d", argIdx))
		args = append(args, wordCount)
		argIdx++
		sets = append(sets, fmt.Sprintf("reading_time_minutes = $%d", argIdx))
		args = append(args, wordCount/200+1)
		argIdx++
	}
	if req.Excerpt != nil {
		sets = append(sets, fmt.Sprintf("excerpt = $%d", argIdx))
		args = append(args, *req.Excerpt)
		argIdx++
	}
	if req.CoverImageURL != nil {
		sets = append(sets, fmt.Sprintf("cover_image_url = $%d", argIdx))
		args = append(args, *req.CoverImageURL)
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
