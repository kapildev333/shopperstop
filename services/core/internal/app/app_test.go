package app

import (
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

	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

// srv is the shared test server every route test in this package uses.
var srv *httptest.Server

func TestMain(m *testing.M) {
	pool, cleanup := testdb.Open("app")
	srv = httptest.NewServer(New(pool, []string{"http://localhost:5173"}))
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
	var held []net.Conn
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			held = append(held, c) // keeps the peer open and silent
		}
	}()
	t.Cleanup(func() {
		ln.Close()
		for _, c := range held {
			c.Close()
		}
	})

	url := "postgres://shopperstop_core:shopperstop_core@" + ln.Addr().String() + "/shopperstop_core_test?sslmode=disable"
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	down := httptest.NewServer(New(pool, nil))
	t.Cleanup(down.Close)

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
