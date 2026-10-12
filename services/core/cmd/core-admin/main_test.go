package main

import (
	"context"
	"io"
	"net/url"
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

// The argument refusals return before any config load or database call.
func TestRunRefusesBadArguments(t *testing.T) {
	for _, args := range [][]string{{"create-admin"}, {"bogus"}} {
		var stderr strings.Builder
		if code := run(args, io.Discard, &stderr); code != 2 || !strings.Contains(stderr.String(), "usage: core-admin") {
			t.Fatalf("run %v: exit %d stderr %q, want exit 2 with the usage line", args, code, stderr.String())
		}
	}
}

// TestCreateAdminRefusesBadPasswordBeforeHashing: each refusal happens before
// any hash, so nothing is stored.
func TestCreateAdminRefusesBadPasswordBeforeHashing(t *testing.T) {
	ctx := context.Background()
	cases := []struct{ stdin, want string }{
		{"", "password is required"},
		{"\n", "password is required"},
		{"abc\n", "password: must be 8 to 72 bytes"},
	}
	for _, c := range cases {
		err := createAdmin(ctx, testPool, "short@example.com", strings.NewReader(c.stdin), io.Discard)
		if err == nil || !strings.Contains(err.Error(), c.want) {
			t.Fatalf("stdin %q: got %v, want an error containing %q", c.stdin, err, c.want)
		}
	}
	var n int
	if err := testPool.QueryRow(ctx, "select count(*) from staff_users where email = 'short@example.com'").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("rows for short@example.com: %d, want 0", n)
	}
}

// TestCreateAdmin reads the password from stdin with a CRLF ending, creates the
// active admin named Admin (one cost-12 hash), and refuses a second create of
// the same email with a 409 that names the field (a second hash, then the
// conflict), leaving one row.
func TestCreateAdmin(t *testing.T) {
	ctx := context.Background()
	var out strings.Builder
	if err := createAdmin(ctx, testPool, "root@example.com", strings.NewReader("rootpass123\r\n"), &out); err != nil {
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
	if !strings.HasPrefix(hash, "$2a$12$") {
		t.Fatalf("stored hash %q is not bcrypt at cost 12", hash)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte("rootpass123")); err != nil {
		t.Fatalf("stored hash does not match the stdin password: %v", err)
	}

	err := createAdmin(ctx, testPool, "root@example.com", strings.NewReader("rootpass123\n"), io.Discard)
	if err == nil || !strings.Contains(err.Error(), "email: email already registered") {
		t.Fatalf("second createAdmin: got %v, want a 409 naming the email field", err)
	}
	var n int
	if err := testPool.QueryRow(ctx, "select count(*) from staff_users where email = 'root@example.com'").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("rows for root@example.com: %d, want 1", n)
	}
}

// commandURL is the test database with search_path set to the schema, so the
// command under test writes to this package's schema.
func commandURL(t *testing.T, schema string) string {
	t.Helper()
	base := os.Getenv("SHOPPERSTOP_CORE_TEST_DATABASE_URL")
	if base == "" {
		base = "postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable"
	}
	u, err := url.Parse(base)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema+",public")
	u.RawQuery = q.Encode()
	return u.String()
}

// TestSeedDemoExitCodes: --reset loads the demo accounts and exits 0; a plain
// seed-demo over them hits the duplicate key and exits 1 with the reason.
func TestSeedDemoExitCodes(t *testing.T) {
	ctx := context.Background()
	var schema string
	if err := testPool.QueryRow(ctx, "select current_schema()").Scan(&schema); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SHOPPERSTOP_CORE_DATABASE_URL", commandURL(t, schema))
	t.Setenv("SHOPPERSTOP_CORE_ADDR", ":8080")
	t.Setenv("SHOPPERSTOP_CORE_SESSION_PEPPER", "test-pepper-test-pepper-test-pepper-00")
	t.Setenv("SHOPPERSTOP_CORE_WEB_ORIGINS", "http://localhost:5173")
	t.Setenv("SHOPPERSTOP_CORE_FILES_DIR", t.TempDir())

	var stdout, stderr strings.Builder
	if code := run([]string{"seed-demo", "--reset"}, &stdout, &stderr); code != 0 {
		t.Fatalf("seed-demo --reset: exit %d stderr %q, want 0", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), "seed-demo: demo accounts loaded") {
		t.Fatalf("seed-demo --reset stdout %q, want the loaded line", stdout.String())
	}

	stdout.Reset()
	stderr.Reset()
	if code := run([]string{"seed-demo"}, &stdout, &stderr); code != 1 {
		t.Fatalf("second seed-demo: exit %d, want 1", code)
	}
	if !strings.Contains(stderr.String(), "seed-demo: insert demo admin") || !strings.Contains(stderr.String(), "duplicate key") {
		t.Fatalf("second seed-demo stderr %q, want the duplicate key reason", stderr.String())
	}
}
