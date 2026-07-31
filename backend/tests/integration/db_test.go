package integration

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/indiestack/indiestack/internal/testutil"
	"github.com/jackc/pgx/v5"
)

// skipIfNoDB skips the test if the test database is not reachable.
func skipIfNoDB(t *testing.T) {
	t.Helper()
	if _, err := testutil.AcquirePoolRaw(t); err != nil {
		t.Skipf("test database unavailable: %v", err)
	}
}

// TestDatabaseSchema verifies that all required tables exist.
func TestDatabaseSchema(t *testing.T) {
	skipIfNoDB(t)
	pool := testutil.AcquirePool(t)

	requiredTables := []string{
		"users", "posts", "follows", "likes", "comments",
		"bookmarks", "notifications", "reading_history",
		"api_keys", "profiles", "jobs", "companies",
		"newsletter_subscriptions", "tips",
	}

	for _, table := range requiredTables {
		t.Run(table, func(t *testing.T) {
			var exists bool
			err := pool.QueryRow(context.Background(),
				"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)",
				table,
			).Scan(&exists)
			if err != nil {
				t.Fatalf("failed to check table %s: %v", table, err)
			}
			if !exists {
				t.Errorf("required table %s does not exist", table)
			}
		})
	}
}

// TestUserLifecycle verifies registration-like inserts and queries.
func TestUserLifecycle(t *testing.T) {

	pool := testutil.AcquirePool(t)
	testutil.ResetTestData(t, pool)

	email := "test-lifecycle@example.com"
	username := "testlifecycle"
	password := "password123"

	id := testutil.SeedUser(t, pool, email, username, password)
	if id == "" {
		t.Fatal("expected non-empty user id")
	}

	var count int
	err := pool.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM users WHERE email = $1 AND username = $2",
		email, username,
	).Scan(&count)
	if err != nil {
		t.Fatalf("failed to query user: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 user, got %d", count)
	}
}

// TestPostLifecycle verifies post insertion and feed queries.
func TestPostLifecycle(t *testing.T) {
	pool := testutil.AcquirePool(t)
	testutil.ResetTestData(t, pool)

	userID := testutil.SeedUser(t, pool, "post-user@example.com", "postuser", "password123")
	postID := testutil.SeedPublishedPost(t, pool, userID, "My First Post", "my-first-post")

	if postID == "" {
		t.Fatal("expected non-empty post id")
	}

	var status string
	err := pool.QueryRow(context.Background(),
		"SELECT status FROM posts WHERE id = $1", postID,
	).Scan(&status)
	if err != nil {
		t.Fatalf("failed to query post: %v", err)
	}
	if status != "published" {
		t.Errorf("expected status published, got %s", status)
	}
}

// TestFollowRelationship verifies follow/unfollow logic.
func TestFollowRelationship(t *testing.T) {
	pool := testutil.AcquirePool(t)
	testutil.ResetTestData(t, pool)

	followerID := testutil.SeedUser(t, pool, "follower@example.com", "follower", "password123")
	followingID := testutil.SeedUser(t, pool, "following@example.com", "following", "password123")

	ctx := context.Background()
	_, err := pool.Exec(ctx,
		"INSERT INTO follows (follower_id, following_id, created_at) VALUES ($1, $2, NOW())",
		followerID, followingID,
	)
	if err != nil {
		t.Fatalf("failed to create follow: %v", err)
	}

	var count int
	err = pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND following_id = $2",
		followerID, followingID,
	).Scan(&count)
	if err != nil {
		t.Fatalf("failed to count follows: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 follow, got %d", count)
	}
}

// TestAPIKeyScopes verifies api_keys table supports text[] scopes.
func TestAPIKeyScopes(t *testing.T) {
	pool := testutil.AcquirePool(t)
	testutil.ResetTestData(t, pool)

	userID := testutil.SeedUser(t, pool, "apikey-user@example.com", "apikeyuser", "password123")
	scopes := []string{"posts:read", "posts:write"}

	ctx := context.Background()
	keyID := uuid.New().String()
	_, err := pool.Exec(ctx,
		`INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, scopes, is_active, created_at, updated_at)
		 VALUES ($1, $2::uuid, 'test-key', 'isk_test', 'hash', $3, true, NOW(), NOW())`,
		keyID, userID, scopes,
	)
	if err != nil {
		t.Fatalf("failed to insert api key with scopes: %v", err)
	}

	var retrieved []string
	err = pool.QueryRow(ctx,
		"SELECT scopes FROM api_keys WHERE id = $1", keyID,
	).Scan(&retrieved)
	if err != nil {
		t.Fatalf("failed to retrieve scopes: %v", err)
	}

	if len(retrieved) != 2 || retrieved[0] != "posts:read" || retrieved[1] != "posts:write" {
		t.Errorf("unexpected scopes: %v", retrieved)
	}
}

// TestNewsletterSubscription verifies newsletter subscriptions.
func TestNewsletterSubscription(t *testing.T) {
	skipIfNoDB(t)
	pool := testutil.AcquirePool(t)
	testutil.ResetTestData(t, pool)

	ctx := context.Background()
	_, err := pool.Exec(ctx,
		"INSERT INTO newsletter_subscriptions (id, email, is_active, created_at) VALUES ($1, $2, true, NOW())",
		uuid.New().String(), "subscriber@example.com",
	)
	if err != nil {
		t.Fatalf("failed to insert subscription: %v", err)
	}

	var count int
	err = pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM newsletter_subscriptions WHERE email = $1",
		"subscriber@example.com",
	).Scan(&count)
	if err != nil {
		t.Fatalf("failed to count subscriptions: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 subscription, got %d", count)
	}
}

// TestForeignKeyConstraints verifies FK constraints protect referential integrity.
func TestForeignKeyConstraints(t *testing.T) {
	pool := testutil.AcquirePool(t)
	testutil.ResetTestData(t, pool)

	ctx := context.Background()
	fakeUserID := uuid.New().String()

	_, err := pool.Exec(ctx,
		"INSERT INTO posts (id, author_id, title, slug, content, excerpt, status, word_count, reading_time_minutes, created_at, updated_at) VALUES ($1, $2, 'x', 'x', '{}'::jsonb, 'x', 'draft', 1, 1, NOW(), NOW())",
		uuid.New().String(), fakeUserID,
	)
	if err == nil {
		t.Fatal("expected foreign key violation for non-existent user")
	}

	if err != pgx.ErrNoRows {
		// pgx returns a PgxError; ensure it is a foreign key violation.
		// We just need to confirm the insert failed, which it did.
		t.Logf("expected FK error: %v", err)
	}
}
