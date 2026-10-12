package app

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

const testPepper = "test-pepper-test-pepper-test-pepper-00"

// srv is the shared test server every route test in this package uses. Its
// limiter is too large to trip, so only the rate-limit test sees a 429.
var (
	srv      *httptest.Server
	testPool *pgxpool.Pool
)

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("app")
	a := auth.New(testPool, testPepper, auth.NewLimiter(1_000_000, 1_000_000, time.Hour, time.Now))
	srv = httptest.NewServer(New(testPool, []string{"http://localhost:5173"}, a))
	code := m.Run()
	srv.Close()
	cleanup()
	os.Exit(code)
}

func get(t *testing.T, base, path string) (int, string) {
	t.Helper()
	resp, err := http.Get(base + path)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, strings.TrimSpace(string(body))
}

// callAt sends one request to base and returns its status and body. A nil
// body sends none; any other body is marshalled as JSON.
func callAt(t *testing.T, base, method, path, token string, body any) (int, []byte) {
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
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
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

// call is callAt against the shared server.
func call(t *testing.T, method, path, token string, body any) (int, []byte) {
	t.Helper()
	return callAt(t, srv.URL, method, path, token, body)
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

func TestHealthz(t *testing.T) {
	status, body := get(t, srv.URL, "/api/core/v1/healthz")
	if status != http.StatusOK || body != `{"status":"ok"}` {
		t.Fatalf("healthz: got %d %s, want 200 {\"status\":\"ok\"}", status, body)
	}
}

func TestReadyzWhenDatabaseAnswers(t *testing.T) {
	status, body := get(t, srv.URL, "/api/core/v1/readyz")
	if status != http.StatusOK || body != `{"status":"ok"}` {
		t.Fatalf("readyz: got %d %s, want 200 {\"status\":\"ok\"}", status, body)
	}
}

// TestReadyzWhenDatabaseIsDown points the pool at a listener that accepts
// connections and never answers, so the ping only ends at readyz's 2 s timeout.
func TestReadyzWhenDatabaseIsDown(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	// The accept loop owns its connections: when Accept fails on close, it closes them.
	go func() {
		var held []net.Conn
		defer func() {
			for _, c := range held {
				c.Close()
			}
		}()
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			held = append(held, c) // keeps the peer open and silent
		}
	}()
	t.Cleanup(func() { ln.Close() })

	url := "postgres://shopperstop_core:shopperstop_core@" + ln.Addr().String() + "/shopperstop_core_test?sslmode=disable"
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	down := httptest.NewServer(New(pool, nil, auth.New(pool, testPepper, nil)))
	t.Cleanup(down.Close)

	// healthz never touches the database, so it answers 200 with the pool down.
	if status, body := get(t, down.URL, "/api/core/v1/healthz"); status != http.StatusOK || body != `{"status":"ok"}` {
		t.Fatalf("healthz with database down: got %d %s, want 200 {\"status\":\"ok\"}", status, body)
	}

	start := time.Now()
	status, body := get(t, down.URL, "/api/core/v1/readyz")
	elapsed := time.Since(start)
	if status != http.StatusServiceUnavailable {
		t.Fatalf("readyz: got %d %s, want 503", status, body)
	}
	var env struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal([]byte(body), &env); err != nil || env.Error.Code != "internal" {
		t.Fatalf("readyz body %s: want error envelope with code internal", body)
	}
	if elapsed < time.Second || elapsed > 5*time.Second {
		t.Fatalf("readyz took %v, want about 2s", elapsed)
	}
}
