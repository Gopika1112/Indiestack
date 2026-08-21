package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/indiestack/indiestack/internal/queue"
)

// --- Penmark Types ---

type Profile struct {
	ID         string  `json:"id"`
	UserID     string  `json:"user_id"`
	Name       string  `json:"name"`
	AvatarURL  *string `json:"avatar_url"`
	Headline   *string `json:"headline"`
	Company    *string `json:"company"`
	Location   *string `json:"location"`
	Website    *string `json:"website"`
	Bio        *string `json:"bio"`
	OpenToWork bool    `json:"open_to_work"`
}

type Comment struct {
	ID        string    `json:"id"`
	PostID    string    `json:"post_id"`
	UserID    string    `json:"user_id"`
	ParentID  *string   `json:"parent_id"`
	Body      string    `json:"body"`
	Username  string    `json:"username,omitempty"`
	LikeCount int       `json:"like_count"`
	Liked     bool      `json:"liked"`
	CreatedAt time.Time `json:"created_at"`
}

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"created_at"`
}

type Bookmark struct {
	UserID    string    `json:"user_id"`
	PostID    string    `json:"post_id"`
	Title     string    `json:"title,omitempty"`
	Slug      string    `json:"slug,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type Job struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	CompanyName string    `json:"company_name"`
	Location    *string   `json:"location"`
	JobType     string    `json:"job_type"`
	WorkMode    string    `json:"work_mode"`
	Description string    `json:"description"`
	SalaryMin   *int      `json:"salary_min"`
	SalaryMax   *int      `json:"salary_max"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

// --- Profiles ---

func profilesHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		getProfileHandler(w, r)
	case http.MethodPut:
		updateProfileHandler(w, r)
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

func getProfileHandler(w http.ResponseWriter, r *http.Request) {
	userID := strings.TrimPrefix(r.URL.Path, "/api/v1/profiles/")
	if userID == "" || userID == "me" {
		id, err := extractUserID(r)
		if err != nil {
			jsonError(w, 401, "unauthorized", "Not authenticated")
			return
		}
		userID = id
	}
	var p Profile
	err := db.QueryRow("SELECT id, user_id, name, avatar_url, headline, company, location, website, bio, open_to_work FROM profiles WHERE user_id = $1", userID).
		Scan(&p.ID, &p.UserID, &p.Name, &p.AvatarURL, &p.Headline, &p.Company, &p.Location, &p.Website, &p.Bio, &p.OpenToWork)
	if err == sql.ErrNoRows {
		jsonError(w, 404, "not_found", "Profile not found")
		return
	}
	if err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	jsonSuccess(w, 200, p)
}

func updateProfileHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	var input struct {
		Name     string `json:"name"`
		Headline string `json:"headline"`
		Bio      string `json:"bio"`
		Website  string `json:"website"`
		Location string `json:"location"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, 400, "bad_request", "Invalid request body")
		return
	}
	if len(input.Name) > 100 {
		jsonError(w, 400, "validation_error", "Name must be at most 100 characters")
		return
	}
	if len(input.Headline) > 200 {
		jsonError(w, 400, "validation_error", "Headline must be at most 200 characters")
		return
	}
	if len(input.Bio) > 2000 {
		jsonError(w, 400, "validation_error", "Bio must be at most 2000 characters")
		return
	}
	if len(input.Website) > 500 {
		jsonError(w, 400, "validation_error", "Website must be at most 500 characters")
		return
	}
	if input.Website != "" && !strings.HasPrefix(input.Website, "http://") && !strings.HasPrefix(input.Website, "https://") {
		jsonError(w, 400, "validation_error", "Website must start with http:// or https://")
		return
	}
	if len(input.Location) > 100 {
		jsonError(w, 400, "validation_error", "Location must be at most 100 characters")
		return
	}

	_, err = db.Exec("INSERT INTO profiles (user_id, name, headline, bio, website, location) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id) DO UPDATE SET name=$2, headline=$3, bio=$4, website=$5, location=$6, updated_at=now()",
		userID, input.Name, input.Headline, input.Bio, input.Website, input.Location)
	if err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	jsonSuccess(w, 200, map[string]string{"status": "updated"})
}

// --- Comments ---

func commentsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		postID := r.URL.Query().Get("post_id")
		if postID == "" {
			jsonError(w, 400, "missing_param", "post_id required")
			return
		}
		// Optional auth: when signed in, flag which comments the viewer has liked.
		viewerID, _ := extractUserID(r)
		var rows *sql.Rows
		var err error
		if viewerID == "" {
			rows, err = db.Query(`
				SELECT c.id, c.post_id, c.user_id, c.parent_id, c.body, u.username, c.like_count, c.created_at,
				       false AS liked
				FROM comments c JOIN users u ON c.user_id = u.id
				WHERE c.post_id = $1
				ORDER BY c.created_at`, postID)
		} else {
			rows, err = db.Query(`
				SELECT c.id, c.post_id, c.user_id, c.parent_id, c.body, u.username, c.like_count, c.created_at,
				       EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $2) AS liked
				FROM comments c JOIN users u ON c.user_id = u.id
				WHERE c.post_id = $1
				ORDER BY c.created_at`, postID, viewerID)
		}
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		var comments []Comment
		for rows.Next() {
			var c Comment
			if err := rows.Scan(&c.ID, &c.PostID, &c.UserID, &c.ParentID, &c.Body, &c.Username, &c.LikeCount, &c.CreatedAt, &c.Liked); err != nil {
				continue
			}
			comments = append(comments, c)
		}
		if err := rows.Err(); err != nil {
			log.Printf("Comments rows error: %v", err)
		}
		if comments == nil {
			comments = []Comment{}
		}
		jsonSuccess(w, 200, comments)

	case http.MethodPost:
		userID, err := extractUserID(r)

		if err != nil {
			jsonError(w, 401, "unauthorized", "Not authenticated")
			return
		}
		var input struct {
			PostID   string  `json:"post_id"`
			ParentID *string `json:"parent_id"`
			Body     string  `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			jsonError(w, 400, "bad_request", "Invalid request body")
			return
		}
		if input.PostID == "" {
			jsonError(w, 400, "validation_error", "post_id is required")
			return
		}
		if len(input.Body) == 0 {
			jsonError(w, 400, "validation_error", "body is required")
			return
		}
		if len(input.Body) > 5000 {
			jsonError(w, 400, "validation_error", "body must be at most 5000 characters")
			return
		}
		var id string
		err = db.QueryRow("INSERT INTO comments (post_id, user_id, parent_id, body) VALUES ($1,$2,$3,$4) RETURNING id",
			input.PostID, userID, input.ParentID, input.Body).Scan(&id)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		// Bump the post's comment count and notify the author.
		if _, err := db.Exec("UPDATE posts SET comment_count = comment_count + 1 WHERE id=$1", input.PostID); err != nil {
			log.Printf("comment count increment error: %v", err)
		}
		notifyPostAuthor(input.PostID, userID, "comment", "commented on your post")

		// Fetch the newly created comment with user details
		var newComment Comment
		var username string
		err = db.QueryRow(`SELECT c.id, c.post_id, c.user_id, c.parent_id, c.body, c.like_count, c.created_at, u.username 
			FROM comments c JOIN users u ON c.user_id = u.id 
			WHERE c.id = $1`, id).Scan(&newComment.ID, &newComment.PostID, &newComment.UserID, &newComment.ParentID, &newComment.Body, &newComment.LikeCount, &newComment.CreatedAt, &username)
		if err != nil {
			log.Printf("Failed to fetch new comment: %v", err)
			// Return just the ID as fallback
			jsonSuccess(w, 201, map[string]string{"id": id})
			return
		}
		newComment.Username = username
		newComment.Liked = false
		jsonSuccess(w, 201, newComment)
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// commentItemHandler operates on a single comment: edit (PUT), delete (DELETE),
// like (POST /comments/{id}/like), unlike (DELETE /comments/{id}/like).
// Routes: /api/v1/comments/{id} and /api/v1/comments/{id}/like
func commentItemHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}

	rest := strings.TrimPrefix(r.URL.Path, "/api/v1/comments/")
	parts := strings.Split(strings.Trim(rest, "/"), "/")
	commentID := parts[0]
	isLike := len(parts) == 2 && parts[1] == "like"
	if commentID == "" || (len(parts) == 2 && !isLike) || len(parts) > 2 {
		jsonError(w, 404, "not_found", "Not found")
		return
	}

	// Resolve the comment and its owner.
	var ownerID, postID string
	if err := db.QueryRow("SELECT user_id, post_id FROM comments WHERE id=$1", commentID).Scan(&ownerID, &postID); err != nil {
		jsonError(w, 404, "not_found", "Comment not found")
		return
	}

	if isLike {
		switch r.Method {
		case http.MethodPost:
			tx, err := db.Begin()
			if err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
			defer tx.Rollback()
			res, err := tx.Exec("INSERT INTO comment_likes (user_id, comment_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", userID, commentID)
			if err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
			if n, _ := res.RowsAffected(); n > 0 {
				if _, err := tx.Exec("UPDATE comments SET like_count = like_count + 1 WHERE id=$1", commentID); err != nil {
					jsonError(w, 500, "db_error", err.Error())
					return
				}
			}
			if err := tx.Commit(); err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
			jsonSuccess(w, 200, map[string]string{"status": "liked"})
		case http.MethodDelete:
			tx, err := db.Begin()
			if err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
			defer tx.Rollback()
			res, err := tx.Exec("DELETE FROM comment_likes WHERE user_id=$1 AND comment_id=$2", userID, commentID)
			if err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
			if n, _ := res.RowsAffected(); n > 0 {
				if _, err := tx.Exec("UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id=$1", commentID); err != nil {
					jsonError(w, 500, "db_error", err.Error())
					return
				}
			}
			if err := tx.Commit(); err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
			jsonSuccess(w, 200, map[string]string{"status": "unliked"})
		default:
			jsonError(w, 405, "method_not_allowed", "Method not allowed")
		}
		return
	}

	// Edit / delete require ownership.
	if ownerID != userID {
		jsonError(w, 403, "forbidden", "You can only modify your own comments")
		return
	}

	switch r.Method {
	case http.MethodPut:
		var input struct {
			Body string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			jsonError(w, 400, "bad_request", "Invalid request body")
			return
		}
		if len(strings.TrimSpace(input.Body)) == 0 {
			jsonError(w, 400, "validation_error", "body is required")
			return
		}
		if len(input.Body) > 5000 {
			jsonError(w, 400, "validation_error", "body must be at most 5000 characters")
			return
		}
		if _, err := db.Exec("UPDATE comments SET body=$1 WHERE id=$2", input.Body, commentID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "updated"})
	case http.MethodDelete:
		// Count this comment + all its descendants (replies cascade-delete via FK),
		// so the post's comment_count is decremented by the right amount.
		var removed int
		if err := db.QueryRow(`
			WITH RECURSIVE thread AS (
				SELECT id FROM comments WHERE id = $1
				UNION ALL
				SELECT c.id FROM comments c JOIN thread t ON c.parent_id = t.id
			) SELECT COUNT(*) FROM thread`, commentID).Scan(&removed); err != nil || removed == 0 {
			removed = 1
		}

		tx, err := db.Begin()
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer tx.Rollback()
		if _, err := tx.Exec("DELETE FROM comments WHERE id=$1", commentID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		if _, err := tx.Exec("UPDATE posts SET comment_count = GREATEST(comment_count - $2, 0) WHERE id=$1", postID, removed); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		if err := tx.Commit(); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "deleted"})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// --- Bookmarks ---

func bookmarksHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query("SELECT b.user_id, b.post_id, p.title, p.slug, b.created_at FROM bookmarks b JOIN posts p ON b.post_id=p.id WHERE b.user_id=$1 ORDER BY b.created_at DESC", userID)

		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		var bms []Bookmark
		for rows.Next() {
			var b Bookmark
			if err := rows.Scan(&b.UserID, &b.PostID, &b.Title, &b.Slug, &b.CreatedAt); err != nil {
				continue
			}
			bms = append(bms, b)
		}
		if err := rows.Err(); err != nil {
			log.Printf("Bookmarks rows error: %v", err)
		}
		if bms == nil {
			bms = []Bookmark{}
		}
		jsonSuccess(w, 200, bms)
	case http.MethodPost:
		var input struct {
			PostID string `json:"post_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.PostID == "" {
			jsonError(w, 400, "bad_request", "post_id required")
			return
		}
		if _, err := db.Exec("INSERT INTO bookmarks (user_id, post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", userID, input.PostID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 201, map[string]string{"status": "bookmarked"})
	case http.MethodDelete:
		postID := r.URL.Query().Get("post_id")
		if postID == "" {
			jsonError(w, 400, "bad_request", "post_id required")
			return
		}
		if _, err := db.Exec("DELETE FROM bookmarks WHERE user_id=$1 AND post_id=$2", userID, postID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "removed"})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}

}

// --- Notifications ---

// createNotification inserts a notification for a user. It is best-effort (logs
// errors, never blocks the triggering action) and skips self-notifications.
// `kind` is one of: like, comment, follow, repost, mention.
func createNotification(recipientID, actorID, kind, title, body string) {
	if recipientID == "" || recipientID == actorID {
		return
	}
	if _, err := db.Exec(
		"INSERT INTO notifications (user_id, type, title, body) VALUES ($1,$2,$3,$4)",
		recipientID, kind, title, body,
	); err != nil {
		log.Printf("create notification error: %v", err)
	}
}

// displayName looks up a user's display name for use in notification text.
func displayName(userID string) string {
	var name string
	if err := db.QueryRow("SELECT display_name FROM users WHERE id=$1", userID).Scan(&name); err != nil {
		return "Someone"
	}
	return name
}

// notifyPostAuthor notifies the author of a post that an actor performed an
// action (like/repost/comment) on it. Best-effort; skips self-actions.
func notifyPostAuthor(postID, actorID, kind, verb string) {
	var authorID, title string
	if err := db.QueryRow("SELECT author_id, title FROM posts WHERE id=$1", postID).Scan(&authorID, &title); err != nil {
		return
	}
	if title == "" {
		title = "your post"
	}
	createNotification(authorID, actorID, kind, displayName(actorID)+" "+verb, title)
}

func notificationsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query("SELECT id, user_id, type, title, body, read, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", userID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		var notifs []Notification
		for rows.Next() {
			var n Notification
			if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &n.Read, &n.CreatedAt); err != nil {
				continue
			}
			notifs = append(notifs, n)
		}
		if err := rows.Err(); err != nil {
			log.Printf("Notifications rows error: %v", err)
		}
		if notifs == nil {
			notifs = []Notification{}
		}
		jsonSuccess(w, 200, notifs)
	case http.MethodPut:
		if _, err := db.Exec("UPDATE notifications SET read=true WHERE user_id=$1", userID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "all_read"})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// --- Follow/Unfollow ---

func followHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	var input struct {
		FollowingID string `json:"following_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.FollowingID == "" {
		jsonError(w, 400, "bad_request", "following_id required")
		return
	}
	if input.FollowingID == userID {
		jsonError(w, 400, "validation_error", "Cannot follow yourself")
		return
	}
	switch r.Method {
	case http.MethodPost:
		tx, err := db.Begin()
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer tx.Rollback()
		res, err := tx.Exec("INSERT INTO follows (follower_id, following_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", userID, input.FollowingID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		n, _ := res.RowsAffected()
		if n > 0 {
			if _, err := tx.Exec("UPDATE users SET follower_count = follower_count+1 WHERE id=$1", input.FollowingID); err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
			if _, err := tx.Exec("UPDATE users SET following_count = following_count+1 WHERE id=$1", userID); err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
		}
		if err := tx.Commit(); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		if n > 0 {
			createNotification(input.FollowingID, userID, "follow", displayName(userID)+" started following you", "")
		}
		jsonSuccess(w, 200, map[string]string{"status": "followed"})
	case http.MethodDelete:
		tx, err := db.Begin()
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer tx.Rollback()
		res, err := tx.Exec("DELETE FROM follows WHERE follower_id=$1 AND following_id=$2", userID, input.FollowingID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		n, _ := res.RowsAffected()
		if n > 0 {
			if _, err := tx.Exec("UPDATE users SET follower_count = GREATEST(follower_count-1,0) WHERE id=$1", input.FollowingID); err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
			if _, err := tx.Exec("UPDATE users SET following_count = GREATEST(following_count-1,0) WHERE id=$1", userID); err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
		}
		if err := tx.Commit(); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "unfollowed"})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// --- Likes ---

func likesHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	var input struct {
		PostID string `json:"post_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.PostID == "" {
		jsonError(w, 400, "bad_request", "post_id required")
		return
	}
	switch r.Method {
	case http.MethodPost:
		tx, err := db.Begin()
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer tx.Rollback()
		res, err := tx.Exec("INSERT INTO likes (user_id, post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", userID, input.PostID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		n, _ := res.RowsAffected()
		if n > 0 {
			if _, err := tx.Exec("UPDATE posts SET like_count = like_count+1 WHERE id=$1", input.PostID); err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
		}
		if err := tx.Commit(); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		if n > 0 {
			notifyPostAuthor(input.PostID, userID, "like", "liked your post")
		}
		jsonSuccess(w, 200, map[string]string{"status": "liked"})
	case http.MethodDelete:
		tx, err := db.Begin()
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer tx.Rollback()
		res, err := tx.Exec("DELETE FROM likes WHERE user_id=$1 AND post_id=$2", userID, input.PostID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		n, _ := res.RowsAffected()
		if n > 0 {
			if _, err := tx.Exec("UPDATE posts SET like_count = GREATEST(like_count-1,0) WHERE id=$1", input.PostID); err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
		}
		if err := tx.Commit(); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "unliked"})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// --- Jobs ---

func jobsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query("SELECT j.id, j.title, j.company_name, j.location, j.job_type, j.work_mode, j.description, j.salary_min, j.salary_max, j.status, j.created_at FROM jobs j WHERE j.status='open' ORDER BY j.created_at DESC LIMIT 50")
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		var jobs []Job
		for rows.Next() {
			var j Job
			if err := rows.Scan(&j.ID, &j.Title, &j.CompanyName, &j.Location, &j.JobType, &j.WorkMode, &j.Description, &j.SalaryMin, &j.SalaryMax, &j.Status, &j.CreatedAt); err != nil {
				continue
			}
			jobs = append(jobs, j)
		}
		if err := rows.Err(); err != nil {
			log.Printf("Jobs rows error: %v", err)
		}
		if jobs == nil {
			jobs = []Job{}
		}
		jsonSuccess(w, 200, jobs)

	case http.MethodPost:
		userID, err := extractUserID(r)

		if err != nil {
			jsonError(w, 401, "unauthorized", "Not authenticated")
			return
		}
		var input struct {
			Title       string `json:"title"`
			CompanyName string `json:"company_name"`
			Location    string `json:"location"`
			JobType     string `json:"job_type"`
			WorkMode    string `json:"work_mode"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			jsonError(w, 400, "bad_request", "Invalid request body")
			return
		}
		if input.Title == "" || len(input.Title) > 200 {
			jsonError(w, 400, "validation_error", "Title must be 1-200 characters")
			return
		}
		if input.CompanyName == "" || len(input.CompanyName) > 200 {
			jsonError(w, 400, "validation_error", "Company name must be 1-200 characters")
			return
		}
		if input.JobType == "" || len(input.JobType) > 50 {
			jsonError(w, 400, "validation_error", "Job type is required and must be at most 50 characters")
			return
		}
		if input.WorkMode == "" || len(input.WorkMode) > 50 {
			jsonError(w, 400, "validation_error", "Work mode is required and must be at most 50 characters")
			return
		}
		if input.Description == "" || len(input.Description) > 5000 {
			jsonError(w, 400, "validation_error", "Description must be 1-5000 characters")
			return
		}
		if len(input.Location) > 200 {
			jsonError(w, 400, "validation_error", "Location must be at most 200 characters")
			return
		}
		var id string
		err = db.QueryRow("INSERT INTO jobs (posted_by, title, company_name, location, job_type, work_mode, description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
			userID, input.Title, input.CompanyName, input.Location, input.JobType, input.WorkMode, input.Description).Scan(&id)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 201, map[string]string{"id": id})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}

}

// --- Newsletter ---

func newsletterHandler(w http.ResponseWriter, r *http.Request) {
	// Support both the bare path and sub-paths (/subscribe, /count), since
	// the frontend and docs use /api/v1/newsletter/subscribe and
	// /api/v1/newsletter/count while the route is registered at /api/v1/newsletter.
	sub := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/newsletter"), "/")
	switch r.Method {
	case http.MethodPost:
		var input struct {
			Email string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			jsonError(w, 400, "bad_request", "Invalid request body")
			return
		}
		if input.Email == "" || !validateEmail(input.Email) {
			jsonError(w, 400, "invalid_input", "A valid email is required")
			return
		}
		if _, err := db.Exec("INSERT INTO newsletter_subscriptions (email) VALUES ($1) ON CONFLICT DO NOTHING", input.Email); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		queueClient.PublishEmail(queue.EmailEvent{
			Type:    "newsletter_welcome",
			ToEmail: input.Email,
			Subject: "Welcome to IndieStack",
			Body:    "Thank you for subscribing to the IndieStack newsletter!",
		})
		jsonSuccess(w, 201, map[string]string{"status": "subscribed"})
	case http.MethodGet:
		var count int
		if err := db.QueryRow("SELECT COUNT(*) FROM newsletter_subscriptions").Scan(&count); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]int{"subscriber_count": count})
	default:
		_ = sub
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// --- Reading History ---

func historyHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(`SELECT rh.id, rh.post_id, p.title, p.slug, u.username, rh.read_at
			FROM reading_history rh
			JOIN posts p ON rh.post_id = p.id
			JOIN users u ON p.author_id = u.id
			WHERE rh.user_id = $1
			ORDER BY rh.read_at DESC LIMIT 50`, userID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		type HistoryItem struct {
			ID       string    `json:"id"`
			PostID   string    `json:"post_id"`
			Title    string    `json:"title"`
			Slug     string    `json:"slug"`
			Username string    `json:"author_username"`
			ReadAt   time.Time `json:"read_at"`
		}
		var items []HistoryItem
		for rows.Next() {
			var h HistoryItem
			if err := rows.Scan(&h.ID, &h.PostID, &h.Title, &h.Slug, &h.Username, &h.ReadAt); err != nil {
				continue
			}
			items = append(items, h)
		}
		if err := rows.Err(); err != nil {
			log.Printf("History rows error: %v", err)
		}
		if items == nil {
			items = []HistoryItem{}
		}
		jsonSuccess(w, 200, items)
	case http.MethodPost:
		var input struct {
			PostID string `json:"post_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.PostID == "" {
			jsonError(w, 400, "bad_request", "post_id required")
			return
		}
		if _, err := db.Exec(`INSERT INTO reading_history (user_id, post_id) VALUES ($1,$2)
			ON CONFLICT (user_id, post_id) DO UPDATE SET read_at = NOW()`, userID, input.PostID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "recorded"})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// --- Search ---

// searchHandler returns Medium-style grouped search results: stories, people,
// topics, publications, and lists. Publications and lists are not yet modeled
// in the schema, so they are returned as empty arrays (the UI shows them as
// "coming soon" placeholders).
func searchHandler(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		jsonError(w, 400, "missing_param", "q required")
		return
	}
	query := "%" + strings.ToLower(q) + "%"

	// --- Stories (posts) ---
	type storyResult struct {
		ID             string   `json:"id"`
		Slug           string   `json:"slug"`
		Title          string   `json:"title"`
		Excerpt        string   `json:"excerpt"`
		AuthorID       string   `json:"author_id"`
		AuthorUsername string   `json:"author_username"`
		AuthorName     string   `json:"author_name"`
		AuthorAvatar   string   `json:"author_avatar"`
		Tags           []string `json:"tags"`
		PublishedAt    *time.Time `json:"published_at"`
		LikeCount      int      `json:"like_count"`
	}
	stories := []storyResult{}
	rows, err := db.Query(`SELECT p.id, p.slug, p.title, COALESCE(p.excerpt,''), p.author_id,
			u.username, u.display_name, u.avatar_url, p.tags, p.published_at, p.like_count
		FROM posts p JOIN users u ON p.author_id = u.id
		WHERE p.status='published' AND (
			LOWER(p.title) LIKE $1 OR
			LOWER(COALESCE(p.excerpt,'')) LIKE $1 OR
			LOWER(p.content::text) LIKE $1 OR
			LOWER(COALESCE(p.tags::text,'')) LIKE $1
		)
		ORDER BY p.published_at DESC NULLS LAST LIMIT 20`, query)
	if err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	for rows.Next() {
		var s storyResult
		var tagsJSON []byte
		if err := rows.Scan(&s.ID, &s.Slug, &s.Title, &s.Excerpt, &s.AuthorID,
			&s.AuthorUsername, &s.AuthorName, &s.AuthorAvatar, &tagsJSON, &s.PublishedAt, &s.LikeCount); err != nil {
			continue
		}
		if len(tagsJSON) > 0 {
			_ = json.Unmarshal(tagsJSON, &s.Tags)
		}
		if s.Tags == nil {
			s.Tags = []string{}
		}
		stories = append(stories, s)
	}
	rows.Close()
	if stories == nil {
		stories = []storyResult{}
	}

	// --- People (users) ---
	// Matches users by name/bio, and also surfaces writers who have published
	// posts on the searched topic (matching tag, title, or excerpt) — like Medium.
	type personResult struct {
		ID            string `json:"id"`
		Username      string `json:"username"`
		DisplayName   string `json:"display_name"`
		Bio           string `json:"bio"`
		AvatarURL     string `json:"avatar_url"`
		FollowerCount int    `json:"follower_count"`
		IsVerified    bool   `json:"is_verified"`
	}
	people := []personResult{}
	rows2, err2 := db.Query(`SELECT u.id, u.username, u.display_name, COALESCE(u.bio,''), COALESCE(u.avatar_url,''),
			u.follower_count, u.is_verified
		FROM users u
		WHERE u.deactivated_at IS NULL AND (
			LOWER(u.username) LIKE $1 OR
			LOWER(u.display_name) LIKE $1 OR
			LOWER(COALESCE(u.bio,'')) LIKE $1 OR
			EXISTS (
				SELECT 1 FROM posts p
				WHERE p.author_id = u.id AND p.status = 'published' AND (
					LOWER(p.title) LIKE $1 OR
					LOWER(COALESCE(p.excerpt,'')) LIKE $1 OR
					LOWER(COALESCE(p.tags::text,'')) LIKE $1
				)
			)
		)
		ORDER BY u.follower_count DESC, u.username ASC LIMIT 20`, query)
	if err2 == nil {
		for rows2.Next() {
			var p personResult
			if err := rows2.Scan(&p.ID, &p.Username, &p.DisplayName, &p.Bio, &p.AvatarURL, &p.FollowerCount, &p.IsVerified); err == nil {
				people = append(people, p)
			}
		}
		rows2.Close()
	}
	if people == nil {
		people = []personResult{}
	}

	// --- Topics (tags) ---
	type topicResult struct {
		Tag   string `json:"tag"`
		Count int    `json:"count"`
	}
	topics := []topicResult{}
	rows3, err3 := db.Query(`SELECT value AS tag, COUNT(*) AS count
		FROM posts, jsonb_array_elements_text(posts.tags)
		WHERE posts.status = 'published' AND LOWER(value) LIKE $1
		GROUP BY value ORDER BY count DESC, tag ASC LIMIT 20`, query)
	if err3 == nil {
		for rows3.Next() {
			var t topicResult
			if err := rows3.Scan(&t.Tag, &t.Count); err == nil {
				topics = append(topics, t)
			}
		}
		rows3.Close()
	}
	if topics == nil {
		topics = []topicResult{}
	}

	// --- Publications ---
	type publicationResult struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Slug        string `json:"slug"`
		Description string `json:"description"`
		LogoURL     string `json:"logo_url"`
		FollowerCount int  `json:"follower_count"`
		PostCount     int  `json:"post_count"`
	}
	publications := []publicationResult{}
	rows4, err4 := db.Query(`
		SELECT p.id, p.name, p.slug, COALESCE(p.description,''), COALESCE(p.logo_url,''),
		       (SELECT COUNT(*) FROM publication_follows pf WHERE pf.publication_id = p.id),
		       (SELECT COUNT(*) FROM publication_posts pp WHERE pp.publication_id = p.id)
		FROM publications p
		WHERE LOWER(p.name) LIKE $1 OR LOWER(COALESCE(p.description,'')) LIKE $1
		ORDER BY p.created_at DESC LIMIT 20`, query)
	if err4 == nil {
		for rows4.Next() {
			var pub publicationResult
			if err := rows4.Scan(&pub.ID, &pub.Name, &pub.Slug, &pub.Description, &pub.LogoURL, &pub.FollowerCount, &pub.PostCount); err == nil {
				publications = append(publications, pub)
			}
		}
		rows4.Close()
	}
	if publications == nil {
		publications = []publicationResult{}
	}

	// --- Lists ---
	type listResult struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		OwnerUsername string `json:"owner_username"`
		OwnerName   string `json:"owner_name"`
		ItemCount   int    `json:"item_count"`
	}
	lists := []listResult{}
	rows5, err5 := db.Query(`
		SELECT l.id, l.name, COALESCE(l.description,''), u.username, u.display_name,
		       (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id)
		FROM lists l
		JOIN users u ON l.user_id = u.id
		WHERE l.is_public = true AND (LOWER(l.name) LIKE $1 OR LOWER(COALESCE(l.description,'')) LIKE $1)
		ORDER BY l.created_at DESC LIMIT 20`, query)
	if err5 == nil {
		for rows5.Next() {
			var li listResult
			if err := rows5.Scan(&li.ID, &li.Name, &li.Description, &li.OwnerUsername, &li.OwnerName, &li.ItemCount); err == nil {
				lists = append(lists, li)
			}
		}
		rows5.Close()
	}
	if lists == nil {
		lists = []listResult{}
	}

	jsonSuccess(w, 200, map[string]interface{}{
		"stories":      stories,
		"people":       people,
		"topics":       topics,
		"publications": publications,
		"lists":        lists,
	})
}

// --- Earnings ---

func earningsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	var tipTotal float64
	if err := db.QueryRow("SELECT COALESCE(SUM(amount),0) FROM tips WHERE recipient_id=$1 AND status='completed'", userID).Scan(&tipTotal); err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	jsonSuccess(w, 200, map[string]interface{}{
		"tips_total": tipTotal,
		"total":      tipTotal,
	})
}

// --- Stats (dashboard) ---

func statsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	var postCount, totalViews, totalLikes, followerCount int
	if err := db.QueryRow("SELECT COUNT(*) FROM posts WHERE author_id=$1", userID).Scan(&postCount); err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	if err := db.QueryRow("SELECT COALESCE(SUM(view_count),0) FROM posts WHERE author_id=$1", userID).Scan(&totalViews); err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	if err := db.QueryRow("SELECT COALESCE(SUM(like_count),0) FROM posts WHERE author_id=$1", userID).Scan(&totalLikes); err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	if err := db.QueryRow("SELECT COUNT(*) FROM follows WHERE following_id=$1", userID).Scan(&followerCount); err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	jsonSuccess(w, 200, map[string]int{
		"posts":     postCount,
		"views":     totalViews,
		"likes":     totalLikes,
		"followers": followerCount,
	})
}

// --- Reposts ---

// repostStateHandler returns whether the authenticated user has reposted a given post.
func repostStateHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	postID := r.URL.Query().Get("post_id")
	if postID == "" {
		jsonError(w, 400, "bad_request", "post_id required")
		return
	}
	var exists bool
	if err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM reposts WHERE user_id = $1 AND post_id = $2)", userID, postID).Scan(&exists); err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	jsonSuccess(w, 200, map[string]bool{"reposted": exists})
}

func repostsHandler(w http.ResponseWriter, r *http.Request) {
	// GET lists the posts a user has reposted. Supports ?username= to view any
	// public profile; otherwise falls back to the authenticated user.
	if r.Method == http.MethodGet {
		username := strings.TrimSpace(r.URL.Query().Get("username"))
		var targetID string
		if username != "" {
			if err := db.QueryRow("SELECT id FROM users WHERE username = $1", username).Scan(&targetID); err != nil {
				jsonError(w, 404, "not_found", "User not found")
				return
			}
		} else {
			uid, err := extractUserID(r)
			if err != nil {
				jsonError(w, 401, "unauthorized", "Not authenticated")
				return
			}
			targetID = uid
		}
		rows, err := db.Query(`
			SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
			 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
			 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
			 FROM reposts r
			 JOIN posts p ON p.id = r.post_id
			 JOIN users u ON p.author_id = u.id
			 WHERE r.user_id = $1 AND p.status = 'published'
			 ORDER BY r.created_at DESC
			 LIMIT 50`, targetID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		jsonSuccess(w, 200, scanFeedPosts(rows))
		return
	}

	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	switch r.Method {
	case http.MethodPost:
		var input struct {
			PostID string `json:"post_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.PostID == "" {
			jsonError(w, 400, "bad_request", "post_id required")
			return
		}
		tx, err := db.Begin()
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer tx.Rollback()
		res, err := tx.Exec("INSERT INTO reposts (user_id, post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", userID, input.PostID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			if _, err := tx.Exec("UPDATE posts SET repost_count = repost_count+1 WHERE id=$1", input.PostID); err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
		}
		if err := tx.Commit(); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			notifyPostAuthor(input.PostID, userID, "repost", "reposted your post")
		}
		jsonSuccess(w, 200, map[string]string{"status": "reposted"})
	case http.MethodDelete:
		postID := r.URL.Query().Get("post_id")
		if postID == "" {
			jsonError(w, 400, "bad_request", "post_id required")
			return
		}
		tx, err := db.Begin()
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer tx.Rollback()
		res, err := tx.Exec("DELETE FROM reposts WHERE user_id=$1 AND post_id=$2", userID, postID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			if _, err := tx.Exec("UPDATE posts SET repost_count = GREATEST(repost_count-1,0) WHERE id=$1", postID); err != nil {
				jsonError(w, 500, "db_error", err.Error())
				return
			}
		}
		if err := tx.Commit(); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "removed"})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// --- Mutes ---

func mutesHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(`SELECT u.id, u.username, u.display_name, u.avatar_url
			FROM mutes m JOIN users u ON m.muted_user_id = u.id
			WHERE m.user_id = $1 ORDER BY m.created_at DESC`, userID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		type mutedUser struct {
			ID          string `json:"id"`
			Username    string `json:"username"`
			DisplayName string `json:"display_name"`
			AvatarURL   string `json:"avatar_url"`
		}
		users := []mutedUser{}
		for rows.Next() {
			var u mutedUser
			if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.AvatarURL); err != nil {
				continue
			}
			users = append(users, u)
		}
		jsonSuccess(w, 200, users)
	case http.MethodPost:
		var input struct {
			MutedUserID string `json:"muted_user_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.MutedUserID == "" {
			jsonError(w, 400, "bad_request", "muted_user_id required")
			return
		}
		if input.MutedUserID == userID {
			jsonError(w, 400, "validation_error", "Cannot mute yourself")
			return
		}
		if _, err := db.Exec("INSERT INTO mutes (user_id, muted_user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", userID, input.MutedUserID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "muted"})
	case http.MethodDelete:
		mutedID := r.URL.Query().Get("muted_user_id")
		if mutedID == "" {
			jsonError(w, 400, "bad_request", "muted_user_id required")
			return
		}
		if _, err := db.Exec("DELETE FROM mutes WHERE user_id=$1 AND muted_user_id=$2", userID, mutedID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "unmuted"})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// --- Avatar Upload ---

func handleUploadAvatar(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 5<<20)
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "File too large (max 5MB)")
		return
	}

	file, handler, err := r.FormFile("avatar")
	if err != nil {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "No file provided. Use form field 'avatar'")
		return
	}
	defer file.Close()

	contentType := handler.Header.Get("Content-Type")
	if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/gif" && contentType != "image/webp" {
		jsonError(w, http.StatusBadRequest, "INVALID_TYPE", "Only JPG, PNG, GIF, and WebP images are allowed")
		return
	}

	// Read file into memory
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to read file")
		return
	}

	// Generate unique filename
	hash := sha256.Sum256(fileBytes)
	hashHex := hex.EncodeToString(hash[:])[:16]
	ext := ".jpg"
	if contentType == "image/png" {
		ext = ".png"
	} else if contentType == "image/gif" {
		ext = ".gif"
	} else if contentType == "image/webp" {
		ext = ".webp"
	}
	filename := fmt.Sprintf("avatar-%s%s", hashHex, ext)

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create upload directory")
		return
	}

	destPath := filepath.Join(uploadDir, filename)
	if err := os.WriteFile(destPath, fileBytes, 0644); err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to save file")
		return
	}

	// Store a RELATIVE path so the browser resolves it against the current origin
	// (Caddy proxies /uploads/* to this service).
	avatarURL := fmt.Sprintf("/uploads/%s", filename)

	if _, err := db.Exec("UPDATE users SET avatar_url = $1 WHERE id = $2", avatarURL, userID); err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update avatar")
		return
	}

	jsonSuccess(w, http.StatusOK, map[string]string{
		"url":        avatarURL,
		"avatar_url": avatarURL,
	})
}

// --- Reader Highlights ---

type PostHighlight struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	PostID    string    `json:"post_id"`
	Text      string    `json:"text"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"created_at"`
	// Joined fields for the highlights page.
	PostTitle      string `json:"post_title,omitempty"`
	PostSlug       string `json:"post_slug,omitempty"`
	AuthorUsername string `json:"author_username,omitempty"`
}

// highlightsHandler lists the current user's highlights (GET, optionally
// ?post_id=) and creates a new highlight (POST).
func highlightsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	switch r.Method {
	case http.MethodGet:
		postID := r.URL.Query().Get("post_id")
		query := `SELECT h.id, h.user_id, h.post_id, h.text, h.color, h.created_at,
		           p.title, p.slug, u.username
		    FROM post_highlights h
		    JOIN posts p ON p.id = h.post_id
		    JOIN users u ON u.id = p.author_id
		    WHERE h.user_id = $1`
		args := []interface{}{userID}
		if postID != "" {
			query += " AND h.post_id = $2"
			args = append(args, postID)
		}
		query += " ORDER BY h.created_at DESC LIMIT 200"
		rows, err := db.Query(query, args...)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		hl := []PostHighlight{}
		for rows.Next() {
			var h PostHighlight
			if err := rows.Scan(&h.ID, &h.UserID, &h.PostID, &h.Text, &h.Color, &h.CreatedAt,
				&h.PostTitle, &h.PostSlug, &h.AuthorUsername); err != nil {
				continue
			}
			hl = append(hl, h)
		}
		jsonSuccess(w, 200, hl)
	case http.MethodPost:
		var input struct {
			PostID string `json:"post_id"`
			Text   string `json:"text"`
			Color  string `json:"color"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			jsonError(w, 400, "bad_request", "Invalid request body")
			return
		}
		input.Text = strings.TrimSpace(input.Text)
		if input.PostID == "" || input.Text == "" {
			jsonError(w, 400, "validation_error", "post_id and text are required")
			return
		}
		if len(input.Text) > 2000 {
			jsonError(w, 400, "validation_error", "text must be at most 2000 characters")
			return
		}
		switch input.Color {
		case "yellow", "green", "blue", "pink":
		default:
			input.Color = "yellow"
		}
		var id string
		err := db.QueryRow(
			"INSERT INTO post_highlights (user_id, post_id, text, color) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, post_id, text) DO UPDATE SET color=EXCLUDED.color RETURNING id",
			userID, input.PostID, input.Text, input.Color,
		).Scan(&id)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 201, map[string]string{"id": id})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// highlightItemHandler deletes a single highlight owned by the current user.
func highlightItemHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	if r.Method != http.MethodDelete {
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
		return
	}
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/highlights/"), "/")
	if id == "" || strings.Contains(id, "/") {
		jsonError(w, 404, "not_found", "Not found")
		return
	}
	res, err := db.Exec("DELETE FROM post_highlights WHERE id=$1 AND user_id=$2", id, userID)
	if err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		jsonError(w, 404, "not_found", "Highlight not found")
		return
	}
	jsonSuccess(w, 200, map[string]string{"status": "deleted"})
}

// --- Register All Penmark Routes ---

func registerPenmarkRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/profiles/", profilesHandler)
	// Register specific comment routes BEFORE the general one
	// This ensures DELETE, PUT, and like operations work correctly
	mux.HandleFunc("/api/v1/comments/", commentItemHandler)
	mux.HandleFunc("/api/v1/comments", commentsHandler)
	mux.HandleFunc("/api/v1/bookmarks", bookmarksHandler)
	mux.HandleFunc("/api/v1/notifications", notificationsHandler)
	mux.HandleFunc("/api/v1/follow", followHandler)
	mux.HandleFunc("/api/v1/likes", likesHandler)
	mux.HandleFunc("/api/v1/reposts", repostsHandler)
	mux.HandleFunc("/api/v1/reposts/state", repostStateHandler)
	mux.HandleFunc("/api/v1/mutes", mutesHandler)
	mux.HandleFunc("/api/v1/jobs", jobsHandler)
	mux.HandleFunc("/api/v1/newsletter", newsletterHandler)
	mux.HandleFunc("/api/v1/newsletter/", newsletterHandler)
	mux.HandleFunc("/api/v1/history", historyHandler)
	mux.HandleFunc("/api/v1/highlights", highlightsHandler)
	mux.HandleFunc("/api/v1/highlights/", highlightItemHandler)
	mux.HandleFunc("/api/v1/search", searchHandler)
	mux.HandleFunc("/api/v1/earnings", earningsHandler)
	mux.HandleFunc("/api/v1/stats", statsHandler)
	mux.HandleFunc("/api/v1/avatars/upload", handleUploadAvatar)
	mux.HandleFunc("/api/v1/publications", publicationsHandler)
	mux.HandleFunc("/api/v1/publications/", publicationItemHandler)
	mux.HandleFunc("/api/v1/lists", listsHandler)
	mux.HandleFunc("/api/v1/lists/", listItemHandler)
	mux.HandleFunc("/api/v1/claps", clapsHandler)
	mux.HandleFunc("/api/v1/claps/", clapCountHandler)
	mux.HandleFunc("/api/v1/responses", responsesHandler)
	mux.HandleFunc("/api/v1/reports", reportsHandler)
	mux.HandleFunc("/api/v1/reports/", reportItemHandler)
	fmt.Println("Penmark routes registered (14 new endpoints)")
}
