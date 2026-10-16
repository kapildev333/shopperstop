package app

import (
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

	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
	"github.com/kapildev333/shopperstop/services/rider/internal/delivery"
	"github.com/kapildev333/shopperstop/services/rider/internal/testdb"
)

// srv is the shared test server every route test in this package uses.
const testPepper = "test-pepper-test-pepper-test-pepper-00"

var (
	srv      *httptest.Server
	testPool *pgxpool.Pool
)

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("app")
	stopCore := startCore()
	a := auth.New(testPool, testPepper, auth.NewLimiter(1_000_000, 1_000_000, time.Hour, time.Now), coreClient)
	srv = httptest.NewServer(New(testPool, []string{"http://localhost:15175"}, a, delivery.New(testPool, coreClient)))
	code := m.Run()
	srv.Close()
	stopCore()
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

// call sends one bodiless request to the shared server and returns its status and body.
func call(t *testing.T, method, path string) (int, []byte) {
	t.Helper()
	req, err := http.NewRequest(method, srv.URL+path, nil)
	if err != nil {
		t.Fatal(err)
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

func TestHealthz(t *testing.T) {
	status, body := get(t, srv.URL, "/api/rider/v1/healthz")
	if status != http.StatusOK || body != `{"status":"ok"}` {
		t.Fatalf("healthz: got %d %s, want 200 {\"status\":\"ok\"}", status, body)
	}
}

func TestReadyzWhenDatabaseAnswers(t *testing.T) {
	status, body := get(t, srv.URL, "/api/rider/v1/readyz")
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

	url := "postgres://shopperstop_rider:shopperstop_rider@" + ln.Addr().String() + "/shopperstop_rider_test?sslmode=disable"
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	down := httptest.NewServer(New(pool, nil, auth.New(pool, testPepper, nil, nil), nil))
	t.Cleanup(down.Close)

	// healthz never touches the database, so it answers 200 with the pool down.
	if status, body := get(t, down.URL, "/api/rider/v1/healthz"); status != http.StatusOK || body != `{"status":"ok"}` {
		t.Fatalf("healthz with database down: got %d %s, want 200 {\"status\":\"ok\"}", status, body)
	}

	start := time.Now()
	status, body := get(t, down.URL, "/api/rider/v1/readyz")
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

// TestUnknownRouteAndWrongMethod: an unknown path answers 404 not_found; a
// served path asked with a method it does not serve answers 405
// method_not_allowed with Allow naming the path's methods, and the code is one
// the contract's Error schema lists.
func TestUnknownRouteAndWrongMethod(t *testing.T) {
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

	for _, c := range []struct{ method, path, allow string }{
		{http.MethodGet, "/api/rider/v1/nope", ""},
		{http.MethodDelete, "/api/rider/v1/healthz", "GET"},
		{http.MethodPut, "/api/rider/v1/admin/riders/123e4567-e89b-12d3-a456-426614174000", "GET, PATCH"},
		{http.MethodGet, "/api/rider/v1/auth/sign-in", "POST"},
	} {
		req, err := http.NewRequest(c.method, srv.URL+c.path, nil)
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
		var env struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		if err := json.Unmarshal(body, &env); err != nil {
			t.Fatalf("%s %s: body %s is not the error envelope: %v", c.method, c.path, body, err)
		}
		wantStatus, wantCode := http.StatusMethodNotAllowed, "method_not_allowed"
		if c.allow == "" {
			wantStatus, wantCode = http.StatusNotFound, "not_found"
		}
		if resp.StatusCode != wantStatus || env.Error.Code != wantCode {
			t.Fatalf("%s %s: got %d %s, want %d %s", c.method, c.path, resp.StatusCode, body, wantStatus, wantCode)
		}
		if got := resp.Header.Get("Allow"); got != c.allow {
			t.Fatalf("%s %s: Allow %q, want %q", c.method, c.path, got, c.allow)
		}
		if !slices.Contains(codes, env.Error.Code) {
			t.Fatalf("openapi.json Error code enum %v does not list %s", codes, env.Error.Code)
		}
	}
}
