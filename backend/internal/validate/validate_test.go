package validate

import "testing"

func TestEmail(t *testing.T) {
	tests := []struct {
		email string
		want  bool
	}{
		{"user@example.com", true},
		{"first.last+tag@example.co.uk", true},
		{"a@b.co", true},
		{"plainaddress", false},
		{"@example.com", false},
		{"user@", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.email, func(t *testing.T) {
			if got := Email(tt.email); got != tt.want {
				t.Errorf("Email(%q) = %v, want %v", tt.email, got, tt.want)
			}
		})
	}
}

func TestPassword(t *testing.T) {
	tests := []struct {
		password string
		want     bool
	}{
		{"short1", false},
		{"exactly8", true},
		{"thisIsAVeryLongPasswordThatIsWithinTheLimit12345678901234567890", true},
		{string(make([]byte, 129)), false},
	}

	for _, tt := range tests {
		t.Run(tt.password, func(t *testing.T) {
			if got := Password(tt.password); got != tt.want {
				t.Errorf("Password(%q) = %v, want %v", tt.password, got, tt.want)
			}
		})
	}
}

func TestUsername(t *testing.T) {
	tests := []struct {
		username string
		want     bool
	}{
		{"alice", true},
		{"user_123", true},
		{"ab", false},
		{"user-name", false},
		{"user@name", false},
		{string(make([]byte, 31)), false},
	}

	for _, tt := range tests {
		t.Run(tt.username, func(t *testing.T) {
			if got := Username(tt.username); got != tt.want {
				t.Errorf("Username(%q) = %v, want %v", tt.username, got, tt.want)
			}
		})
	}
}
