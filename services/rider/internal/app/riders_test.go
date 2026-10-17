package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
)

const (
	testPassword = "password123"
	testStore    = "00000000-0000-4000-8000-000000000401"
	signInPath   = "/api/rider/v1/auth/sign-in"
)

// cheapHash is the test password at bcrypt.MinCost. Fixtures store it directly
// and sign in with it in milliseconds; only sign-in through the router is real.
var cheapHash = sync.OnceValue(func() string {
	h, err := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.MinCost)
	if err != nil {
		panic(err)
	}
	return string(h)
})

var riderSeq atomic.Int64

func uniqueEmail(t *testing.T) string {
	return fmt.Sprintf("%s.%d@example.com", strings.ToLower(t.Name()), riderSeq.Add(1))
}

// seedRider inserts a rider directly at MinCost and returns its id.
func seedRider(t *testing.T, email string, active bool) string {
	t.Helper()
	var id string
	err := testPool.QueryRow(context.Background(),
		"insert into riders (store_id, email, name, password_hash, is_active) values ($1, $2, 'Asha Rao', $3, $4) returning id",
		testStore, email, cheapHash(), active).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// riderJSON is the Rider the API answers.
type riderJSON struct {
	ID       string `json:"id"`
	StoreID  string `json:"storeId"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	IsActive bool   `json:"isActive"`
	IsOnline bool   `json:"isOnline"`
}

// signInBody is the 200 body of sign-in.
type signInBody struct {
	Token string    `json:"token"`
	Rider riderJSON `json:"rider"`
}

// envelope is the error envelope every failure answers with.
type envelope struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Field   string `json:"field"`
	} `json:"error"`
}

func decodeError(t *testing.T, body []byte) envelope {
	t.Helper()
	var e envelope
	if err := json.Unmarshal(body, &e); err != nil {
		t.Fatalf("body %s is not the error envelope: %v", body, err)
	}
	return e
}

// send makes one request to base; authorization is the whole Authorization
// header value, or "". A nil body sends none, any other is marshalled as JSON.
func send(t *testing.T, base, method, path, authorization string, body any) (int, []byte) {
	t.Helper()
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, base+path, r)
	if err != nil {
		t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if authorization != "" {
		req.Header.Set("Authorization", authorization)
	}
	resp, err := http.DefaultClient.Do(req)
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

// callAt sends a request with the token as its bearer credential ("" sends none).
func callAt(t *testing.T, base, method, path, token string, body any) (int, []byte) {
	t.Helper()
	authorization := ""
	if token != "" {
		authorization = "Bearer " + token
	}
	return send(t, base, method, path, authorization, body)
}

// signInAs signs in through the shared server and returns the 200 body.
func signInAs(t *testing.T, email, password string) signInBody {
	t.Helper()
	status, body := callAt(t, srv.URL, http.MethodPost, signInPath, "", map[string]string{"email": email, "password": password})
	var s signInBody
	if status != http.StatusOK || json.Unmarshal(body, &s) != nil {
		t.Fatalf("sign-in of %s: got %d %s, want 200", email, status, body)
	}
	return s
}

func TestRiderSignIn(t *testing.T) {
	email := uniqueEmail(t)
	id := seedRider(t, email, true)
	status, body := callAt(t, srv.URL, http.MethodPost, signInPath, "", map[string]string{"email": email, "password": testPassword})
	var s signInBody
	if status != http.StatusOK || json.Unmarshal(body, &s) != nil || s.Token == "" {
		t.Fatalf("sign-in: got %d %s, want 200 with a token", status, body)
	}
	want := riderJSON{ID: id, StoreID: testStore, Email: email, Name: "Asha Rao", IsActive: true}
	if s.Rider != want {
		t.Fatalf("sign-in rider %+v, want %+v", s.Rider, want)
	}
	if strings.Contains(string(body), `"phone"`) {
		t.Fatalf("phone present although empty: %s", body)
	}
	if !strings.Contains(string(body), `"isOnline":false`) {
		t.Fatalf("sign-in rider lacks isOnline false: %s", body)
	}
	status, body = callAt(t, srv.URL, http.MethodGet, "/api/rider/v1/me", s.Token, nil)
	var me riderJSON
	if status != http.StatusOK || json.Unmarshal(body, &me) != nil || me != want {
		t.Fatalf("GET /me with the token: got %d %s, want 200 with the same rider", status, body)
	}
}

// TestRiderSignInRefusalsLookTheSame: a wrong password, an unknown email and an
// inactive rider with the right password answer the same 401.
func TestRiderSignInRefusalsLookTheSame(t *testing.T) {
	email := uniqueEmail(t)
	seedRider(t, email, true)
	inactive := uniqueEmail(t)
	seedRider(t, inactive, false)
	cases := []struct{ name, email, password string }{
		{"wrong password", email, "wrong-password"},
		{"unknown email", "nobody." + email, testPassword},
		{"inactive rider", inactive, testPassword},
	}
	var first envelope
	for i, c := range cases {
		status, body := callAt(t, srv.URL, http.MethodPost, signInPath, "", map[string]string{"email": c.email, "password": c.password})
		e := decodeError(t, body)
		if status != http.StatusUnauthorized || e.Error.Code != "unauthorized" {
			t.Fatalf("%s: got %d %s, want 401 unauthorized", c.name, status, body)
		}
		if i == 0 {
			first = e
		} else if !reflect.DeepEqual(first, e) {
			t.Fatalf("%s answered %+v, want the same as %s: %+v", c.name, e, cases[0].name, first)
		}
	}
}

func TestRiderSignInRefusesNUL(t *testing.T) {
	status, body := callAt(t, srv.URL, http.MethodPost, signInPath, "",
		map[string]string{"email": "rider\x00@example.com", "password": testPassword})
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" {
		t.Fatalf("NUL in email: got %d %s, want 400 validation", status, body)
	}
}

func TestRiderBearerRefusals(t *testing.T) {
	for _, authorization := range []string{"", "Basic abc", "Bearer not-a-real-token"} {
		status, body := send(t, srv.URL, http.MethodGet, "/api/rider/v1/me", authorization, nil)
		if e := decodeError(t, body); status != http.StatusUnauthorized || e.Error.Code != "unauthorized" {
			t.Fatalf("Authorization %q: got %d %s, want 401 unauthorized", authorization, status, body)
		}
	}
}

func TestRiderSignOutEndsOnlyThatSession(t *testing.T) {
	email := uniqueEmail(t)
	seedRider(t, email, true)
	a := signInAs(t, email, testPassword)
	b := signInAs(t, email, testPassword)
	if status, body := callAt(t, srv.URL, http.MethodPost, "/api/rider/v1/auth/sign-out", a.Token, nil); status != http.StatusNoContent {
		t.Fatalf("sign-out: got %d %s, want 204", status, body)
	}
	if status, _ := callAt(t, srv.URL, http.MethodGet, "/api/rider/v1/me", a.Token, nil); status != http.StatusUnauthorized {
		t.Fatalf("GET /me with the signed-out token: got %d, want 401", status)
	}
	if status, body := callAt(t, srv.URL, http.MethodGet, "/api/rider/v1/me", b.Token, nil); status != http.StatusOK {
		t.Fatalf("GET /me with the other session: got %d %s, want 200", status, body)
	}
}

// TestRiderSignInRateLimited uses its own server with the production limits:
// ten attempts for one email pass (wrong passwords), the eleventh is refused.
func TestRiderSignInRateLimited(t *testing.T) {
	a := auth.New(testPool, testPepper, auth.NewLimiter(10, 100, time.Hour, time.Now), nil)
	limited := httptest.NewServer(New(testPool, nil, a, nil))
	t.Cleanup(limited.Close)
	email := uniqueEmail(t)
	seedRider(t, email, true)
	for i := range 10 {
		status, body := callAt(t, limited.URL, http.MethodPost, signInPath, "", map[string]string{"email": email, "password": "wrong-password"})
		if status != http.StatusUnauthorized {
			t.Fatalf("attempt %d: got %d %s, want 401", i+1, status, body)
		}
	}
	status, body := callAt(t, limited.URL, http.MethodPost, signInPath, "", map[string]string{"email": email, "password": testPassword})
	if e := decodeError(t, body); status != http.StatusTooManyRequests || e.Error.Code != "rate_limited" {
		t.Fatalf("eleventh attempt: got %d %s, want 429 rate_limited", status, body)
	}
}

// signInFrom signs email in at base with testPassword over a new connection
// (so a new client port) carrying forwardedFor as X-Forwarded-For.
func signInFrom(t *testing.T, base, email, forwardedFor string) (int, []byte) {
	t.Helper()
	b, err := json.Marshal(map[string]string{"email": email, "password": testPassword})
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(http.MethodPost, base+signInPath, bytes.NewReader(b))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-For", forwardedFor)
	req.Close = true
	resp, err := http.DefaultClient.Do(req)
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

// signedUpEmail seeds an active rider and returns its email.
func signedUpEmail(t *testing.T) string {
	t.Helper()
	email := uniqueEmail(t)
	seedRider(t, email, true)
	return email
}

// TestRiderSignInRateLimitedPerIP: two sign-ins from one client IP pass and the
// third is refused, though every attempt names a different email and sends a
// different X-Forwarded-For. Each request opens a new connection, so a new
// client port: the key must drop the port, and X-Forwarded-For must not be trusted.
func TestRiderSignInRateLimitedPerIP(t *testing.T) {
	a := auth.New(testPool, testPepper, auth.NewLimiter(100, 2, time.Hour, time.Now), nil)
	limited := httptest.NewServer(New(testPool, nil, a, nil))
	t.Cleanup(limited.Close)
	for i, forwarded := range []string{"203.0.113.1", "203.0.113.2"} {
		if status, body := signInFrom(t, limited.URL, signedUpEmail(t), forwarded); status != http.StatusOK {
			t.Fatalf("attempt %d: got %d %s, want 200", i+1, status, body)
		}
	}
	status, body := signInFrom(t, limited.URL, signedUpEmail(t), "203.0.113.3")
	if e := decodeError(t, body); status != http.StatusTooManyRequests || e.Error.Code != "rate_limited" {
		t.Fatalf("third attempt from one IP: got %d %s, want 429 rate_limited", status, body)
	}
}

// TestRiderSignInRateLimitedPerForwardedIP: behind a trusted proxy the per-IP
// count keys on the first X-Forwarded-For address, so a third sign-in from one
// forwarded client is refused while another client behind the same proxy passes.
func TestRiderSignInRateLimitedPerForwardedIP(t *testing.T) {
	limit := auth.NewLimiter(100, 2, time.Hour, time.Now)
	limit.TrustProxy = true
	a := auth.New(testPool, testPepper, limit, nil)
	limited := httptest.NewServer(New(testPool, nil, a, nil))
	t.Cleanup(limited.Close)
	for i, forwarded := range []string{"203.0.113.7", " 203.0.113.7 , 10.0.0.1"} {
		if status, body := signInFrom(t, limited.URL, signedUpEmail(t), forwarded); status != http.StatusOK {
			t.Fatalf("attempt %d from 203.0.113.7: got %d %s, want 200", i+1, status, body)
		}
	}
	status, body := signInFrom(t, limited.URL, signedUpEmail(t), "203.0.113.7, 10.0.0.1")
	if e := decodeError(t, body); status != http.StatusTooManyRequests || e.Error.Code != "rate_limited" {
		t.Fatalf("third attempt from 203.0.113.7: got %d %s, want 429 rate_limited", status, body)
	}
	if status, body := signInFrom(t, limited.URL, signedUpEmail(t), "203.0.113.8, 10.0.0.1"); status != http.StatusOK {
		t.Fatalf("first attempt from 203.0.113.8 behind the same proxy: got %d %s, want 200", status, body)
	}
}

// TestRiderSignInEmptyForwardedForFallsBackToConnection: behind a trusted proxy
// an empty or blank X-Forwarded-For keys the count on the connection address,
// not on the empty string. The third attempt names 127.0.0.1 as its forwarded
// address, which only shares a bucket with the fallback if the fallback is used.
func TestRiderSignInEmptyForwardedForFallsBackToConnection(t *testing.T) {
	limit := auth.NewLimiter(100, 2, time.Hour, time.Now)
	limit.TrustProxy = true
	a := auth.New(testPool, testPepper, limit, nil)
	limited := httptest.NewServer(New(testPool, nil, a, nil))
	t.Cleanup(limited.Close)
	for i, forwarded := range []string{"", "   "} {
		if status, body := signInFrom(t, limited.URL, signedUpEmail(t), forwarded); status != http.StatusOK {
			t.Fatalf("attempt %d with X-Forwarded-For %q: got %d %s, want 200", i+1, forwarded, status, body)
		}
	}
	status, body := signInFrom(t, limited.URL, signedUpEmail(t), "127.0.0.1")
	if e := decodeError(t, body); status != http.StatusTooManyRequests || e.Error.Code != "rate_limited" {
		t.Fatalf("third attempt keyed on the connection address: got %d %s, want 429 rate_limited", status, body)
	}
}

// captureRequestLog sends the default logger to a buffer for the rest of the
// test and returns a function giving the last "request" line as a map.
// Tests that use it must not call t.Parallel: the default logger is global.
func captureRequestLog(t *testing.T) func() map[string]any {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })
	return func() map[string]any {
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
		return line
	}
}

func TestRiderRequestLogNamesSubject(t *testing.T) {
	email := uniqueEmail(t)
	id := seedRider(t, email, true)
	s := signInAs(t, email, testPassword)
	lastLine := captureRequestLog(t)
	if status, body := callAt(t, srv.URL, http.MethodGet, "/api/rider/v1/me", s.Token, nil); status != http.StatusOK {
		t.Fatalf("GET /me: got %d %s, want 200", status, body)
	}
	line := lastLine()
	if line["route"] != "/api/rider/v1/me" || line["status"] != float64(http.StatusOK) {
		t.Fatalf("request line route %v status %v, want /api/rider/v1/me 200", line["route"], line["status"])
	}
	if line["subjectType"] != "rider" || line["subjectId"] != id {
		t.Fatalf("request line subject %v %v, want rider %s", line["subjectType"], line["subjectId"], id)
	}
}
