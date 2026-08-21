package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

// --- Content Moderation (Reports) ---
//
// Users can report posts/comments as spam, abuse, or inappropriate. Admins can
// review reports and take action (resolve, dismiss, or remove content).

type report struct {
	ID         string `json:"id"`
	ReporterID string `json:"reporter_id"`
	ReporterUsername string `json:"reporter_username"`
	PostID     string `json:"post_id,omitempty"`
	CommentID  string `json:"comment_id,omitempty"`
	PostTitle  string `json:"post_title,omitempty"`
	CommentBody string `json:"comment_body,omitempty"`
	Reason     string `json:"reason"`
	Details    string `json:"details"`
	Status     string `json:"status"`
	CreatedAt  string `json:"created_at"`
}

// reportsHandler handles POST /api/v1/reports (create a report) and
// GET /api/v1/reports (list reports — admin only).
func reportsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		createReport(w, r)
	case http.MethodGet:
		listReports(w, r)
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// reportItemHandler handles PUT /api/v1/reports/{id} (update report status — admin only).
func reportItemHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
		return
	}
	reportID := strings.TrimPrefix(r.URL.Path, "/api/v1/reports/")
	if reportID == "" {
		jsonError(w, 400, "bad_request", "report_id required")
		return
	}
	updateReportStatus(w, r, reportID)
}

func createReport(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}

	var input struct {
		PostID    string `json:"post_id"`
		CommentID string `json:"comment_id"`
		Reason    string `json:"reason"`
		Details   string `json:"details"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, 400, "bad_request", "Invalid request body")
		return
	}

	// Must target either a post or a comment.
	if input.PostID == "" && input.CommentID == "" {
		jsonError(w, 400, "bad_request", "post_id or comment_id required")
		return
	}
	if input.PostID != "" && input.CommentID != "" {
		jsonError(w, 400, "bad_request", "Cannot report both a post and a comment")
		return
	}

	// Validate reason.
	validReasons := map[string]bool{"spam": true, "abuse": true, "inappropriate": true, "other": true}
	if !validReasons[input.Reason] {
		jsonError(w, 400, "validation_error", "reason must be one of: spam, abuse, inappropriate, other")
		return
	}

	var id string
	err = db.QueryRow(`
		INSERT INTO reports (reporter_id, post_id, comment_id, reason, details)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`,
		userID,
		nullIfEmpty(input.PostID),
		nullIfEmpty(input.CommentID),
		input.Reason,
		input.Details).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			jsonError(w, 409, "conflict", "You have already reported this content")
			return
		}
		jsonError(w, 500, "db_error", err.Error())
		return
	}

	jsonSuccess(w, 201, map[string]string{"id": id, "status": "reported"})
}

// isAdmin checks if the user has the 'admin' role.
func isAdmin(userID string) bool {
	var role string
	if err := db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&role); err != nil {
		return false
	}
	return role == "admin"
}

func listReports(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}

	// Admin only — check if user has the 'admin' role.
	if !isAdmin(userID) {
		jsonError(w, 403, "forbidden", "Admin access required")
		return
	}

	status := r.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}

	rows, err := db.Query(`
		SELECT r.id, r.reporter_id, u.username, r.post_id, r.comment_id,
		       p.title, c.body, r.reason, r.details, r.status, r.created_at
		FROM reports r
		JOIN users u ON r.reporter_id = u.id
		LEFT JOIN posts p ON r.post_id = p.id
		LEFT JOIN comments c ON r.comment_id = c.id
		WHERE r.status = $1
		ORDER BY r.created_at DESC
		LIMIT 100`, status)
	if err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	defer rows.Close()

	out := []report{}
	for rows.Next() {
		var r report
		var postID, commentID, postTitle, commentBody *string
		if err := rows.Scan(&r.ID, &r.ReporterID, &r.ReporterUsername, &postID, &commentID,
			&postTitle, &commentBody, &r.Reason, &r.Details, &r.Status, &r.CreatedAt); err != nil {
			continue
		}
		if postID != nil {
			r.PostID = *postID
		}
		if commentID != nil {
			r.CommentID = *commentID
		}
		if postTitle != nil {
			r.PostTitle = *postTitle
		}
		if commentBody != nil {
			r.CommentBody = *commentBody
		}
		out = append(out, r)
	}
	if out == nil {
		out = []report{}
	}
	jsonSuccess(w, 200, out)
}

func updateReportStatus(w http.ResponseWriter, r *http.Request, reportID string) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}

	// Admin only — check if user has the 'admin' role.
	if !isAdmin(userID) {
		jsonError(w, 403, "forbidden", "Admin access required")
		return
	}

	var input struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, 400, "bad_request", "Invalid request body")
		return
	}

	validStatuses := map[string]bool{"reviewed": true, "resolved": true, "dismissed": true}
	if !validStatuses[input.Status] {
		jsonError(w, 400, "validation_error", "status must be one of: reviewed, resolved, dismissed")
		return
	}

	if _, err := db.Exec("UPDATE reports SET status = $1, updated_at = NOW() WHERE id = $2", input.Status, reportID); err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}

	jsonSuccess(w, 200, map[string]string{"status": "updated"})
}

func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
