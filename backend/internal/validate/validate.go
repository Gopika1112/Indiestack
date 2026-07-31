// Package validate mirrors the validation rules from cmd/api/main.go
// so they can be unit tested without importing the main package.
package validate

import (
	"regexp"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func Email(email string) bool {
	return emailRegex.MatchString(email) && len(email) <= 254
}

func Password(password string) bool {
	return len(password) >= 8 && len(password) <= 128
}

func Username(username string) bool {
	if len(username) < 3 || len(username) > 30 {
		return false
	}
	matched, _ := regexp.MatchString(`^[a-zA-Z0-9_]+$`, username)
	return matched
}

func DisplayName(name string) bool {
	return len(name) > 0 && len(name) <= 100
}

func Title(title string) bool {
	return len(title) > 0 && len(title) <= 300
}

func APIKeyName(name string) bool {
	return len(name) > 0 && len(name) <= 100
}
