package auth

import (
	"strings"
	"testing"
	"time"
)

func TestGenerateAndParseAccessToken(t *testing.T) {
	InitSecrets([]byte("test-access-secret-min-32-bytes"), []byte("test-refresh-secret-min-32-bytes"))

	userID := "user-123"
	accessToken, refreshToken, expiry, err := GenerateTokens(userID)
	if err != nil {
		t.Fatalf("GenerateTokens failed: %v", err)
	}

	if accessToken == "" || refreshToken == "" {
		t.Fatal("expected non-empty tokens")
	}

	if time.Until(expiry) <= 23*time.Hour {
		t.Errorf("access token expiry too short: %v", expiry)
	}

	parsedID, err := ParseJWT(accessToken)
	if err != nil {
		t.Fatalf("ParseJWT failed: %v", err)
	}
	if parsedID != userID {
		t.Errorf("ParseJWT = %q, want %q", parsedID, userID)
	}
}

func TestParseJWT_Expired(t *testing.T) {
	InitSecrets([]byte("test-access-secret-min-32-bytes"), []byte("test-refresh-secret-min-32-bytes"))

	expiredToken, err := GenerateExpiredToken("user-123")
	if err != nil {
		t.Fatalf("GenerateExpiredToken failed: %v", err)
	}

	_, err = ParseJWT(expiredToken)
	if err == nil {
		t.Fatal("expected error for expired token")
	}
}

func TestParseJWT_InvalidSignature(t *testing.T) {
	InitSecrets([]byte("test-access-secret-min-32-bytes"), []byte("test-refresh-secret-min-32-bytes"))

	accessToken, _, _, err := GenerateTokens("user-123")
	if err != nil {
		t.Fatalf("GenerateTokens failed: %v", err)
	}

	// Tamper with the token payload
	parts := strings.Split(accessToken, ".")
	if len(parts) != 3 {
		t.Fatal("JWT does not have 3 parts")
	}
	tampered := parts[0] + "." + strings.Repeat("X", len(parts[1])) + "." + parts[2]

	_, err = ParseJWT(tampered)
	if err == nil {
		t.Fatal("expected error for tampered token")
	}
}

func TestRefreshTokenRequiresRefreshSecret(t *testing.T) {
	InitSecrets([]byte("test-access-secret-min-32-bytes"), []byte("test-refresh-secret-min-32-bytes"))

	_, refreshToken, _, err := GenerateTokens("user-123")
	if err != nil {
		t.Fatalf("GenerateTokens failed: %v", err)
	}

	// Parsing with access secret should fail
	_, err = parseJWTWithSecret(refreshToken, []byte("test-access-secret-min-32-bytes"))
	if err == nil {
		t.Fatal("expected refresh token to fail when parsed with access secret")
	}
}
