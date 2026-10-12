package main

import (
	"context"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("coreadmin")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

func TestCreateAdminFromStdin(t *testing.T) {
	ctx := context.Background()
	var out strings.Builder
	if err := createAdmin(ctx, testPool, "root@example.com", strings.NewReader("rootpass123\n"), &out); err != nil {
		t.Fatalf("createAdmin: %v", err)
	}
	if got := strings.TrimSpace(out.String()); got != "created admin root@example.com" {
		t.Fatalf("output %q, want %q", got, "created admin root@example.com")
	}
	var role, name, hash string
	var active bool
	if err := testPool.QueryRow(ctx, "select role::text, name, is_active, password_hash from staff_users where email = 'root@example.com'").
		Scan(&role, &name, &active, &hash); err != nil {
		t.Fatal(err)
	}
	if role != "admin" || name != "Admin" || !active {
		t.Fatalf("row: role %q name %q active %v, want admin Admin true", role, name, active)
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte("rootpass123")) != nil {
		t.Fatal("stored hash does not match the password read from stdin")
	}
}

func TestCreateAdminEmailTaken(t *testing.T) {
	ctx := context.Background()
	run := func() error {
		return createAdmin(ctx, testPool, "taken@example.com", strings.NewReader("rootpass123\n"), io.Discard)
	}
	if err := run(); err != nil {
		t.Fatalf("first createAdmin: %v", err)
	}
	if err := run(); err == nil || !strings.Contains(err.Error(), "already registered") {
		t.Fatalf("second createAdmin: got %v, want an error naming the taken email", err)
	}
	var n int
	if err := testPool.QueryRow(ctx, "select count(*) from staff_users where email = 'taken@example.com'").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("rows for taken@example.com: %d, want 1", n)
	}
}
