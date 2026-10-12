package auth

import (
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestHashPasswordCost12(t *testing.T) {
	// The shared fixture is HashPassword("password123"), paid once per package.
	hash := testHash()
	cost, err := bcrypt.Cost([]byte(hash))
	if err != nil {
		t.Fatal(err)
	}
	if cost != 12 {
		t.Fatalf("bcrypt cost %d, want 12", cost)
	}
	if !checkPassword(hash, "password123") {
		t.Fatal("hash does not match its password")
	}
	if checkPassword(hash, "password124") {
		t.Fatal("hash matches a different password")
	}
	if strings.Contains(hash, "password123") {
		t.Fatal("hash contains the password")
	}
}
