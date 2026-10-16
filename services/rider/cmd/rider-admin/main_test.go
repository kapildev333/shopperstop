package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/app"
	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/coretest"
	"github.com/kapildev333/shopperstop/services/rider/internal/testdb"
)

const (
	testPepper = "test-pepper-test-pepper-test-pepper-00"
	testStore  = "00000000-0000-4000-8000-000000000401"
	usageLine  = "usage: rider-admin migrate | seed-demo [--reset] | create-rider <email> --store <id>"
)

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("rideradmin")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

// The argument refusals return before any config load or database call.
func TestRunRefusesBadArguments(t *testing.T) {
	cases := [][]string{
		{"create-rider"},
		{"create-rider", "a@b.c"},
		{"create-rider", "a@b.c", "--shop", "x"},
		{"bogus"},
	}
	for _, args := range cases {
		var stderr strings.Builder
		if code := run(args, io.Discard, &stderr); code != 2 || !strings.Contains(stderr.String(), usageLine) {
			t.Fatalf("run %v: exit %d stderr %q, want exit 2 with %q", args, code, stderr.String(), usageLine)
		}
	}
}

// riderClient is a core client over a fake that knows testStore.
func riderClient(t *testing.T) *core.Client {
	t.Helper()
	fake := coretest.New()
	t.Cleanup(fake.Close)
	fake.AddStore(core.Store{ID: testStore, Name: "Koramangala", IsOpen: true})
	return core.New(fake.URL(), "unused", time.Now)
}

func countRiders(t *testing.T, email string) int {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(), "select count(*) from riders where email = $1", email).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// TestCreateRider reads the password from stdin, creates the active rider
// named Rider at the store, and the rider then signs in with that password.
func TestCreateRider(t *testing.T) {
	ctx := context.Background()
	var out strings.Builder
	if err := createRider(ctx, testPool, riderClient(t), "new@example.com", testStore, strings.NewReader("password123\n"), &out); err != nil {
		t.Fatalf("createRider: %v", err)
	}
	if got := strings.TrimSpace(out.String()); got != "created rider new@example.com" {
		t.Fatalf("output %q, want %q", got, "created rider new@example.com")
	}
	var name, storeID string
	var active bool
	if err := testPool.QueryRow(ctx, "select name, store_id::text, is_active from riders where email = 'new@example.com'").
		Scan(&name, &storeID, &active); err != nil {
		t.Fatal(err)
	}
	if name != "Rider" || storeID != testStore || !active {
		t.Fatalf("row: name %q store %q active %v, want Rider at %s, active", name, storeID, active, testStore)
	}

	srv := httptest.NewServer(app.New(testPool, nil, auth.New(testPool, testPepper, nil, riderClient(t)), nil))
	defer srv.Close()
	body, _ := json.Marshal(map[string]string{"email": "new@example.com", "password": "password123"})
	resp, err := http.Post(srv.URL+"/api/rider/v1/auth/sign-in", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("sign-in with the stdin password: %d, want 200", resp.StatusCode)
	}
}

// TestCreateRiderUnknownStore: core answers 404 for the store, so the refusal
// names storeId and no rider is created.
func TestCreateRiderUnknownStore(t *testing.T) {
	var out strings.Builder
	err := createRider(context.Background(), testPool, riderClient(t), "lost@example.com",
		"00000000-0000-4000-8000-0000000009ff", strings.NewReader("password123\n"), &out)
	if err == nil || !strings.Contains(err.Error(), "storeId") {
		t.Fatalf("got %v, want an error naming storeId", err)
	}
	if n := countRiders(t, "lost@example.com"); n != 0 {
		t.Fatalf("rows for lost@example.com: %d, want 0", n)
	}
}

// TestCreateRiderRefusesEmptyPassword: no password on stdin is refused before
// any hash, so nothing is stored.
func TestCreateRiderRefusesEmptyPassword(t *testing.T) {
	ctx := context.Background()
	for _, stdin := range []string{"", "\n"} {
		err := createRider(ctx, testPool, riderClient(t), "nopass@example.com", testStore, strings.NewReader(stdin), io.Discard)
		if err == nil || !strings.Contains(err.Error(), "password is required on stdin") {
			t.Fatalf("stdin %q: got %v, want password is required on stdin", stdin, err)
		}
	}
	if n := countRiders(t, "nopass@example.com"); n != 0 {
		t.Fatalf("rows for nopass@example.com: %d, want 0", n)
	}
}
