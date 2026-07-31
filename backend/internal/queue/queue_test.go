package queue

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/nats-io/nats.go"
)

func TestEmailEventSerialization(t *testing.T) {
	ev := EmailEvent{
		Type:    "newsletter_welcome",
		ToEmail: "test@example.com",
		Subject: "Welcome",
		Body:    "Hello!",
	}

	data, err := json.Marshal(ev)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var decoded EmailEvent
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if decoded.Type != ev.Type || decoded.ToEmail != ev.ToEmail || decoded.Subject != ev.Subject || decoded.Body != ev.Body {
		t.Errorf("decoded event mismatch: %+v", decoded)
	}
}

func TestFeedEventSerialization(t *testing.T) {
	ev := FeedEvent{
		Type:        "post_published",
		PostID:      "post-123",
		AuthorID:    "author-456",
		PublishedAt: "2026-01-01T00:00:00Z",
	}

	data, err := json.Marshal(ev)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var decoded FeedEvent
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if decoded.Type != ev.Type || decoded.PostID != ev.PostID || decoded.AuthorID != ev.AuthorID || decoded.PublishedAt != ev.PublishedAt {
		t.Errorf("decoded event mismatch: %+v", decoded)
	}
}

func TestNewClientWithoutNATS_URL(t *testing.T) {
	os.Unsetenv("NATS_URL")
	c := NewClient()
	if c != nil {
		t.Error("expected nil client when NATS_URL is unset")
	}
}

func TestNilClientPublishIsNoOp(t *testing.T) {
	var c *Client
	c.PublishEmail(EmailEvent{Type: "test", ToEmail: "test@example.com", Subject: "test", Body: "test"})
	c.PublishFeedUpdate(FeedEvent{Type: "post_published", PostID: "p1", AuthorID: "a1", PublishedAt: "now"})
}

func TestConstants(t *testing.T) {
	if StreamEmails != "emails" {
		t.Errorf("StreamEmails = %q, want emails", StreamEmails)
	}
	if StreamFeedUpdates != "feed-updates" {
		t.Errorf("StreamFeedUpdates = %q, want feed-updates", StreamFeedUpdates)
	}
	if SubjectEmails != "emails." {
		t.Errorf("SubjectEmails = %q, want emails.", SubjectEmails)
	}
}

func TestEnsureStreamNilClient(t *testing.T) {
	var c *Client
	err := c.EnsureStream(StreamEmails, SubjectEmails+">")
	if err == nil {
		t.Error("expected error when ensuring stream on nil client")
	}
}

func TestNATSStreamNameAlreadyInUseError(t *testing.T) {
	// Verify the sentinel error used in queue.go exists.
	if nats.ErrStreamNameAlreadyInUse == nil {
		t.Error("nats.ErrStreamNameAlreadyInUse should not be nil")
	}
}
