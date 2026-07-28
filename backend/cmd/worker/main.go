package main

import (
	"crypto/tls"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/indiestack/indiestack/internal/queue"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/nats-io/nats.go"
)

func main() {
	log.Println("IndieStack email worker starting...")

	db := connectDB()
	defer db.Close()

	qc := queue.NewClient()
	if qc == nil {
		log.Fatal("NATS_URL not set or NATS unavailable, cannot start email worker")
	}
	defer qc.Close()

	if err := qc.EnsureStream(queue.StreamEmails, queue.SubjectEmails+"*"); err != nil {
		log.Fatalf("Failed to ensure emails stream: %v", err)
	}

	js := qc.JetStream()
	if js == nil {
		log.Fatal("JetStream context not available")
	}

	// Create a durable push consumer. Messages are acknowledged after
	// processing so that unacknowledged messages are redelivered.
	sub, err := js.Subscribe(queue.SubjectEmails+"*", func(msg *nats.Msg) {
		if err := handleEmail(msg); err != nil {
			log.Printf("Email handler error: %v", err)
			msg.Nak()
			return
		}
		if err := msg.Ack(); err != nil {
			log.Printf("Failed to ack message: %v", err)
		}
	}, nats.Durable("email-worker"), nats.ManualAck(), nats.MaxDeliver(3))
	if err != nil {
		log.Fatalf("Failed to subscribe to emails: %v", err)
	}
	defer sub.Unsubscribe()

	log.Println("Email worker listening for messages")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Email worker shutting down")
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

func handleEmail(msg *nats.Msg) error {
	var ev queue.EmailEvent
	if err := json.Unmarshal(msg.Data, &ev); err != nil {
		return fmt.Errorf("invalid email event payload: %w", err)
	}

	if ev.ToEmail == "" || ev.Subject == "" {
		log.Printf("Skipping malformed email event: %+v", ev)
		return nil
	}

	if !smtpConfigured() {
		log.Printf("[SMTP not configured] Would send email to %s: %s - %s", ev.ToEmail, ev.Subject, ev.Body)
		return nil
	}

	if err := sendEmail(ev.ToEmail, ev.Subject, ev.Body); err != nil {
		return fmt.Errorf("failed to send email to %s: %w", ev.ToEmail, err)
	}

	log.Printf("Email sent to %s: %s", ev.ToEmail, ev.Subject)
	return nil
}

func smtpConfigured() bool {
	return os.Getenv("SMTP_HOST") != "" && os.Getenv("SMTP_USER") != "" && os.Getenv("SMTP_PASS") != ""
}

func sendEmail(to, subject, body string) error {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")
	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = os.Getenv("ADMIN_EMAIL")
	}
	if from == "" {
		from = "noreply@indiestack.local"
	}
	if port == "" {
		port = "587"
	}

	addr := host + ":" + port
	auth := smtp.PlainAuth("", user, pass, host)
	msg := []byte(fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s\r\n", to, subject, body))

	if port == "465" {
		return sendEmailSSL(host, addr, auth, from, to, msg)
	}

	return sendEmailSTARTTLS(host, addr, auth, from, to, msg)
}

func sendEmailSTARTTLS(host, addr string, auth smtp.Auth, from, to string, msg []byte) error {
	c, err := smtp.Dial(addr)
	if err != nil {
		return err
	}
	defer c.Close()

	if ok, _ := c.Extension("STARTTLS"); ok {
		config := &tls.Config{ServerName: host}
		if err := c.StartTLS(config); err != nil {
			return err
		}
	}

	if err := c.Auth(auth); err != nil {
		return err
	}
	if err := c.Mail(from); err != nil {
		return err
	}
	if err := c.Rcpt(to); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	return c.Quit()
}

func sendEmailSSL(host, addr string, auth smtp.Auth, from, to string, msg []byte) error {
	config := &tls.Config{ServerName: host}
	conn, err := tls.Dial("tcp", addr, config)
	if err != nil {
		return err
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer c.Close()

	if err := c.Auth(auth); err != nil {
		return err
	}
	if err := c.Mail(from); err != nil {
		return err
	}
	if err := c.Rcpt(to); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}
