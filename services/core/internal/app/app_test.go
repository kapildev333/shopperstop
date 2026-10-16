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
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/blob"
	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

const testPepper = "test-pepper-test-pepper-test-pepper-00"

// testServiceToken is the rider service's token on the shared test server.
const testServiceToken = "test-rider-service-token-test-rider-00"

// srv is the shared test server every route test in this package uses. Its
// limiter is too large to trip, so only the rate-limit test sees a 429.
var (
	srv      *httptest.Server
	testPool *pgxpool.Pool
	// filesDir is the files directory every test server stores uploads in.
	filesDir string
	// mails captures the mail the shared server sends.
	mails = &outbox{}
)

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("app")
	var err error
	if filesDir, err = os.MkdirTemp("", "core-app-files-"); err != nil {
		panic(err)
	}
	// staff_users.store_id references stores (core-P2-L2): the staff fixtures' store exists.
	if _, err := testPool.Exec(context.Background(),
		"insert into stores (id, name, address_line, pincode, promised_minutes) values ($1, 'Test store', '1 Test Rd', '560001', 10)",
		testStoreID); err != nil {
		panic(err)
	}
	a := auth.New(testPool, testPepper, auth.NewLimiter(1_000_000, 1_000_000, time.Hour, time.Now), map[string]string{"rider": testServiceToken})
	a.Mailer = mails
	srv = httptest.NewServer(New(testPool, []string{"http://localhost:5173"}, a, blob.Disk{Dir: filesDir}))
	code := m.Run()
	srv.Close()
	cleanup()
	os.RemoveAll(filesDir)
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
		Code       string   `json:"code"`
		Message    string   `json:"message"`
		Field      string   `json:"field"`
		ProductIDs []string `json:"productIds"`
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
	down := httptest.NewServer(New(pool, nil, auth.New(pool, testPepper, nil, nil), blob.Disk{Dir: filesDir}))
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

// TestWrongMethod: a served path asked with a method it does not serve answers
// 405 method_not_allowed with Allow naming the path's methods, and the code is
// one the contract's Error schema lists.
func TestWrongMethod(t *testing.T) {
	doc, err := os.ReadFile("../../openapi.json")
	if err != nil {
		t.Fatal(err)
	}
	var spec struct {
		Components struct {
			Schemas struct {
				Error struct {
					Properties struct {
						Error struct {
							Properties struct {
								Code struct {
									Enum []string `json:"enum"`
								} `json:"code"`
							} `json:"properties"`
						} `json:"error"`
					} `json:"properties"`
				} `json:"Error"`
			} `json:"schemas"`
		} `json:"components"`
	}
	if err := json.Unmarshal(doc, &spec); err != nil {
		t.Fatal(err)
	}
	codes := spec.Components.Schemas.Error.Properties.Error.Properties.Code.Enum

	for _, row := range []struct{ method, path, allow string }{
		{http.MethodDelete, "/api/core/v1/healthz", "GET"},
		{http.MethodPut, "/api/core/v1/me", "GET, PATCH"},
		{http.MethodGet, "/api/core/v1/auth/sign-in", "POST"},
	} {
		req, err := http.NewRequest(row.method, srv.URL+row.path, nil)
		if err != nil {
			t.Fatal(err)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			t.Fatal(err)
		}
		e := decodeError(t, body)
		if resp.StatusCode != http.StatusMethodNotAllowed || e.Error.Code != "method_not_allowed" {
			t.Fatalf("%s %s: got %d %s, want 405 method_not_allowed", row.method, row.path, resp.StatusCode, body)
		}
		if got := resp.Header.Get("Allow"); got != row.allow {
			t.Fatalf("%s %s: Allow %q, want %q", row.method, row.path, got, row.allow)
		}
		if !slices.Contains(codes, e.Error.Code) {
			t.Fatalf("openapi.json Error code enum %v does not list %s", codes, e.Error.Code)
		}
	}
}
