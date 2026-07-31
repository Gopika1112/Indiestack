// Package testutil provides shared helpers for backend tests.
package testutil

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestDatabaseURL returns the database URL to use for tests.
// It prefers TEST_DATABASE_URL, then DATABASE_URL, then a sensible default.
func TestDatabaseURL() string {
	if u := os.Getenv("TEST_DATABASE_URL"); u != "" {
		return u
	}
	if u := os.Getenv("DATABASE_URL"); u != "" {
		return u
	}
	return "postgres://indiestack:indiestack_secret@localhost:5432/indiestack_test?sslmode=disable"
}

// AcquirePoolRaw attempts to connect to the test database and returns the
// pool and any error. Callers should Close() the returned pool.
func AcquirePoolRaw(t testing.TB) (*pgxpool.Pool, error) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, TestDatabaseURL())
	if err != nil {
		return nil, err
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return pool, nil
}

// AcquirePool returns a connection pool for the test database.
// The caller is responsible for calling Close().
// If the test database is not reachable, the test is skipped.
func AcquirePool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	pool, err := AcquirePoolRaw(t)
	if err != nil {
		t.Skipf("test database unavailable: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
	})

	return pool
}

// ResetTestData truncates all mutable tables and reseeds with a known user.
func ResetTestData(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx := context.Background()

	// Tables are truncated in an order that respects foreign keys.
	_, err := pool.Exec(ctx, `
		TRUNCATE TABLE 
			api_keys,
			bookmarks,
			comments,
			email_events,
			follows,
			jobs,
			likes,
			newsletter_subscriptions,
			notifications,
			post_analytics,
			posts,
			profiles,
			reading_history,
			tips,
			users
		RESTART IDENTITY CASCADE;
	`)
	if err != nil {
		t.Fatalf("failed to reset test data: %v", err)
	}
}

// SeedUser inserts a test user and returns the ID.
func SeedUser(t *testing.T, pool *pgxpool.Pool, email, username, password string) string {
	t.Helper()

	ctx := context.Background()

	var id string
	query := `
		INSERT INTO users (id, email, username, password_hash, display_name, bio, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, '', NOW(), NOW())
		RETURNING id
	`
	err := pool.QueryRow(ctx, query, email, username, password, username).Scan(&id)
	if err != nil {
		t.Fatalf("failed to seed user %s: %v", email, err)
	}

	return id
}

// SeedPublishedPost inserts a published post and returns the ID.
func SeedPublishedPost(t *testing.T, pool *pgxpool.Pool, userID, title, slug string) string {
	t.Helper()

	ctx := context.Background()

	var id string
	query := `
		INSERT INTO posts (
			id, author_id, title, slug, content, excerpt, status,
			word_count, reading_time_minutes, created_at, updated_at, published_at
		)
		VALUES (
			gen_random_uuid(), $1, $2, $3, '{"type":"doc"}'::jsonb, $2,
			'published', 1, 1, NOW(), NOW(), NOW()
		)
		RETURNING id
	`
	err := pool.QueryRow(ctx, query, userID, title, slug).Scan(&id)
	if err != nil {
		t.Fatalf("failed to seed post %s: %v", title, err)
	}

	return id
}

// CountRows executes SELECT COUNT(*) on a table with an optional WHERE clause.
func CountRows(t *testing.T, pool *pgxpool.Pool, table, where string, args ...interface{}) int {
	t.Helper()

	ctx := context.Background()

	q := fmt.Sprintf("SELECT COUNT(*) FROM %s", table)
	if where != "" {
		q += " WHERE " + where
	}

	var count int
	if err := pool.QueryRow(ctx, q, args...).Scan(&count); err != nil {
		t.Fatalf("failed to count rows in %s: %v", table, err)
	}

	return count
}
