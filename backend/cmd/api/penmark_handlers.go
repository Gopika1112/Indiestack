package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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
		rows, err := db.Query("SELECT c.id, c.post_id, c.user_id, c.parent_id, c.body, u.username, c.created_at FROM comments c JOIN users u ON c.user_id=u.id WHERE c.post_id=$1 ORDER BY c.created_at", postID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		var comments []Comment
		for rows.Next() {
			var c Comment
			if err := rows.Scan(&c.ID, &c.PostID, &c.UserID, &c.ParentID, &c.Body, &c.Username, &c.CreatedAt); err != nil {
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
		jsonSuccess(w, 201, map[string]string{"id": id})
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
		rows, err := db.Query("SELECT rh.id, rh.post_id, p.title, p.slug, rh.read_at FROM reading_history rh JOIN posts p ON rh.post_id=p.id WHERE rh.user_id=$1 ORDER BY rh.read_at DESC LIMIT 50", userID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		type HistoryItem struct {
			ID     string    `json:"id"`
			PostID string    `json:"post_id"`
			Title  string    `json:"title"`
			Slug   string    `json:"slug"`
			ReadAt time.Time `json:"read_at"`
		}
		var items []HistoryItem
		for rows.Next() {
			var h HistoryItem
			if err := rows.Scan(&h.ID, &h.PostID, &h.Title, &h.Slug, &h.ReadAt); err != nil {
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
		if _, err := db.Exec("INSERT INTO reading_history (user_id, post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", userID, input.PostID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "recorded"})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// --- Search ---

func searchHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		jsonError(w, 400, "missing_param", "q required")
		return
	}
	query := "%" + strings.ToLower(q) + "%"
	rows, err := db.Query("SELECT id, slug, title, excerpt, author_id FROM posts WHERE status='published' AND (LOWER(title) LIKE $1 OR LOWER(excerpt) LIKE $1) ORDER BY published_at DESC LIMIT 20", query)
	if err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	defer rows.Close()
	type SearchResult struct {
		ID       string `json:"id"`
		Slug     string `json:"slug"`
		Title    string `json:"title"`
		Excerpt  string `json:"excerpt"`
		AuthorID string `json:"author_id"`
	}
	var results []SearchResult
	for rows.Next() {
		var s SearchResult
		if err := rows.Scan(&s.ID, &s.Slug, &s.Title, &s.Excerpt, &s.AuthorID); err != nil {
			continue
		}
		results = append(results, s)
	}
	if err := rows.Err(); err != nil {
		log.Printf("Search rows error: %v", err)
	}
	if results == nil {
		results = []SearchResult{}
	}
	jsonSuccess(w, 200, results)
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
	if err := db.QueryRow("SELECT follower_count FROM users WHERE id=$1", userID).Scan(&followerCount); err != nil {
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

// --- Register All Penmark Routes ---

func registerPenmarkRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/profiles/", profilesHandler)
	mux.HandleFunc("/api/v1/comments", commentsHandler)
	mux.HandleFunc("/api/v1/bookmarks", bookmarksHandler)
	mux.HandleFunc("/api/v1/notifications", notificationsHandler)
	mux.HandleFunc("/api/v1/follow", followHandler)
	mux.HandleFunc("/api/v1/likes", likesHandler)
	mux.HandleFunc("/api/v1/jobs", jobsHandler)
	mux.HandleFunc("/api/v1/newsletter", newsletterHandler)
	mux.HandleFunc("/api/v1/history", historyHandler)
	mux.HandleFunc("/api/v1/search", searchHandler)
	mux.HandleFunc("/api/v1/earnings", earningsHandler)
	mux.HandleFunc("/api/v1/stats", statsHandler)
	fmt.Println("Penmark routes registered (12 new endpoints)")
}
