package seed_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/app"
	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/seed"
	"github.com/kapildev333/shopperstop/services/rider/internal/testdb"
)

const testPepper = "test-pepper-test-pepper-test-pepper-00"

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("seed")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

// server serves the rider router over the test pool. Core is never reached:
// the client points at a closed port, so a seeded sign-in cannot need core.
func server(t *testing.T) string {
	t.Helper()
	c := core.New("http://127.0.0.1:1", "unused", time.Now)
	srv := httptest.NewServer(app.New(testPool, nil, auth.New(testPool, testPepper, nil, c), nil))
	t.Cleanup(srv.Close)
	return srv.URL
}

// signIn posts a sign-in and returns the status and body.
func signIn(t *testing.T, base, email, password string) (int, []byte) {
	t.Helper()
	body, err := json.Marshal(map[string]string{"email": email, "password": password})
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.Post(base+"/api/rider/v1/auth/sign-in", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, out
}

func countRows(t *testing.T, query string) int {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(), query).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// TestResetTwiceLeavesDemoRiders: a rider and a session the demo does not own
// are removed by reset, and the four demo riders sign in with rider12345.
func TestResetTwiceLeavesDemoRiders(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	if _, err := testPool.Exec(ctx, `insert into riders (store_id, email, name, password_hash)
		values ('00000000-0000-4000-8000-000000000401', 'other@example.com', 'Other', 'x')`); err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, `insert into sessions (rider_id, token_hash, expires_at)
		select id, decode('00', 'hex'), now() + interval '1 day' from riders where email = 'other@example.com'`); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := seed.Reset(ctx, testPool); err != nil {
			t.Fatalf("reset %d: %v", i+1, err)
		}
	}
	if n := countRows(t, "select count(*) from riders"); n != 4 {
		t.Fatalf("riders after two resets: %d, want 4", n)
	}
	if n := countRows(t, "select count(*) from riders where email = 'other@example.com'"); n != 0 {
		t.Fatalf("other rider survived reset: %d rows", n)
	}
	if n := countRows(t, "select count(*) from sessions"); n != 0 {
		t.Fatalf("sessions after reset: %d, want 0", n)
	}
	base := server(t)
	for _, email := range []string{"rider1-koramangala@shopperstop.local", "rider2-koramangala@shopperstop.local",
		"rider1-indiranagar@shopperstop.local", "rider2-indiranagar@shopperstop.local"} {
		if status, body := signIn(t, base, email, "rider12345"); status != http.StatusOK {
			t.Errorf("sign-in %s: %d %s, want 200", email, status, body)
		}
	}
}

// TestLoadTwiceFails: load into an empty table works; the second load hits
// the duplicate keys, fails, and leaves the four riders alone.
func TestLoadTwiceFails(t *testing.T) {
	ctx := context.Background()
	if _, err := testPool.Exec(ctx, "truncate sessions, riders"); err != nil {
		t.Fatal(err)
	}
	if err := seed.Load(ctx, testPool); err != nil {
		t.Fatalf("first load: %v", err)
	}
	if err := seed.Load(ctx, testPool); err == nil {
		t.Fatal("second load succeeded, want a duplicate key error")
	}
	if n := countRows(t, "select count(*) from riders"); n != 4 {
		t.Fatalf("riders after failed load: %d, want 4", n)
	}
}

// TestSummaryMatchesSeed: every sign-in seed.Summary prints works and names
// the printed store, every id it prints is one riders row, and the id marked
// Postman is the riderId of docs/postman/local.postman_environment.json.
func TestSummaryMatchesSeed(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	base := server(t)
	stores := map[string]string{"Koramangala": "00000000-0000-4000-8000-000000000401", "Indiranagar": "00000000-0000-4000-8000-000000000402"}
	summaryID := regexp.MustCompile(`^00000000-0000-4000-8000-0000000008[0-9a-f]{2}$`)
	summaryPostman := regexp.MustCompile(`\(Postman riderId\)`)
	postman := ""
	seenID := map[string]bool{}
	signIns, ids := 0, 0
	for _, line := range strings.Split(seed.Summary, "\n") {
		f := strings.Fields(line)
		switch {
		case len(f) == 3 && strings.Contains(f[0], "@"):
			signIns++
			status, body := signIn(t, base, f[0], f[1])
			var s struct {
				Rider struct {
					Email   string `json:"email"`
					StoreID string `json:"storeId"`
				} `json:"rider"`
			}
			if status != http.StatusOK || json.Unmarshal(body, &s) != nil || s.Rider.Email != f[0] || s.Rider.StoreID != stores[f[2]] {
				t.Errorf("sign-in %q: got %d %s, want 200 for %s at store %s", line, status, body, f[0], stores[f[2]])
			}
		case len(f) >= 2 && summaryID.MatchString(f[0]):
			ids++
			if seenID[f[0]] {
				t.Errorf("line %q repeats id %s from an earlier line", line, f[0])
			}
			seenID[f[0]] = true
			if f[1] != "riders" {
				t.Errorf("line %q names table %q, want riders", line, f[1])
				continue
			}
			if n := countRows(t, "select count(*) from riders where id = '"+f[0]+"'"); n != 1 {
				t.Errorf("line %q: %d rows with that id, want 1", line, n)
			}
			if summaryPostman.MatchString(line) {
				postman = f[0]
			}
		}
	}
	if signIns != 4 || ids != 4 {
		t.Fatalf("summary holds %d sign-ins and %d ids, want 4 and 4", signIns, ids)
	}
	const wantPostman = "00000000-0000-4000-8000-000000000801"
	if postman != wantPostman {
		t.Errorf("summary marks %q as Postman riderId, want %s", postman, wantPostman)
	}

	raw, err := os.ReadFile("../../../../docs/postman/local.postman_environment.json")
	if err != nil {
		t.Fatal(err)
	}
	var env struct {
		Values []struct{ Key, Value string } `json:"values"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, v := range env.Values {
		if v.Key == "riderId" {
			found = true
			if v.Value != postman {
				t.Errorf("Postman riderId is %q, the summary marks %q", v.Value, postman)
			}
		}
	}
	if !found {
		t.Error("Postman environment has no riderId")
	}
}
