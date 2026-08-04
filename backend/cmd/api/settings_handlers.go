package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// registerSettingsRoutes wires all settings-related endpoints into the mux.
func registerSettingsRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/settings/account", accountSettingsHandler)
	mux.HandleFunc("/api/v1/settings/public-profile", publicProfileSettingsHandler)
	mux.HandleFunc("/api/v1/settings/security", securitySettingsHandler)
	mux.HandleFunc("/api/v1/settings/notifications", notificationPrefsHandler)
	mux.HandleFunc("/api/v1/settings/privacy", privacySettingsHandler)
	mux.HandleFunc("/api/v1/settings/writing", writingPrefsHandler)
	mux.HandleFunc("/api/v1/settings/reading", readingPrefsHandler)
	mux.HandleFunc("/api/v1/settings/email", emailPrefsHandler)
	mux.HandleFunc("/api/v1/settings/connected-accounts", connectedAccountsHandler)
	mux.HandleFunc("/api/v1/settings/connected-accounts/", connectedAccountsHandler)
	mux.HandleFunc("/api/v1/settings/sessions", sessionsHandler)
	mux.HandleFunc("/api/v1/settings/sessions/", sessionsHandler)
	mux.HandleFunc("/api/v1/settings/sessions/revoke-all", revokeAllSessionsHandler)
	mux.HandleFunc("/api/v1/settings/change-password", changePasswordHandler)
	mux.HandleFunc("/api/v1/settings/export-data", exportDataHandler)
	mux.HandleFunc("/api/v1/settings/delete-account", deleteAccountHandler)
	mux.HandleFunc("/api/v1/settings/deactivate-account", deactivateAccountHandler)
	mux.HandleFunc("/api/v1/settings/remove-all-stories", removeAllStoriesHandler)
}

// authed is a small helper that extracts the user id or writes a 401.
func authed(w http.ResponseWriter, r *http.Request) (string, bool) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return "", false
	}
	return userID, true
}

// ---------------- Account Settings ----------------

func accountSettingsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		var u struct {
			Email    string `json:"email"`
			Username string `json:"username"`
			Phone    string `json:"phone"`
			Language string `json:"language"`
			Timezone string `json:"timezone"`
		}
		err := db.QueryRow(`SELECT email, username, phone, language, timezone FROM users WHERE id::text=$1`, userID).
			Scan(&u.Email, &u.Username, &u.Phone, &u.Language, &u.Timezone)
		if err != nil {
			jsonError(w, http.StatusNotFound, "NOT_FOUND", "User not found")
			return
		}
		jsonSuccess(w, http.StatusOK, u)
	case http.MethodPut:
		var req struct {
			Username *string `json:"username"`
			Email    *string `json:"email"`
			Phone    *string `json:"phone"`
			Language *string `json:"language"`
			Timezone *string `json:"timezone"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
			return
		}
		sets := []string{"updated_at = NOW()"}
		args := []interface{}{}
		idx := 1
		if req.Username != nil {
			un := strings.TrimSpace(*req.Username)
			if !validateUsername(un) {
				jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Username must be 3-30 chars, alphanumeric + underscore")
				return
			}
			var exists int
			db.QueryRow(`SELECT COUNT(1) FROM users WHERE username=$1 AND id::text<>$2`, un, userID).Scan(&exists)
			if exists > 0 {
				jsonError(w, http.StatusConflict, "CONFLICT", "Username already taken")
				return
			}
			sets = append(sets, "username = $"+itoa(idx))
			args = append(args, un)
			idx++
		}
		if req.Email != nil {
			em := strings.TrimSpace(*req.Email)
			if !validateEmail(em) {
				jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid email address")
				return
			}
			var exists int
			db.QueryRow(`SELECT COUNT(1) FROM users WHERE email=$1 AND id::text<>$2`, em, userID).Scan(&exists)
			if exists > 0 {
				jsonError(w, http.StatusConflict, "CONFLICT", "Email already in use")
				return
			}
			sets = append(sets, "email = $"+itoa(idx))
			args = append(args, em)
			idx++
		}
		if req.Phone != nil {
			sets = append(sets, "phone = $"+itoa(idx))
			args = append(args, strings.TrimSpace(*req.Phone))
			idx++
		}
		if req.Language != nil {
			sets = append(sets, "language = $"+itoa(idx))
			args = append(args, strings.TrimSpace(*req.Language))
			idx++
		}
		if req.Timezone != nil {
			sets = append(sets, "timezone = $"+itoa(idx))
			args = append(args, strings.TrimSpace(*req.Timezone))
			idx++
		}
		args = append(args, userID)
		query := "UPDATE users SET " + strings.Join(sets, ", ") + " WHERE id::text = $" + itoa(idx)
		if _, err := db.Exec(query, args...); err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update account")
			return
		}
		jsonSuccess(w, http.StatusOK, map[string]string{"message": "Account updated"})
	default:
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
	}
}

// ---------------- Public Profile ----------------

func publicProfileSettingsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		var p struct {
			Name              string `json:"name"`
			CoverImageURL     string `json:"cover_image_url"`
			ShortBio          string `json:"short_bio"`
			Bio               string `json:"bio"`
			Website           string `json:"website"`
			GithubURL         string `json:"github_url"`
			LinkedinURL       string `json:"linkedin_url"`
			TwitterURL        string `json:"twitter_url"`
			InstagramURL      string `json:"instagram_url"`
			YoutubeURL        string `json:"youtube_url"`
			ProfileVisibility string `json:"profile_visibility"`
		}
		err := db.QueryRow(`SELECT name, cover_image_url, short_bio, COALESCE(bio,''), COALESCE(website,''),
			github_url, linkedin_url, twitter_url, instagram_url, youtube_url, profile_visibility
			FROM profiles WHERE user_id::text=$1`, userID).
			Scan(&p.Name, &p.CoverImageURL, &p.ShortBio, &p.Bio, &p.Website, &p.GithubURL, &p.LinkedinURL,
				&p.TwitterURL, &p.InstagramURL, &p.YoutubeURL, &p.ProfileVisibility)
		if err == sql.ErrNoRows {
			jsonSuccess(w, http.StatusOK, map[string]string{"profile_visibility": "public"})
			return
		}
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to load profile")
			return
		}
		jsonSuccess(w, http.StatusOK, p)
	case http.MethodPut:
		var req struct {
			DisplayName       *string `json:"display_name"`
			CoverImageURL     *string `json:"cover_image_url"`
			ShortBio          *string `json:"short_bio"`
			Website           *string `json:"website"`
			GithubURL         *string `json:"github_url"`
			LinkedinURL       *string `json:"linkedin_url"`
			TwitterURL        *string `json:"twitter_url"`
			InstagramURL      *string `json:"instagram_url"`
			YoutubeURL        *string `json:"youtube_url"`
			ProfileVisibility *string `json:"profile_visibility"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
			return
		}
		// Ensure a profiles row exists, then update the public-facing columns.
		_, _ = db.Exec(`INSERT INTO profiles (user_id, name) VALUES ($1::uuid, '') ON CONFLICT (user_id) DO NOTHING`, userID)
		if req.DisplayName != nil {
			db.Exec(`UPDATE profiles SET name=$1, updated_at=NOW() WHERE user_id::text=$2`, strings.TrimSpace(*req.DisplayName), userID)
			db.Exec(`UPDATE users SET display_name=$1, updated_at=NOW() WHERE id::text=$2`, strings.TrimSpace(*req.DisplayName), userID)
		}
		if req.CoverImageURL != nil {
			db.Exec(`UPDATE profiles SET cover_image_url=$1, updated_at=NOW() WHERE user_id::text=$2`, strings.TrimSpace(*req.CoverImageURL), userID)
		}
		if req.ShortBio != nil {
			db.Exec(`UPDATE profiles SET short_bio=$1, updated_at=NOW() WHERE user_id::text=$2`, strings.TrimSpace(*req.ShortBio), userID)
		}
		if req.Website != nil {
			db.Exec(`UPDATE profiles SET website=$1, updated_at=NOW() WHERE user_id::text=$2`, strings.TrimSpace(*req.Website), userID)
		}
		if req.GithubURL != nil {
			db.Exec(`UPDATE profiles SET github_url=$1, updated_at=NOW() WHERE user_id::text=$2`, strings.TrimSpace(*req.GithubURL), userID)
		}
		if req.LinkedinURL != nil {
			db.Exec(`UPDATE profiles SET linkedin_url=$1, updated_at=NOW() WHERE user_id::text=$2`, strings.TrimSpace(*req.LinkedinURL), userID)
		}
		if req.TwitterURL != nil {
			db.Exec(`UPDATE profiles SET twitter_url=$1, updated_at=NOW() WHERE user_id::text=$2`, strings.TrimSpace(*req.TwitterURL), userID)
		}
		if req.InstagramURL != nil {
			db.Exec(`UPDATE profiles SET instagram_url=$1, updated_at=NOW() WHERE user_id::text=$2`, strings.TrimSpace(*req.InstagramURL), userID)
		}
		if req.YoutubeURL != nil {
			db.Exec(`UPDATE profiles SET youtube_url=$1, updated_at=NOW() WHERE user_id::text=$2`, strings.TrimSpace(*req.YoutubeURL), userID)
		}
		if req.ProfileVisibility != nil {
			v := strings.ToLower(strings.TrimSpace(*req.ProfileVisibility))
			if v != "public" && v != "private" {
				jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "profile_visibility must be 'public' or 'private'")
				return
			}
			db.Exec(`UPDATE profiles SET profile_visibility=$1, updated_at=NOW() WHERE user_id::text=$2`, v, userID)
		}
		jsonSuccess(w, http.StatusOK, map[string]string{"message": "Public profile updated"})
	default:
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
	}
}

// ---------------- Security ----------------

func securitySettingsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		var twoFA bool
		var recovery string
		db.QueryRow(`SELECT two_factor_enabled, recovery_email FROM users WHERE id::text=$1`, userID).Scan(&twoFA, &recovery)
		jsonSuccess(w, http.StatusOK, map[string]interface{}{
			"two_factor_enabled": twoFA,
			"recovery_email":     recovery,
		})
		return
	}
	if r.Method == http.MethodPut {
		var req struct {
			TwoFactorEnabled *bool   `json:"two_factor_enabled"`
			RecoveryEmail    *string `json:"recovery_email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
			return
		}
		if req.TwoFactorEnabled != nil {
			db.Exec(`UPDATE users SET two_factor_enabled=$1, updated_at=NOW() WHERE id::text=$2`, *req.TwoFactorEnabled, userID)
		}
		if req.RecoveryEmail != nil {
			re := strings.TrimSpace(*req.RecoveryEmail)
			if re != "" && !validateEmail(re) {
				jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid recovery email")
				return
			}
			db.Exec(`UPDATE users SET recovery_email=$1, updated_at=NOW() WHERE id::text=$2`, re, userID)
		}
		jsonSuccess(w, http.StatusOK, map[string]string{"message": "Security settings updated"})
		return
	}
	jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
}

func changePasswordHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
		return
	}
	if !validatePassword(req.NewPassword) {
		jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "New password must be 8-128 characters")
		return
	}
	var hash string
	if err := db.QueryRow(`SELECT password_hash FROM users WHERE id::text=$1`, userID).Scan(&hash); err != nil {
		jsonError(w, http.StatusNotFound, "NOT_FOUND", "User not found")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.CurrentPassword)); err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Current password is incorrect")
		return
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to hash password")
		return
	}
	if _, err := db.Exec(`UPDATE users SET password_hash=$1, password_changed_at=NOW(), updated_at=NOW() WHERE id::text=$2`, string(newHash), userID); err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update password")
		return
	}
	// Invalidate all other sessions for safety.
	db.Exec(`DELETE FROM sessions WHERE user_id::text=$1`, userID)
	jsonSuccess(w, http.StatusOK, map[string]string{"message": "Password changed"})
}

// ---------------- Sessions ----------------

func sessionsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/settings/sessions")
	path = strings.Trim(path, "/")

	if r.Method == http.MethodDelete && path != "" && path != "revoke-all" {
		// Revoke a single session by id.
		res, err := db.Exec(`DELETE FROM sessions WHERE id::text=$1 AND user_id::text=$2`, path, userID)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to revoke session")
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			jsonError(w, http.StatusNotFound, "NOT_FOUND", "Session not found")
			return
		}
		jsonSuccess(w, http.StatusOK, map[string]string{"message": "Session revoked"})
		return
	}

	if r.Method == http.MethodGet {
		rows, err := db.Query(`SELECT id, user_agent, ip, device, last_used_at, created_at
			FROM sessions WHERE user_id::text=$1 ORDER BY last_used_at DESC LIMIT 50`, userID)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to load sessions")
			return
		}
		defer rows.Close()
		type sess struct {
			ID         string    `json:"id"`
			UserAgent  string    `json:"user_agent"`
			IP         string    `json:"ip"`
			Device     string    `json:"device"`
			LastUsedAt time.Time `json:"last_used_at"`
			CreatedAt  time.Time `json:"created_at"`
		}
		out := []sess{}
		for rows.Next() {
			var s sess
			if err := rows.Scan(&s.ID, &s.UserAgent, &s.IP, &s.Device, &s.LastUsedAt, &s.CreatedAt); err == nil {
				out = append(out, s)
			}
		}
		jsonSuccess(w, http.StatusOK, out)
		return
	}
	jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
}

func revokeAllSessionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	db.Exec(`DELETE FROM sessions WHERE user_id::text=$1`, userID)
	jsonSuccess(w, http.StatusOK, map[string]string{"message": "Logged out from all devices"})
}

// ---------------- Generic preference tables ----------------

// prefsHandler is a generic GET/PUT upsert for single-row-per-user preference tables.
// allowed maps JSON keys -> column names to guard against injection.
func prefsHandler(w http.ResponseWriter, r *http.Request, table string, allowed map[string]string, defaults map[string]interface{}) {
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		// Sort keys so the SELECT column order matches the scan->key mapping exactly.
		keys := make([]string, 0, len(allowed))
		for k := range allowed {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		cols := make([]string, 0, len(keys))
		for _, k := range keys {
			cols = append(cols, allowed[k])
		}
		query := "SELECT " + strings.Join(cols, ", ") + " FROM " + table + " WHERE user_id::text=$1"
		row := db.QueryRow(query, userID)
		dest := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range dest {
			ptrs[i] = &dest[i]
		}
		if err := row.Scan(ptrs...); err != nil {
			// No row yet -> return defaults.
			jsonSuccess(w, http.StatusOK, defaults)
			return
		}
		result := map[string]interface{}{}
		for i, k := range keys {
			result[k] = dest[i]
		}
		jsonSuccess(w, http.StatusOK, result)
	case http.MethodPut:
		var req map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
			return
		}
		// Build upsert of only allowed keys.
		cols := []string{}
		vals := []interface{}{}
		updates := []string{}
		idx := 2 // $1 is user_id
		for key, val := range req {
			col, ok := allowed[key]
			if !ok {
				continue
			}
			cols = append(cols, col)
			vals = append(vals, val)
			updates = append(updates, col+" = $"+itoa(idx))
			idx++
		}
		if len(cols) == 0 {
			jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "No valid fields")
			return
		}
		insertCols := "user_id, " + strings.Join(cols, ", ")
		placeholders := "$1"
		args := []interface{}{userID}
		for i := range cols {
			placeholders += ", $" + itoa(i+2)
			args = append(args, vals[i])
		}
		query := "INSERT INTO " + table + " (" + insertCols + ") VALUES (" + placeholders + ") " +
			"ON CONFLICT (user_id) DO UPDATE SET " + strings.Join(updates, ", ") + ", updated_at = NOW()"
		if _, err := db.Exec(query, args...); err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to save preferences")
			return
		}
		jsonSuccess(w, http.StatusOK, map[string]string{"message": "Preferences saved"})
	default:
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
	}
}

func notificationPrefsHandler(w http.ResponseWriter, r *http.Request) {
	allowed := map[string]string{
		"email_new_follower":    "email_new_follower",
		"email_new_comment":     "email_new_comment",
		"email_story_featured":  "email_story_featured",
		"email_weekly_digest":   "email_weekly_digest",
		"email_product_updates": "email_product_updates",
		"push_comments":         "push_comments",
		"push_mentions":         "push_mentions",
		"push_new_followers":    "push_new_followers",
		"push_replies":          "push_replies",
	}
	defaults := map[string]interface{}{
		"email_new_follower": true, "email_new_comment": true, "email_story_featured": true,
		"email_weekly_digest": false, "email_product_updates": true,
		"push_comments": true, "push_mentions": true, "push_new_followers": true, "push_replies": true,
	}
	prefsHandler(w, r, "notification_preferences", allowed, defaults)
}

func privacySettingsHandler(w http.ResponseWriter, r *http.Request) {
	allowed := map[string]string{
		"private_account":       "private_account",
		"show_reading_history":  "show_reading_history",
		"allow_search_indexing": "allow_search_indexing",
		"show_followers_count":  "show_followers_count",
		"show_following_count":  "show_following_count",
		"allow_direct_messages": "allow_direct_messages",
	}
	defaults := map[string]interface{}{
		"private_account": false, "show_reading_history": true, "allow_search_indexing": true,
		"show_followers_count": true, "show_following_count": true, "allow_direct_messages": true,
	}
	prefsHandler(w, r, "privacy_settings", allowed, defaults)
}

func writingPrefsHandler(w http.ResponseWriter, r *http.Request) {
	allowed := map[string]string{
		"editor_font": "editor_font", "font_size": "font_size", "editor_width": "editor_width",
		"line_height": "line_height", "dark_mode_editor": "dark_mode_editor", "spell_check": "spell_check",
		"auto_save": "auto_save", "default_visibility": "default_visibility", "enable_comments": "enable_comments",
		"show_reading_time": "show_reading_time", "show_table_of_contents": "show_table_of_contents",
		"canonical_url": "canonical_url",
	}
	defaults := map[string]interface{}{
		"editor_font": "sans", "font_size": "medium", "editor_width": "medium", "line_height": "normal",
		"dark_mode_editor": false, "spell_check": true, "auto_save": true, "default_visibility": "public",
		"enable_comments": true, "show_reading_time": true, "show_table_of_contents": false, "canonical_url": "",
	}
	prefsHandler(w, r, "writing_preferences", allowed, defaults)
}

func readingPrefsHandler(w http.ResponseWriter, r *http.Request) {
	allowed := map[string]string{
		"reading_font": "reading_font", "font_size": "font_size", "line_spacing": "line_spacing",
		"theme": "theme", "highlight_color": "highlight_color", "auto_dark_mode": "auto_dark_mode",
	}
	defaults := map[string]interface{}{
		"reading_font": "sans", "font_size": "medium", "line_spacing": "normal",
		"theme": "system", "highlight_color": "yellow", "auto_dark_mode": false,
	}
	prefsHandler(w, r, "reading_preferences", allowed, defaults)
}

func emailPrefsHandler(w http.ResponseWriter, r *http.Request) {
	allowed := map[string]string{
		"frequency": "frequency", "newsletters": "newsletters", "product_updates": "product_updates",
		"writer_recommendations": "writer_recommendations", "trending_stories": "trending_stories",
	}
	defaults := map[string]interface{}{
		"frequency": "weekly", "newsletters": true, "product_updates": true,
		"writer_recommendations": true, "trending_stories": true,
	}
	prefsHandler(w, r, "email_preferences", allowed, defaults)
}

// ---------------- Connected Accounts ----------------

func connectedAccountsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/settings/connected-accounts")
	path = strings.Trim(path, "/")

	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(`SELECT provider, provider_account_id, connected_at FROM connected_accounts WHERE user_id::text=$1`, userID)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to load connected accounts")
			return
		}
		defer rows.Close()
		type ca struct {
			Provider    string    `json:"provider"`
			AccountID   string    `json:"provider_account_id"`
			ConnectedAt time.Time `json:"connected_at"`
		}
		out := []ca{}
		for rows.Next() {
			var c ca
			if err := rows.Scan(&c.Provider, &c.AccountID, &c.ConnectedAt); err == nil {
				out = append(out, c)
			}
		}
		jsonSuccess(w, http.StatusOK, out)
	case http.MethodPost:
		// Placeholder connect: real OAuth flow would validate a provider token.
		var req struct {
			Provider  string `json:"provider"`
			AccountID string `json:"provider_account_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
			return
		}
		provider := strings.ToLower(strings.TrimSpace(req.Provider))
		valid := map[string]bool{"google": true, "github": true, "apple": true, "discord": true, "linkedin": true, "twitter": true}
		if !valid[provider] {
			jsonError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Unsupported provider")
			return
		}
		_, err := db.Exec(`INSERT INTO connected_accounts (user_id, provider, provider_account_id)
			VALUES ($1::uuid, $2, $3) ON CONFLICT (user_id, provider) DO UPDATE SET provider_account_id=EXCLUDED.provider_account_id`,
			userID, provider, strings.TrimSpace(req.AccountID))
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to connect account")
			return
		}
		jsonSuccess(w, http.StatusOK, map[string]string{"message": provider + " connected"})
	case http.MethodDelete:
		provider := strings.ToLower(path)
		if provider == "" {
			jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "Provider required")
			return
		}
		db.Exec(`DELETE FROM connected_accounts WHERE user_id::text=$1 AND provider=$2`, userID, provider)
		jsonSuccess(w, http.StatusOK, map[string]string{"message": provider + " disconnected"})
	default:
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
	}
}

// ---------------- Danger Zone ----------------

func exportDataHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	var u User
	db.QueryRow(`SELECT id, email, username, display_name, bio, avatar_url, website, location, created_at FROM users WHERE id::text=$1`, userID).
		Scan(&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.Website, &u.Location, &u.CreatedAt)
	rows, _ := db.Query(`SELECT id, slug, title, excerpt, status, published_at, created_at FROM posts WHERE author_id::text=$1`, userID)
	defer rows.Close()
	type ppost struct {
		ID, Slug, Title, Excerpt, Status string
		PublishedAt                      *time.Time
		CreatedAt                        time.Time
	}
	posts := []ppost{}
	for rows.Next() {
		var p ppost
		if err := rows.Scan(&p.ID, &p.Slug, &p.Title, &p.Excerpt, &p.Status, &p.PublishedAt, &p.CreatedAt); err == nil {
			posts = append(posts, p)
		}
	}
	jsonSuccess(w, http.StatusOK, map[string]interface{}{"user": u, "posts": posts})
}

func deleteAccountHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	if _, err := db.Exec(`DELETE FROM users WHERE id::text=$1`, userID); err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to delete account")
		return
	}
	jsonSuccess(w, http.StatusOK, map[string]string{"message": "Account deleted"})
}

func deactivateAccountHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	db.Exec(`UPDATE users SET deactivated_at=NOW(), updated_at=NOW() WHERE id::text=$1`, userID)
	db.Exec(`DELETE FROM sessions WHERE user_id::text=$1`, userID)
	jsonSuccess(w, http.StatusOK, map[string]string{"message": "Account deactivated"})
}

func removeAllStoriesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
		return
	}
	userID, ok := authed(w, r)
	if !ok {
		return
	}
	if _, err := db.Exec(`UPDATE posts SET status='archived', updated_at=NOW() WHERE author_id::text=$1`, userID); err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to remove stories")
		return
	}
	jsonSuccess(w, http.StatusOK, map[string]string{"message": "All stories removed"})
}

// itoa is a thin wrapper around strconv.Itoa for building SQL placeholders.
func itoa(n int) string { return strconv.Itoa(n) }
