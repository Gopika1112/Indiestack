package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

// --- Publications ---
//
// A publication is a multi-author magazine. Users can create a publication,
// add writers/editors, submit posts to it, and follow it. This mirrors Medium's
// publication model.

type publication struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	LogoURL     string `json:"logo_url"`
	OwnerID     string `json:"owner_id"`
	OwnerName   string `json:"owner_name"`
	FollowerCount int  `json:"follower_count"`
	PostCount     int  `json:"post_count"`
	CreatedAt   string `json:"created_at"`
}

// publicationsHandler handles GET /api/v1/publications (list) and
// POST /api/v1/publications (create).
func publicationsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		listPublications(w, r)
	case http.MethodPost:
		createPublication(w, r)
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// publicationItemHandler handles GET /api/v1/publications/{slug} (detail),
// PUT (update), DELETE (delete), and follow/unfollow via sub-routes.
func publicationItemHandler(w http.ResponseWriter, r *http.Request) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/publications/"), "/")
	parts := strings.Split(rest, "/")
	if len(parts) == 0 || parts[0] == "" {
		jsonError(w, 404, "not_found", "Not found")
		return
	}
	slug := parts[0]

	// Sub-routes: /{slug}/posts, /{slug}/follow, /{slug}/members
	if len(parts) >= 2 {
		switch parts[1] {
		case "posts":
			publicationPostsHandler(w, r, slug)
			return
		case "follow":
			publicationFollowHandler(w, r, slug)
			return
		case "members":
			publicationMembersHandler(w, r, slug)
			return
		}
	}

	switch r.Method {
	case http.MethodGet:
		getPublication(w, r, slug)
	case http.MethodPut:
		updatePublication(w, r, slug)
	case http.MethodDelete:
		deletePublication(w, r, slug)
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

func listPublications(w http.ResponseWriter, r *http.Request) {
	// ?mine=1 returns only publications the authenticated user is a member of.
	if r.URL.Query().Get("mine") == "1" {
		userID, err := extractUserID(r)
		if err != nil {
			jsonError(w, 401, "unauthorized", "Not authenticated")
			return
		}
		rows, err := db.Query(`
			SELECT p.id, p.name, p.slug, COALESCE(p.description,''), COALESCE(p.logo_url,''),
			       p.owner_id, u.display_name,
			       (SELECT COUNT(*) FROM publication_follows pf WHERE pf.publication_id = p.id),
			       (SELECT COUNT(*) FROM publication_posts pp WHERE pp.publication_id = p.id),
			       p.created_at
			FROM publications p
			JOIN users u ON p.owner_id = u.id
			JOIN publication_members pm ON pm.publication_id = p.id
			WHERE pm.user_id = $1
			ORDER BY p.created_at DESC
			LIMIT 100`, userID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		out := []publication{}
		for rows.Next() {
			var p publication
			if err := rows.Scan(&p.ID, &p.Name, &p.Slug, &p.Description, &p.LogoURL,
				&p.OwnerID, &p.OwnerName, &p.FollowerCount, &p.PostCount, &p.CreatedAt); err != nil {
				continue
			}
			out = append(out, p)
		}
		if out == nil {
			out = []publication{}
		}
		jsonSuccess(w, 200, out)
		return
	}

	rows, err := db.Query(`
		SELECT p.id, p.name, p.slug, COALESCE(p.description,''), COALESCE(p.logo_url,''),
		       p.owner_id, u.display_name,
		       (SELECT COUNT(*) FROM publication_follows pf WHERE pf.publication_id = p.id) AS follower_count,
		       (SELECT COUNT(*) FROM publication_posts pp WHERE pp.publication_id = p.id) AS post_count,
		       p.created_at
		FROM publications p
		JOIN users u ON p.owner_id = u.id
		ORDER BY follower_count DESC, p.created_at DESC
		LIMIT 100`)
	if err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	defer rows.Close()

	out := []publication{}
	for rows.Next() {
		var p publication
		if err := rows.Scan(&p.ID, &p.Name, &p.Slug, &p.Description, &p.LogoURL,
			&p.OwnerID, &p.OwnerName, &p.FollowerCount, &p.PostCount, &p.CreatedAt); err != nil {
			continue
		}
		out = append(out, p)
	}
	if out == nil {
		out = []publication{}
	}
	jsonSuccess(w, 200, out)
}

func getPublication(w http.ResponseWriter, r *http.Request, slug string) {
	var p publication
	err := db.QueryRow(`
		SELECT p.id, p.name, p.slug, COALESCE(p.description,''), COALESCE(p.logo_url,''),
		       p.owner_id, u.display_name,
		       (SELECT COUNT(*) FROM publication_follows pf WHERE pf.publication_id = p.id),
		       (SELECT COUNT(*) FROM publication_posts pp WHERE pp.publication_id = p.id),
		       p.created_at
		FROM publications p
		JOIN users u ON p.owner_id = u.id
		WHERE p.slug = $1`, slug).
		Scan(&p.ID, &p.Name, &p.Slug, &p.Description, &p.LogoURL,
			&p.OwnerID, &p.OwnerName, &p.FollowerCount, &p.PostCount, &p.CreatedAt)
	if err != nil {
		jsonError(w, 404, "not_found", "Publication not found")
		return
	}
	jsonSuccess(w, 200, p)
}

func createPublication(w http.ResponseWriter, r *http.Request) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	var input struct {
		Name        string `json:"name"`
		Slug        string `json:"slug"`
		Description string `json:"description"`
		LogoURL     string `json:"logo_url"`
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
	slug := strings.TrimSpace(input.Slug)
	if slug == "" {
		slug = strings.ToLower(strings.ReplaceAll(input.Name, " ", "-"))
	}
	slug = strings.ToLower(strings.ReplaceAll(slug, " ", "-"))

	var id string
	err = db.QueryRow(`
		INSERT INTO publications (name, slug, description, logo_url, owner_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`,
		input.Name, slug, input.Description, input.LogoURL, userID).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			jsonError(w, 409, "conflict", "A publication with this slug already exists")
			return
		}
		jsonError(w, 500, "db_error", err.Error())
		return
	}

	// Owner is automatically a member with role 'owner'.
	if _, err := db.Exec(`INSERT INTO publication_members (publication_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`, id, userID); err != nil {
		log.Printf("add owner member error: %v", err)
	}

	jsonSuccess(w, 201, map[string]string{"id": id, "slug": slug})
}

func updatePublication(w http.ResponseWriter, r *http.Request, slug string) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	// Only the owner can update.
	var ownerID string
	if err := db.QueryRow("SELECT owner_id FROM publications WHERE slug = $1", slug).Scan(&ownerID); err != nil {
		jsonError(w, 404, "not_found", "Publication not found")
		return
	}
	if ownerID != userID {
		jsonError(w, 403, "forbidden", "Only the owner can update this publication")
		return
	}

	var input struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		LogoURL     *string `json:"logo_url"`
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
	if input.LogoURL != nil {
		sets = append(sets, "logo_url = $"+itoa(idx))
		args = append(args, *input.LogoURL)
		idx++
	}
	if len(sets) == 0 {
		jsonError(w, 400, "bad_request", "No fields to update")
		return
	}
	sets = append(sets, "updated_at = NOW()")
	args = append(args, slug)
	query := "UPDATE publications SET " + strings.Join(sets, ", ") + " WHERE slug = $" + itoa(idx)
	if _, err := db.Exec(query, args...); err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	jsonSuccess(w, 200, map[string]string{"status": "updated"})
}

func deletePublication(w http.ResponseWriter, r *http.Request, slug string) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	var ownerID string
	if err := db.QueryRow("SELECT owner_id FROM publications WHERE slug = $1", slug).Scan(&ownerID); err != nil {
		jsonError(w, 404, "not_found", "Publication not found")
		return
	}
	if ownerID != userID {
		jsonError(w, 403, "forbidden", "Only the owner can delete this publication")
		return
	}
	if _, err := db.Exec("DELETE FROM publications WHERE slug = $1", slug); err != nil {
		jsonError(w, 500, "db_error", err.Error())
		return
	}
	jsonSuccess(w, 200, map[string]string{"status": "deleted"})
}

// publicationPostsHandler lists posts published under a publication, and
// allows members to add a post to the publication.
func publicationPostsHandler(w http.ResponseWriter, r *http.Request, slug string) {
	var pubID string
	if err := db.QueryRow("SELECT id FROM publications WHERE slug = $1", slug).Scan(&pubID); err != nil {
		jsonError(w, 404, "not_found", "Publication not found")
		return
	}

	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(`
			SELECT p.id, p.author_id, u.username, u.display_name, u.avatar_url,
			 p.slug, p.title, p.excerpt, p.tags, p.cover_image_url, p.reading_time_minutes,
			 p.published_at, p.view_count, p.like_count, p.is_premium, p.status, p.created_at
			FROM publication_posts pp
			JOIN posts p ON p.id = pp.post_id
			JOIN users u ON p.author_id = u.id
			WHERE pp.publication_id = $1 AND p.status = 'published'
			ORDER BY pp.created_at DESC
			LIMIT 100`, pubID)
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
		// Must be a member (owner/editor/writer).
		var role string
		if err := db.QueryRow("SELECT role FROM publication_members WHERE publication_id = $1 AND user_id = $2", pubID, userID).Scan(&role); err != nil {
			jsonError(w, 403, "forbidden", "You are not a member of this publication")
			return
		}
		var input struct {
			PostID string `json:"post_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.PostID == "" {
			jsonError(w, 400, "bad_request", "post_id required")
			return
		}
		if _, err := db.Exec(`INSERT INTO publication_posts (publication_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, pubID, input.PostID); err != nil {
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
		// Only the owner can remove posts from the publication.
		var ownerID string
		if err := db.QueryRow("SELECT owner_id FROM publications WHERE id = $1", pubID).Scan(&ownerID); err != nil {
			jsonError(w, 404, "not_found", "Publication not found")
			return
		}
		if userID != ownerID {
			jsonError(w, 403, "forbidden", "Only the owner can remove posts from this publication")
			return
		}
		postID := r.URL.Query().Get("post_id")
		if postID == "" {
			jsonError(w, 400, "bad_request", "post_id required")
			return
		}
		if _, err := db.Exec(`DELETE FROM publication_posts WHERE publication_id = $1 AND post_id = $2`, pubID, postID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "removed"})

	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// publicationFollowHandler follows/unfollows a publication.
func publicationFollowHandler(w http.ResponseWriter, r *http.Request, slug string) {
	userID, err := extractUserID(r)
	if err != nil {
		jsonError(w, 401, "unauthorized", "Not authenticated")
		return
	}
	var pubID string
	if err := db.QueryRow("SELECT id FROM publications WHERE slug = $1", slug).Scan(&pubID); err != nil {
		jsonError(w, 404, "not_found", "Publication not found")
		return
	}
	switch r.Method {
	case http.MethodPost:
		if _, err := db.Exec(`INSERT INTO publication_follows (publication_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, pubID, userID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "following"})
	case http.MethodDelete:
		if _, err := db.Exec(`DELETE FROM publication_follows WHERE publication_id = $1 AND user_id = $2`, pubID, userID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "unfollowed"})
	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}

// publicationMembersHandler lists members and lets the owner add members.
func publicationMembersHandler(w http.ResponseWriter, r *http.Request, slug string) {
	var pubID, ownerID string
	if err := db.QueryRow("SELECT id, owner_id FROM publications WHERE slug = $1", slug).Scan(&pubID, &ownerID); err != nil {
		jsonError(w, 404, "not_found", "Publication not found")
		return
	}

	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(`
			SELECT u.id, u.username, u.display_name, u.avatar_url, pm.role
			FROM publication_members pm
			JOIN users u ON pm.user_id = u.id
			WHERE pm.publication_id = $1
			ORDER BY pm.created_at ASC`, pubID)
		if err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		defer rows.Close()
		type member struct {
			ID          string `json:"id"`
			Username    string `json:"username"`
			DisplayName string `json:"display_name"`
			AvatarURL   string `json:"avatar_url"`
			Role        string `json:"role"`
		}
		out := []member{}
		for rows.Next() {
			var m member
			if err := rows.Scan(&m.ID, &m.Username, &m.DisplayName, &m.AvatarURL, &m.Role); err == nil {
				out = append(out, m)
			}
		}
		if out == nil {
			out = []member{}
		}
		jsonSuccess(w, 200, out)

	case http.MethodPost:
		userID, err := extractUserID(r)
		if err != nil {
			jsonError(w, 401, "unauthorized", "Not authenticated")
			return
		}
		if userID != ownerID {
			jsonError(w, 403, "forbidden", "Only the owner can add members")
			return
		}
		var input struct {
			Username string `json:"username"`
			Role     string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Username == "" {
			jsonError(w, 400, "bad_request", "username required")
			return
		}
		role := input.Role
		if role == "" {
			role = "writer"
		}
		var memberID string
		if err := db.QueryRow("SELECT id FROM users WHERE username = $1", input.Username).Scan(&memberID); err != nil {
			jsonError(w, 404, "not_found", "User not found")
			return
		}
		if _, err := db.Exec(`INSERT INTO publication_members (publication_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (publication_id, user_id) DO UPDATE SET role = EXCLUDED.role`, pubID, memberID, role); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}

		// Notify the user that they were added to the publication.
		var pubName string
		if err := db.QueryRow("SELECT name FROM publications WHERE id = $1", pubID).Scan(&pubName); err == nil {
			createNotification(memberID, userID, "publication", displayName(userID)+" added you to "+pubName, pubName)
		}

		jsonSuccess(w, 200, map[string]string{"status": "added"})

	case http.MethodDelete:
		userID, err := extractUserID(r)
		if err != nil {
			jsonError(w, 401, "unauthorized", "Not authenticated")
			return
		}
		if userID != ownerID {
			jsonError(w, 403, "forbidden", "Only the owner can remove members")
			return
		}
		username := r.URL.Query().Get("username")
		if username == "" {
			jsonError(w, 400, "bad_request", "username required")
			return
		}
		var memberID string
		if err := db.QueryRow("SELECT id FROM users WHERE username = $1", username).Scan(&memberID); err != nil {
			jsonError(w, 404, "not_found", "User not found")
			return
		}
		// Prevent removing the owner themselves.
		if memberID == ownerID {
			jsonError(w, 400, "bad_request", "Cannot remove the owner")
			return
		}
		if _, err := db.Exec(`DELETE FROM publication_members WHERE publication_id = $1 AND user_id = $2`, pubID, memberID); err != nil {
			jsonError(w, 500, "db_error", err.Error())
			return
		}
		jsonSuccess(w, 200, map[string]string{"status": "removed"})

	default:
		jsonError(w, 405, "method_not_allowed", "Method not allowed")
	}
}
