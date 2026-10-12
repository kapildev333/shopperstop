package auth

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth/db"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

const testPepper = "test-pepper-test-pepper-test-pepper-00"

// testStoreID names a store that does not exist yet: staff_users.store_id has
// no foreign key until core-P2-L2.
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

// emailSeq makes every fixture email unique, so one test can create several users.
var emailSeq atomic.Int64

// testEmail is unique per call, so tests share one schema without clashes.
func testEmail(t *testing.T, prefix string) string {
	return fmt.Sprintf("%s%s.%d@example.com", prefix, strings.ToLower(t.Name()), emailSeq.Add(1))
}

func newCustomer(t *testing.T) db.CreateCustomerRow {
	t.Helper()
	row, err := db.New(testPool).CreateCustomer(context.Background(), db.CreateCustomerParams{
		Email: testEmail(t, "customer."), PasswordHash: testHash(), Name: "Test Customer",
	})
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func newStaff(t *testing.T, role db.StaffRole, storeID *string) db.CreateStaffRow {
	t.Helper()
	row, err := db.New(testPool).CreateStaff(context.Background(), db.CreateStaffParams{
		Email: testEmail(t, "staff."), PasswordHash: testHash(), Name: "Test Staff", Role: role, StoreID: storeID,
	})
	if err != nil {
		t.Fatal(err)
	}
	return row
}

// hashOf is the stored form of a token: sha256 over the token text and the pepper.
func hashOf(token string) []byte {
	sum := sha256.Sum256(append([]byte(token), testPepper...))
	return sum[:]
}

// probeRouter is the real httpx router with one probe route per middleware.
// Each probe answers the id the accessor found in its context.
func probeRouter(a *Auth) http.Handler {
	r := httpx.NewRouter(nil)
	r.With(a.RequireCustomer).Get("/probe/customer", func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, CustomerID(r.Context()))
	})
	r.With(a.RequireStaff).Get("/probe/staff", func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, CurrentStaff(r.Context()).ID)
	})
	r.With(a.RequireAdmin).Get("/probe/admin", func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, CurrentStaff(r.Context()).ID)
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

func TestRequireCustomerRejects(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil)
	h := probeRouter(a)
	cust := newCustomer(t)
	staff := newStaff(t, db.StaffRoleAdmin, nil)
	customerTok, err := a.startSession(ctx, "customer", cust.ID)
	if err != nil {
		t.Fatal(err)
	}
	staffTok, err := a.startSession(ctx, "staff", staff.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, authz := range []string{"", "Basic abc", "Bearer not-a-real-token", "Bearer " + staffTok} {
		rec := get(h, "/probe/customer", authz)
		if rec.Code != http.StatusUnauthorized || errCode(t, rec) != "unauthorized" {
			t.Errorf("Authorization %q: %d %s, want 401 unauthorized", authz, rec.Code, rec.Body)
		}
	}
	if rec := get(h, "/probe/customer", "Bearer "+customerTok); rec.Code != http.StatusOK || rec.Body.String() != cust.ID {
		t.Errorf("valid customer token: %d %q, want 200 with the customer id", rec.Code, rec.Body)
	}
}

func TestTokenStoredAsPepperedHash(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil)
	cust := newCustomer(t)
	tok, err := a.startSession(ctx, "customer", cust.ID)
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

func TestCustomerSessionExpired(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil)
	cust := newCustomer(t)
	tok, err := a.startSession(ctx, "customer", cust.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, "update sessions set expires_at = now() - interval '1 second' where token_hash = $1", hashOf(tok)); err != nil {
		t.Fatal(err)
	}
	if rec := get(probeRouter(a), "/probe/customer", "Bearer "+tok); rec.Code != http.StatusUnauthorized {
		t.Fatalf("expired session: %d, want 401", rec.Code)
	}
}

func TestCustomerSessionSlides(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil)
	cust := newCustomer(t)
	tok, err := a.startSession(ctx, "customer", cust.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, "update sessions set last_seen_at = now() - interval '2 hours', expires_at = now() + interval '1 day' where token_hash = $1", hashOf(tok)); err != nil {
		t.Fatal(err)
	}
	if rec := get(probeRouter(a), "/probe/customer", "Bearer "+tok); rec.Code != http.StatusOK {
		t.Fatalf("use: %d, want 200", rec.Code)
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

func TestCustomerSessionWithinHourUnchanged(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil)
	cust := newCustomer(t)
	tok, err := a.startSession(ctx, "customer", cust.ID)
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
	if rec := get(probeRouter(a), "/probe/customer", "Bearer "+tok); rec.Code != http.StatusOK {
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

func TestStaffSessionFixed(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil)
	staff := newStaff(t, db.StaffRoleAdmin, nil)
	tok, err := a.startSession(ctx, "staff", staff.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, "update sessions set expires_at = now() + interval '1 hour' where token_hash = $1", hashOf(tok)); err != nil {
		t.Fatal(err)
	}
	var before time.Time
	if err := testPool.QueryRow(ctx, "select expires_at from sessions where token_hash = $1", hashOf(tok)).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if rec := get(probeRouter(a), "/probe/staff", "Bearer "+tok); rec.Code != http.StatusOK {
		t.Fatalf("use: %d, want 200", rec.Code)
	}
	var after time.Time
	if err := testPool.QueryRow(ctx, "select expires_at from sessions where token_hash = $1", hashOf(tok)).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if !after.Equal(before) {
		t.Fatalf("staff session expiry moved from %v to %v, want fixed", before, after)
	}
}

func TestStaffSessionExpired(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil)
	staff := newStaff(t, db.StaffRoleAdmin, nil)
	tok, err := a.startSession(ctx, "staff", staff.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, "update sessions set expires_at = now() - interval '1 second' where token_hash = $1", hashOf(tok)); err != nil {
		t.Fatal(err)
	}
	if rec := get(probeRouter(a), "/probe/staff", "Bearer "+tok); rec.Code != http.StatusUnauthorized {
		t.Fatalf("expired staff session: %d, want 401", rec.Code)
	}
}

func TestRequireStaffRejectsCustomerToken(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil)
	cust := newCustomer(t)
	tok, err := a.startSession(ctx, "customer", cust.ID)
	if err != nil {
		t.Fatal(err)
	}
	rec := get(probeRouter(a), "/probe/staff", "Bearer "+tok)
	if rec.Code != http.StatusUnauthorized || errCode(t, rec) != "unauthorized" {
		t.Fatalf("customer token on staff route: %d %s, want 401 unauthorized", rec.Code, rec.Body)
	}
}

func TestInactiveStaffRejected(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil)
	staff := newStaff(t, db.StaffRoleAdmin, nil)
	tok, err := a.startSession(ctx, "staff", staff.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, "update staff_users set is_active = false where id = $1", staff.ID); err != nil {
		t.Fatal(err)
	}
	if rec := get(probeRouter(a), "/probe/staff", "Bearer "+tok); rec.Code != http.StatusUnauthorized {
		t.Fatalf("deactivated staff: %d, want 401", rec.Code)
	}
}

func TestRequireAdminForbidsStoreStaff(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil)
	h := probeRouter(a)
	store := testStoreID
	clerk := newStaff(t, db.StaffRoleStoreStaff, &store)
	admin := newStaff(t, db.StaffRoleAdmin, nil)
	clerkTok, err := a.startSession(ctx, "staff", clerk.ID)
	if err != nil {
		t.Fatal(err)
	}
	adminTok, err := a.startSession(ctx, "staff", admin.ID)
	if err != nil {
		t.Fatal(err)
	}
	rec := get(h, "/probe/admin", "Bearer "+clerkTok)
	if rec.Code != http.StatusForbidden || errCode(t, rec) != "forbidden" {
		t.Fatalf("store staff on admin route: %d %s, want 403 forbidden", rec.Code, rec.Body)
	}
	if rec := get(h, "/probe/admin", ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous on admin route: %d, want 401", rec.Code)
	}
	if rec := get(h, "/probe/admin", "Bearer "+adminTok); rec.Code != http.StatusOK || rec.Body.String() != admin.ID {
		t.Fatalf("admin on admin route: %d %q, want 200 with the admin id", rec.Code, rec.Body)
	}
}

func TestRequireCustomerLogsSubject(t *testing.T) {
	ctx := context.Background()
	a := New(testPool, testPepper, nil)
	cust := newCustomer(t)
	tok, err := a.startSession(ctx, "customer", cust.ID)
	if err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })

	if rec := get(probeRouter(a), "/probe/customer", "Bearer "+tok); rec.Code != http.StatusOK {
		t.Fatalf("use: %d, want 200", rec.Code)
	}
	var line map[string]any
	for _, l := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
		var m map[string]any
		if json.Unmarshal([]byte(l), &m) == nil && m["msg"] == "request" {
			line = m
		}
	}
	if line == nil {
		t.Fatalf("no request line in log %q", buf.String())
	}
	if line["subjectType"] != "customer" || line["subjectId"] != cust.ID {
		t.Fatalf("request line subject %v %v, want customer %s", line["subjectType"], line["subjectId"], cust.ID)
	}
}
