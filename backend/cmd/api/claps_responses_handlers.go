package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

// --- Claps ---
//
// Medium-style applause: each user can clap 1-50 times per post.
// The posts.clap_count column caches the total for fast reads.

func clapsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}

	switch r.Method {
	case http.MethodPost:
		var input struct {
			PostID string `json:"post_id"`
			Count  int    `json:"count"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.PostID == "" {
			jsonError(w, 400, "bad_request", "post_id required")
			return
		}
		if input.Count < 1 {
			input.Count = 1
		}
		if input.Count > 50 {
			input.Count = 50
		}

		// Upsert: if the user already clapped, add to their count (capped at 50).
		var existingCount int
		err := db.QueryRow("SELECT count FROM claps WHERE user_id = $1 AND post_id = $2", userID, input.PostID).Scan(&existingCount)
		if err != nil {
			// No existing clap — insert.
			existingCount = 0
		}

		newCount := existingCount + input.Count
		if newCount > 50 {
			newCount = 50
		}

		tx, err := db.Begin()
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer tx.Rollback()

		if existingCount == 0 {
			_, err = tx.Exec("INSERT INTO claps (user_id, post_id, count) VALUES ($1, $2, $3)", userID, input.PostID, newCount)
		} else {
			_, err = tx.Exec("UPDATE claps SET count = $1, updated_at = NOW() WHERE user_id = $2 AND post_id = $3", newCount, userID, input.PostID)
		}
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}

		// Update the cached clap_count on the post.
		if _, err := tx.Exec(`
			UPDATE posts SET clap_count = (
				SELECT COALESCE(SUM(count), 0) FROM claps WHERE post_id = $1
			) WHERE id = $1`, input.PostID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}

		if err := tx.Commit(); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}

		// Notify the author about the clap (only on the first clap, not every click).
		if existingCount == 0 {
			notifyPostAuthor(input.PostID, userID, "clap", "clapped for your post")
		}

		jsonSuccess(w, 200, map[string]interface{}{
			"status":     "clapped",
			"user_count": newCount,
			"total":      newCount, // will be updated below
		})

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

		if _, err := tx.Exec("DELETE FROM claps WHERE user_id = $1 AND post_id = $2", userID, postID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}

		if _, err := tx.Exec(`
			UPDATE posts SET clap_count = (
				SELECT COALESCE(SUM(count), 0) FROM claps WHERE post_id = $1
			) WHERE id = $1`, postID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
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

// clapCountHandler returns the total claps for a post and the current user's clap count.
func clapCountHandler(w http.ResponseWriter, r *http.Request) {
	postID := strings.TrimPrefix(r.URL.Path, "/api/v1/claps/")
	if postID == "" {
		jsonError(w, 400, "bad_request", "post_id required")
		return
	}

	var total int
	if err := db.QueryRow("SELECT clap_count FROM posts WHERE id = $1", postID).Scan(&total); err != nil {
		jsonError(w, 404, "not_found", "Post not found")
		return
	}

	userClaps := 0
	if userID, err := extractUserID(r); err == nil {
		_ = db.QueryRow("SELECT count FROM claps WHERE user_id = $1 AND post_id = $2", userID, postID).Scan(&userClaps)
	}

	jsonSuccess(w, 200, map[string]interface{}{
		"total":      total,
		"user_count": userClaps,
	})
}

// --- Responses ---
//
// A response is a post that replies to another post. It's stored in the posts
// table with parent_post_id set to the original post's ID.

// responsesHandler handles GET /api/v1/responses?post_id= (list responses)
// and POST /api/v1/responses (create a response).
func responsesHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		postID := r.URL.Query().Get("post_id")
		if postID == "" {
			jsonError(w, 400, "bad_request", "post_id required")
			return
		}
		rows, err := db.Query(`
			SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
			 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
			 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
			FROM posts p
			JOIN users u ON p.author_id = u.id
			WHERE p.parent_post_id = $1 AND p.status = 'published'
			ORDER BY p.published_at DESC NULLS LAST
			LIMIT 50`, postID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		jsonSuccess(w, 200, scanFeedPosts(rows))

	case http.MethodPost:
		userID, scopes, err := extractAuth(r)
		if err != nil {
			jsonError(w, 401, "unauthorized", "Not authenticated")
			return
		}
		if !hasScope(scopes, "posts:write") {
			jsonError(w, 403, "forbidden", "Insufficient scope: posts:write required")
			return
		}

		var input struct {
			ParentPostID string                 `json:"parent_post_id"`
			Title        string                 `json:"title"`
			Content      map[string]interface{} `json:"content"`
			Excerpt      string                 `json:"excerpt"`
			Tags         []string               `json:"tags"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			jsonError(w, 400, "bad_request", "Invalid request body")
			return
		}
		if input.ParentPostID == "" {
			jsonError(w, 400, "bad_request", "parent_post_id required")
			return
		}
		if len(input.Title) == 0 || len(input.Title) > 300 {
			jsonError(w, 400, "validation_error", "Title must be 1-300 characters")
			return
		}

		// Verify parent post exists and is published.
		var parentStatus string
		if err := db.QueryRow("SELECT status FROM posts WHERE id = $1", input.ParentPostID).Scan(&parentStatus); err != nil {
			jsonError(w, 404, "not_found", "Parent post not found")
			return
		}
		if parentStatus != "published" {
			jsonError(w, 400, "bad_request", "Cannot respond to an unpublished post")
			return
		}

		// Create the response as a post with parent_post_id.
		postID := ""
		slug := strings.ToLower(strings.ReplaceAll(input.Title, " ", "-"))
		slug = uniqueSlugForAuthor(userID, slug)

		contentJSON, _ := json.Marshal(input.Content)
		wordCount := len(strings.Fields(extractTextFromTipTap(input.Content)))
		readingTime := wordCount/200 + 1
		excerpt := strings.TrimSpace(input.Excerpt)
		if excerpt == "" {
			excerpt = autoExcerpt(input.Content)
		}
		tags := input.Tags
		if tags == nil {
			tags = []string{}
		}
		tagsJSON, _ := json.Marshal(tags)

		err = db.QueryRow(`
			INSERT INTO posts (id, author_id, slug, title, content, excerpt, tags,
				reading_time_minutes, word_count, status, published_at, parent_post_id, created_at, updated_at)
			VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4::jsonb, $5, $6::jsonb,
				$7, $8, 'published', NOW(), $9::uuid, NOW(), NOW())
			RETURNING id`,
			userID, slug, input.Title, contentJSON, excerpt, tagsJSON,
			readingTime, wordCount, input.ParentPostID).Scan(&postID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}

		// Notify the parent post's author about the response.
		notifyPostAuthor(input.ParentPostID, userID, "response", "responded to your post")

		jsonSuccess(w, 201, map[string]string{"id": postID, "slug": slug})

	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}
