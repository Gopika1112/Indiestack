package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/indiestack/indiestack/internal/queue"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/nats-io/nats.go"
	"github.com/redis/go-redis/v9"
)

const (
	feedMaxItems   = 500
	feedTTL        = 7 * 24 * time.Hour
	largeCreatorThreshold = 10_000
)

func main() {
	log.Println("IndieStack feed worker starting...")

	db := connectDB()
	defer db.Close()

	rdb := connectRedis()

	qc := queue.NewClient()
	if qc == nil {
		log.Fatal("NATS_URL not set or NATS unavailable, cannot start feed worker")
	}
	defer qc.Close()

	if err := qc.EnsureStream(queue.StreamFeedUpdates, queue.SubjectFeed+"*"); err != nil {
		log.Fatalf("Failed to ensure feed-updates stream: %v", err)
	}

	js := qc.JetStream()
	if js == nil {
		log.Fatal("JetStream context not available")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sub, err := js.Subscribe(queue.SubjectFeed+"*", func(msg *nats.Msg) {
		if err := handleFeedEvent(ctx, db, rdb, msg); err != nil {
			log.Printf("Feed handler error: %v", err)
			msg.Nak()
			return
		}
		if err := msg.Ack(); err != nil {
			log.Printf("Failed to ack feed message: %v", err)
		}
	}, nats.Durable("feed-worker"), nats.ManualAck(), nats.MaxDeliver(3))
	if err != nil {
		log.Fatalf("Failed to subscribe to feed updates: %v", err)
	}
	defer sub.Unsubscribe()

	log.Println("Feed worker listening for messages")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Feed worker shutting down")
}

func connectDB() *sql.DB {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://indiestack:indiestack_secret@postgres:5432/indiestack?sslmode=disable"
	}
	var db *sql.DB
	var err error
	for i := 0; i < 10; i++ {
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
	return db
}

func connectRedis() *redis.Client {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis:6379"
	}
	client := redis.NewClient(&redis.Options{
		Addr: redisURL,
	})
	return client
}

func handleFeedEvent(ctx context.Context, db *sql.DB, rdb *redis.Client, msg *nats.Msg) error {
	var ev queue.FeedEvent
	if err := json.Unmarshal(msg.Data, &ev); err != nil {
		return fmt.Errorf("invalid feed event payload: %w", err)
	}

	if ev.Type != "post_published" || ev.PostID == "" || ev.AuthorID == "" {
		log.Printf("Skipping unsupported feed event: %+v", ev)
		return nil
	}

	authorFollowers, err := getFollowerCount(db, ev.AuthorID)
	if err != nil {
		return fmt.Errorf("failed to get follower count: %w", err)
	}

	if authorFollowers >= largeCreatorThreshold {
		log.Printf("Author %s has %d followers (>= %d), skipping push feed fanout",
			ev.AuthorID, authorFollowers, largeCreatorThreshold)
		return nil
	}

	followers, err := getFollowerIDs(db, ev.AuthorID)
	if err != nil {
		return fmt.Errorf("failed to get followers: %w", err)
	}

	if len(followers) == 0 {
		log.Printf("No followers for author %s, nothing to push", ev.AuthorID)
		return nil
	}

	pushed := 0
	pipe := rdb.Pipeline()
	for _, followerID := range followers {
		key := fmt.Sprintf("feed:user:%s", followerID)
		pipe.LPush(ctx, key, ev.PostID)
		pipe.LTrim(ctx, key, 0, feedMaxItems-1)
		pipe.Expire(ctx, key, feedTTL)
		pushed++
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("failed to push feed entries to redis: %w", err)
	}

	log.Printf("Pushed post %s to %d followers (author followers: %d)", ev.PostID, pushed, authorFollowers)
	return nil
}

func getFollowerCount(db *sql.DB, authorID string) (int, error) {
	var count int
	err := db.QueryRow("SELECT follower_count FROM users WHERE id = $1", authorID).Scan(&count)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return count, err
}

func getFollowerIDs(db *sql.DB, authorID string) ([]string, error) {
	rows, err := db.Query("SELECT follower_id FROM follows WHERE following_id = $1", authorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
