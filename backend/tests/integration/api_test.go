package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"
)

// baseURL returns the API base URL from env or default.
func baseURL() string {
	if u := os.Getenv("TEST_API_URL"); u != "" {
		return u
	}
	return "http://localhost:8080/api/v1"
}

// skipIfAPIUnavailable skips tests if the API is not running.
func skipIfAPIUnavailable(t *testing.T) {
	t.Helper()
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(baseURL() + "/health")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Skipf("API unavailable at %s: %v", baseURL(), err)
	}
}

func TestAPIHealth(t *testing.T) {
	skipIfAPIUnavailable(t)

	resp, err := http.Get(baseURL() + "/health")
	if err != nil {
		t.Fatalf("health check failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("health status = %d, want 200", resp.StatusCode)
	}
}

func TestPublicFeed(t *testing.T) {
	skipIfAPIUnavailable(t)

	resp, err := http.Get(baseURL() + "/feed/latest")
	if err != nil {
		t.Fatalf("feed request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("feed status = %d, want 200", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode feed response: %v", err)
	}

	if _, ok := result["success"]; !ok {
		t.Error("expected success field in feed response")
	}
}

func TestRegisterAndLogin(t *testing.T) {
	skipIfAPIUnavailable(t)

	email := fmt.Sprintf("test-%d@example.com", time.Now().UnixNano())
	username := fmt.Sprintf("testuser%d", time.Now().UnixNano())
	password := "password123"
	displayName := "Test User"

	// Register
	registerBody, _ := json.Marshal(map[string]string{
		"email":        email,
		"username":     username,
		"password":     password,
		"display_name": displayName,
	})

	resp, err := http.Post(baseURL()+"/auth/register", "application/json", bytes.NewReader(registerBody))
	if err != nil {
		t.Fatalf("register request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusConflict {
		t.Errorf("register status = %d, want 201 or 409", resp.StatusCode)
	}

	// Login
	loginBody, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
	})

	resp, err = http.Post(baseURL()+"/auth/login", "application/json", bytes.NewReader(loginBody))
	if err != nil {
		t.Fatalf("login request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("login status = %d, want 200", resp.StatusCode)
	}
}

func TestLoginInvalidCredentials(t *testing.T) {
	skipIfAPIUnavailable(t)

	loginBody, _ := json.Marshal(map[string]string{
		"email":    "definitely-not-real@example.com",
		"password": "wrongpassword",
	})

	resp, err := http.Post(baseURL()+"/auth/login", "application/json", bytes.NewReader(loginBody))
	if err != nil {
		t.Fatalf("login request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("login status = %d, want 401", resp.StatusCode)
	}
}
