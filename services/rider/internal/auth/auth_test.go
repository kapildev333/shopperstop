package auth

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
	"github.com/kapildev333/shopperstop/services/rider/internal/testdb"
)

const testPepper = "test-pepper-test-pepper-test-pepper-00"

// testStoreID is the store the fixture riders belong to. riders.store_id has no
// foreign key (D32), so no store row is needed.
const testStoreID = "00000000-0000-4000-8000-000000000401"

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("auth")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

// testHash is one bcrypt hash shared by every fixture, so the package pays
// the cost-12 hash once.
var testHash = sync.OnceValue(func() string {
	h, err := HashPassword("password123")
	if err != nil {
		panic(err)
	}
	return h
})

// emailSeq makes every fixture email unique, so one test can create several riders.
var emailSeq atomic.Int64

// testEmail is unique per call, so tests share one schema without clashes.
func testEmail(t *testing.T, prefix string) string {
	return fmt.Sprintf("%s%s.%d@example.com", prefix, strings.ToLower(t.Name()), emailSeq.Add(1))
}

// newRider inserts an active rider with the fixture password and returns its id.
func newRider(t *testing.T) string {
	t.Helper()
	var id string
	err := testPool.QueryRow(context.Background(),
		"insert into riders (store_id, email, name, password_hash) values ($1, $2, 'Test Rider', $3) returning id",
		testStoreID, testEmail(t, "rider."), testHash()).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// hashOf is the stored form of a token: sha256 over the token text and the pepper.
func hashOf(token string) []byte {
	sum := sha256.Sum256(append([]byte(token), testPepper...))
	return sum[:]
}

// probeRouter is the real httpx router with one probe route behind RequireRider.
// The probe answers the rider id the accessor found in its context.
func probeRouter(a *Auth) http.Handler {
	r := httpx.NewRouter(nil)
	r.With(a.RequireRider).Get("/probe/rider", func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, CurrentRider(r.Context()).ID)
	})
	return r
}

func get(h http.Handler, path, authorization string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if authorization != "" {
		req.Header.Set("Authorization", authorization)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestTokenStoredAsPepperedHash(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil, nil)
	rider := newRider(t)
	tok, err := a.startSession(ctx, rider)
	if err != nil {
		t.Fatal(err)
	}
	if len(tok) != 43 {
		t.Fatalf("token has %d characters, want 43 (32 bytes, unpadded base64url)", len(tok))
	}
	var n int
	if err := testPool.QueryRow(ctx, "select count(*) from sessions where token_hash = $1", hashOf(tok)).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("%d sessions with sha256(token || pepper), want 1", n)
	}
	var row string
	if err := testPool.QueryRow(ctx, "select s::text from sessions s where token_hash = $1", hashOf(tok)).Scan(&row); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(row, tok) {
		t.Fatalf("session row contains the token: %s", row)
	}
}

func TestRiderSessionExpired(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil, nil)
	tok, err := a.startSession(ctx, newRider(t))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, "update sessions set expires_at = now() - interval '1 second' where token_hash = $1", hashOf(tok)); err != nil {
		t.Fatal(err)
	}
	if rec := get(probeRouter(a), "/probe/rider", "Bearer "+tok); rec.Code != http.StatusUnauthorized {
		t.Fatalf("expired session: %d, want 401", rec.Code)
	}
}

func TestRiderSessionSlides(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil, nil)
	rider := newRider(t)
	tok, err := a.startSession(ctx, rider)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, "update sessions set last_seen_at = now() - interval '2 hours', expires_at = now() + interval '1 day' where token_hash = $1", hashOf(tok)); err != nil {
		t.Fatal(err)
	}
	if rec := get(probeRouter(a), "/probe/rider", "Bearer "+tok); rec.Code != http.StatusOK || rec.Body.String() != rider {
		t.Fatalf("use: %d %q, want 200 with the rider id", rec.Code, rec.Body)
	}
	var lastSeen, expires time.Time
	if err := testPool.QueryRow(ctx, "select last_seen_at, expires_at from sessions where token_hash = $1", hashOf(tok)).Scan(&lastSeen, &expires); err != nil {
		t.Fatal(err)
	}
	if time.Since(lastSeen) > time.Minute {
		t.Errorf("last_seen_at %v, want within seconds of now", lastSeen)
	}
	if until := time.Until(expires); until < 29*24*time.Hour || until > 31*24*time.Hour {
		t.Errorf("expires_at is %v from now, want about 30 days", until)
	}
}

func TestRiderSessionWithinHourUnchanged(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil, nil)
	tok, err := a.startSession(ctx, newRider(t))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, "update sessions set last_seen_at = now() - interval '30 minutes', expires_at = now() + interval '1 day' where token_hash = $1", hashOf(tok)); err != nil {
		t.Fatal(err)
	}
	var lastBefore, expiresBefore time.Time
	if err := testPool.QueryRow(ctx, "select last_seen_at, expires_at from sessions where token_hash = $1", hashOf(tok)).Scan(&lastBefore, &expiresBefore); err != nil {
		t.Fatal(err)
	}
	if rec := get(probeRouter(a), "/probe/rider", "Bearer "+tok); rec.Code != http.StatusOK {
		t.Fatalf("use: %d, want 200", rec.Code)
	}
	var lastAfter, expiresAfter time.Time
	if err := testPool.QueryRow(ctx, "select last_seen_at, expires_at from sessions where token_hash = $1", hashOf(tok)).Scan(&lastAfter, &expiresAfter); err != nil {
		t.Fatal(err)
	}
	if !lastAfter.Equal(lastBefore) || !expiresAfter.Equal(expiresBefore) {
		t.Fatalf("session changed within the hour: last_seen_at %v -> %v, expires_at %v -> %v", lastBefore, lastAfter, expiresBefore, expiresAfter)
	}
}

// errCode returns the code of the error envelope in rec.
func errCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body %q is not the error envelope: %v", rec.Body.String(), err)
	}
	return body.Error.Code
}

func TestRiderProbeRefusesMissingToken(t *testing.T) {
	a := New(testPool, testPepper, nil, nil)
	for _, authz := range []string{"", "Basic abc", "Bearer not-a-real-token"} {
		rec := get(probeRouter(a), "/probe/rider", authz)
		if rec.Code != http.StatusUnauthorized || errCode(t, rec) != "unauthorized" {
			t.Errorf("Authorization %q: %d %s, want 401 unauthorized", authz, rec.Code, rec.Body)
		}
	}
}

// TestStartSessionSweepsExpired: starting a session deletes every session at
// or past its expiry, of any rider, and keeps the live ones.
func TestStartSessionSweepsExpired(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil, nil)
	var expired, live []string
	for i, rider := range []string{newRider(t), newRider(t), newRider(t), newRider(t)} {
		tok, err := a.startSession(ctx, rider)
		if err != nil {
			t.Fatal(err)
		}
		if i < 2 {
			if _, err := testPool.Exec(ctx, "update sessions set expires_at = now() - interval '1 second' where token_hash = $1", hashOf(tok)); err != nil {
				t.Fatal(err)
			}
			expired = append(expired, tok)
		} else {
			live = append(live, tok)
		}
	}
	fresh, err := a.startSession(ctx, newRider(t))
	if err != nil {
		t.Fatal(err)
	}
	count := func(tok string) int {
		var n int
		if err := testPool.QueryRow(ctx, "select count(*) from sessions where token_hash = $1", hashOf(tok)).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	for _, tok := range expired {
		if n := count(tok); n != 0 {
			t.Fatalf("expired session still stored (%d rows), want swept", n)
		}
	}
	for _, tok := range append(live, fresh) {
		if n := count(tok); n != 1 {
			t.Fatalf("live session has %d rows, want kept", n)
		}
	}
}
