package queue

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/nats-io/nats.go"
)

// EmailEvent is published when the system needs to send an email.
type EmailEvent struct {
	Type    string `json:"type"`
	ToEmail string `json:"to_email"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// FeedEvent is published when a post is published so the feed worker can
// fan it out to followers.
type FeedEvent struct {
	Type        string `json:"type"`
	PostID      string `json:"post_id"`
	AuthorID    string `json:"author_id"`
	PublishedAt string `json:"published_at"`
}

const (
	StreamEmails      = "emails"
	StreamFeedUpdates = "feed-updates"
	SubjectEmails     = "emails."
	SubjectFeed       = "feed."
)

// Client is a thin NATS JetStream publisher. It is safe to call when nil.
type Client struct {
	nc *nats.Conn
	js nats.JetStreamContext
}

// NewClient creates a NATS JetStream client from the NATS_URL environment
// variable. If NATS_URL is empty or the connection fails, it returns nil and
// logs a warning so the API can continue without a queue.
func NewClient() *Client {
	url := os.Getenv("NATS_URL")
	if url == "" {
		log.Println("queue: NATS_URL not set, queue publishing disabled")
		return nil
	}

	nc, err := nats.Connect(url,
		nats.Timeout(5*time.Second),
		nats.ReconnectWait(1*time.Second),
		nats.MaxReconnects(10),
	)
	if err != nil {
		log.Printf("queue: failed to connect to NATS: %v", err)
		return nil
	}

	js, err := nc.JetStream()
	if err != nil {
		log.Printf("queue: failed to create JetStream context: %v", err)
		nc.Close()
		return nil
	}

	return &Client{nc: nc, js: js}
}

// PublishEmail sends an email event to NATS. No-op if the client is nil.
func (c *Client) PublishEmail(ev EmailEvent) {
	if c == nil || c.js == nil {
		return
	}
	data, err := json.Marshal(ev)
	if err != nil {
		log.Printf("queue: failed to marshal email event: %v", err)
		return
	}
	subject := SubjectEmails + ev.Type
	if _, err := c.js.Publish(subject, data); err != nil {
		log.Printf("queue: failed to publish email event: %v", err)
	}
}

// PublishFeedUpdate sends a post-published event to NATS. No-op if the client is nil.
func (c *Client) PublishFeedUpdate(ev FeedEvent) {
	if c == nil || c.js == nil {
		return
	}
	data, err := json.Marshal(ev)
	if err != nil {
		log.Printf("queue: failed to marshal feed event: %v", err)
		return
	}
	if _, err := c.js.Publish(SubjectFeed+"published", data); err != nil {
		log.Printf("queue: failed to publish feed event: %v", err)
	}
}

// EnsureStream creates a JetStream stream if it does not already exist.
func (c *Client) EnsureStream(name, subject string) error {
	if c == nil || c.js == nil {
		return fmt.Errorf("queue client not initialized")
	}
	_, err := c.js.AddStream(&nats.StreamConfig{
		Name:     name,
		Subjects: []string{subject},
		Storage:  nats.FileStorage,
		Retention: nats.WorkQueuePolicy,
		MaxMsgs:  100_000,
	})
	if err != nil && !nats.IsNatsErr(err, nats.ErrStreamNameAlreadyInUse) {
		return err
	}
	return nil
}

// JetStream returns the underlying JetStream context for consumers.
func (c *Client) JetStream() nats.JetStreamContext {
	if c == nil {
		return nil
	}
	return c.js
}

// Close closes the NATS connection.
func (c *Client) Close() {
	if c == nil || c.nc == nil {
		return
	}
	c.nc.Close()
}
