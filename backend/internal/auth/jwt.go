// Package auth mirrors the JWT helpers from cmd/api/main.go
// so they can be unit tested without importing the main package.
package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	jwtSecret        []byte
	jwtRefreshSecret []byte
)

// InitSecrets initializes the JWT signing secrets.
func InitSecrets(accessSecret, refreshSecret []byte) {
	jwtSecret = accessSecret
	jwtRefreshSecret = refreshSecret
}

// GenerateTokens creates an access token and a refresh token.
func GenerateTokens(userID string) (string, string, time.Time, error) {
	accessExpiry := time.Now().Add(24 * time.Hour)
	access := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  userID,
		"exp":  accessExpiry.Unix(),
		"iat":  time.Now().Unix(),
		"type": "access",
	})
	accessToken, err := access.SignedString(jwtSecret)
	if err != nil {
		return "", "", time.Time{}, err
	}

	refresh := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  userID,
		"exp":  time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":  time.Now().Unix(),
		"type": "refresh",
	})
	refreshToken, err := refresh.SignedString(jwtRefreshSecret)
	if err != nil {
		return "", "", time.Time{}, err
	}

	return accessToken, refreshToken, accessExpiry, nil
}

// ParseJWT validates an access token and returns the user ID.
func ParseJWT(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return "", fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("invalid claims")
	}

	userID, ok := claims["sub"].(string)
	if !ok {
		return "", fmt.Errorf("invalid user id in token")
	}

	return userID, nil
}

// GenerateExpiredToken creates a token that expired 1 hour ago.
func GenerateExpiredToken(userID string) (string, error) {
	access := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  userID,
		"exp":  time.Now().Add(-1 * time.Hour).Unix(),
		"iat":  time.Now().Add(-2 * time.Hour).Unix(),
		"type": "access",
	})
	return access.SignedString(jwtSecret)
}

// parseJWTWithSecret parses a token with an explicit secret.
func parseJWTWithSecret(tokenString string, secret []byte) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return secret, nil
	})
	if err != nil || !token.Valid {
		return "", fmt.Errorf("invalid token")
	}
	claims := token.Claims.(jwt.MapClaims)
	return claims["sub"].(string), nil
}
