package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

// --- Lists ---
//
// A list is a user-created collection of posts (like Medium's reading lists).
// Lists can be public (visible in search) or private.

type readingList struct {
	ID          string `json:"id"`
	UserID      string `json:"user_id"`
	OwnerUsername string `json:"owner_username"`
	OwnerName   string `json:"owner_name"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPublic    bool   `json:"is_public"`
	ItemCount   int    `json:"item_count"`
	CreatedAt   string `json:"created_at"`
}

// listsHandler handles GET /api/v1/lists (list public or mine) and
// POST /api/v1/lists (create).
func listsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		listLists(w, r)
	case http.MethodPost:
		createList(w, r)
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// listItemHandler handles GET /api/v1/lists/{id} (detail),
// PUT (update), DELETE (delete), and item sub-routes.
func listItemHandler(w http.ResponseWriter, r *http.Request) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/lists/"), "/")
	parts := strings.Split(rest, "/")
	if len(parts) == 0 || parts[0] == "" {
		jsonError(w, 404, "not_found", "Not found")
		return
	}
	listID := parts[0]

	if len(parts) >= 2 && parts[1] == "items" {
		listItemsHandler(w, r, listID)
		return
	}

	switch r.Method {
	case http.MethodGet:
		getList(w, r, listID)
	case http.MethodPut:
		updateList(w, r, listID)
	case http.MethodDelete:
		deleteList(w, r, listID)
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

func listLists(w http.ResponseWriter, r *http.Request) {
	// ?mine=1 returns only the authenticated user's lists.
	if r.URL.Query().Get("mine") == "1" {
		userID, err := extractUserID(r)
		if err != nil {
			jsonError(w, 401, "unauthorized", "Not authenticated")
			return
		}
		rows, err := db.Query(`
			SELECT l.id, l.user_id, u.username, u.display_name, l.name, COALESCE(l.description,''),
			       l.is_public,
			       (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id),
			       l.created_at
			FROM lists l
			JOIN users u ON l.user_id = u.id
			WHERE l.user_id = $1
			ORDER BY l.created_at DESC
			LIMIT 100`, userID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		out := []readingList{}
		for rows.Next() {
			var l readingList
			if err := rows.Scan(&l.ID, &l.UserID, &l.OwnerUsername, &l.OwnerName, &l.Name, &l.Description, &l.IsPublic, &l.ItemCount, &l.CreatedAt); err != nil {
				continue
			}
			out = append(out, l)
		}
		if out == nil {
			out = []readingList{}
		}
		jsonSuccess(w, 200, out)
		return
	}

	// Default: public lists only.
	rows, err := db.Query(`
		SELECT l.id, l.user_id, u.username, u.display_name, l.name, COALESCE(l.description,''),
		       l.is_public,
		       (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id),
		       l.created_at
		FROM lists l
		JOIN users u ON l.user_id = u.id
		WHERE l.is_public = true
		ORDER BY l.created_at DESC
		LIMIT 100`)
	if err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	defer rows.Close()
	out := []readingList{}
	for rows.Next() {
		var l readingList
		if err := rows.Scan(&l.ID, &l.UserID, &l.OwnerUsername, &l.OwnerName, &l.Name, &l.Description, &l.IsPublic, &l.ItemCount, &l.CreatedAt); err != nil {
			continue
		}
		out = append(out, l)
	}
	if out == nil {
		out = []readingList{}
	}
	jsonSuccess(w, 200, out)
}

func getList(w http.ResponseWriter, r *http.Request, listID string) {
	var l readingList
	err := db.QueryRow(`
		SELECT l.id, l.user_id, u.username, u.display_name, l.name, COALESCE(l.description,''),
		       l.is_public,
		       (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id),
		       l.created_at
		FROM lists l
		JOIN users u ON l.user_id = u.id
		WHERE l.id = $1`, listID).
		Scan(&l.ID, &l.UserID, &l.OwnerUsername, &l.OwnerName, &l.Name, &l.Description, &l.IsPublic, &l.ItemCount, &l.CreatedAt)
	if err != nil {
		jsonError(w, 404, "not_found", "List not found")
		return
	}
	// Private lists are only visible to the owner.
	if !l.IsPublic {
		viewerID, err := extractUserID(r)
		if err != nil || viewerID != l.UserID {
			jsonError(w, 404, "not_found", "List not found")
			return
		}
	}
	jsonSuccess(w, 200, l)
}

func createList(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	var input struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		IsPublic    *bool  `json:"is_public"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, 400, "bad_request", "Invalid request body")
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		jsonError(w, 400, "validation_error", "name is required")
		return
	}
	isPublic := true
	if input.IsPublic != nil {
		isPublic = *input.IsPublic
	}
	var id string
	err = db.QueryRow(`
		INSERT INTO lists (user_id, name, description, is_public)
		VALUES ($1, $2, $3, $4)
		RETURNING id`,
		userID, input.Name, input.Description, isPublic).Scan(&id)
	if err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	jsonSuccess(w, 201, map[string]string{"id": id})
}

func updateList(w http.ResponseWriter, r *http.Request, listID string) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	var ownerID string
	if err := db.QueryRow("SELECT user_id FROM lists WHERE id = $1", listID).Scan(&ownerID); err != nil {
		jsonError(w, 404, "not_found", "List not found")
		return
	}
	if ownerID != userID {
		jsonError(w, 403, "forbidden", "Only the owner can update this list")
		return
	}
	var input struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		IsPublic    *bool   `json:"is_public"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, 400, "bad_request", "Invalid request body")
		return
	}
	sets := []string{}
	args := []interface{}{}
	idx := 1
	if input.Name != nil {
		sets = append(sets, "name = $"+itoa(idx))
		args = append(args, *input.Name)
		idx++
	}
	if input.Description != nil {
		sets = append(sets, "description = $"+itoa(idx))
		args = append(args, *input.Description)
		idx++
	}
	if input.IsPublic != nil {
		sets = append(sets, "is_public = $"+itoa(idx))
		args = append(args, *input.IsPublic)
		idx++
	}
	if len(sets) == 0 {
		jsonError(w, 400, "bad_request", "No fields to update")
		return
	}
	sets = append(sets, "updated_at = NOW()")
	args = append(args, listID)
	query := "UPDATE lists SET " + strings.Join(sets, ", ") + " WHERE id = $" + itoa(idx)
	if _, err := db.Exec(query, args...); err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	jsonSuccess(w, 200, map[string]string{"status": "updated"})
}

func deleteList(w http.ResponseWriter, r *http.Request, listID string) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	var ownerID string
	if err := db.QueryRow("SELECT user_id FROM lists WHERE id = $1", listID).Scan(&ownerID); err != nil {
		jsonError(w, 404, "not_found", "List not found")
		return
	}
	if ownerID != userID {
		jsonError(w, 403, "forbidden", "Only the owner can delete this list")
		return
	}
	if _, err := db.Exec("DELETE FROM lists WHERE id = $1", listID); err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	jsonSuccess(w, 200, map[string]string{"status": "deleted"})
}

// listItemsHandler handles GET /lists/{id}/items (list posts) and
// POST /lists/{id}/items (add a post), DELETE /lists/{id}/items?post_id= (remove).
func listItemsHandler(w http.ResponseWriter, r *http.Request, listID string) {
	// Verify list exists and check visibility.
	var ownerID string
	var isPublic bool
	if err := db.QueryRow("SELECT user_id, is_public FROM lists WHERE id = $1", listID).Scan(&ownerID, &isPublic); err != nil {
		jsonError(w, 404, "not_found", "List not found")
		return
	}

	switch r.Method {
	case http.MethodGet:
		// Private lists are only visible to the owner.
		if !isPublic {
			viewerID, err := extractUserID(r)
			if err != nil || viewerID != ownerID {
				jsonError(w, 404, "not_found", "List not found")
				return
			}
		}
		rows, err := db.Query(`
			SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
			 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
			 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
			FROM list_items li
			JOIN posts p ON p.id = li.post_id
			JOIN users u ON p.author_id = u.id
			WHERE li.list_id = $1 AND p.status = 'published'
			ORDER BY li.created_at DESC
			LIMIT 100`, listID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		jsonSuccess(w, 200, scanFeedPosts(rows))

	case http.MethodPost:
		userID, err := extractUserID(r)
		if err != nil {
			jsonError(w, 401, "unauthorized", "Not authenticated")
			return
		}
		if userID != ownerID {
			jsonError(w, 403, "forbidden", "Only the owner can add items to this list")
			return
		}
		var input struct {
			PostID string `json:"post_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.PostID == "" {
			jsonError(w, 400, "bad_request", "post_id required")
			return
		}
		if _, err := db.Exec(`INSERT INTO list_items (list_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, listID, input.PostID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "added"})

	case http.MethodDelete:
		userID, err := extractUserID(r)
		if err != nil {
			jsonError(w, 401, "unauthorized", "Not authenticated")
			return
		}
		if userID != ownerID {
			jsonError(w, 403, "forbidden", "Only the owner can remove items from this list")
			return
		}
		postID := r.URL.Query().Get("post_id")
		if postID == "" {
			jsonError(w, 400, "bad_request", "post_id required")
			return
		}
		if _, err := db.Exec(`DELETE FROM list_items WHERE list_id = $1 AND post_id = $2`, listID, postID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "removed"})

	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}
