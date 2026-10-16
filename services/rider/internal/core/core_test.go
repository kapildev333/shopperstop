package core_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/coretest"
	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
)

const (
	adminMe     = "GET /api/core/v1/admin/me"
	storeA      = "00000000-0000-4000-8000-000000000401"
	unknownID   = "00000000-0000-4000-8000-0000000000ff"
	adminToken  = "admin-token"
	staffToken  = "store-token"
	serviceTok  = "service-token"
	failMessage = "core call failed"
)

var admin = core.Staff{
	ID: "00000000-0000-4000-8000-000000000001", Email: "admin@shopperstop.local",
	Name: "Admin", Role: "admin", IsActive: true,
}

// syncBuffer is a log sink the router goroutines and the test can share.
type syncBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (s *syncBuffer) Write(p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.Write(p)
}

func (s *syncBuffer) String() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.String()
}

// captureLogs sends the default slog logger to a buffer until the test ends.
func captureLogs(t *testing.T) *syncBuffer {
	t.Helper()
	buf := &syncBuffer{}
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })
	return buf
}

// failureLines returns the "core call failed" log lines in buf.
func failureLines(t *testing.T, buf *syncBuffer) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
		var m map[string]any
		if err := json.Unmarshal([]byte(line), &m); err != nil {
			t.Fatalf("log line is not JSON: %q", line)
		}
		if m["msg"] == failMessage {
			out = append(out, m)
		}
	}
	return out
}

// staffThroughRouter calls StaffFromToken from inside the real rider router,
// so the context carries the request id the router keeps from X-Request-Id.
func staffThroughRouter(t *testing.T, c *core.Client, token, requestID string) error {
	t.Helper()
	got := make(chan error, 1)
	router := httpx.NewRouter(nil)
	router.Get("/probe", func(w http.ResponseWriter, r *http.Request) {
		_, err := c.StaffFromToken(r.Context(), token)
		got <- err
		w.WriteHeader(http.StatusNoContent)
	})
	srv := httptest.NewServer(router)
	t.Cleanup(srv.Close)
	req, err := http.NewRequest(http.MethodGet, srv.URL+"/probe", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("X-Request-Id", requestID)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	return <-got
}

// clock is a fake clock the test moves by hand.
type clock struct{ now time.Time }

func (c *clock) Now() time.Time { return c.now }

func requireHTTPError(t *testing.T, err error, status int, code string) {
	t.Helper()
	var he *httpx.Error
	if !errors.As(err, &he) {
		t.Fatalf("error %v (%T), want *httpx.Error", err, err)
	}
	if he.Status != status || he.Code != code {
		t.Fatalf("got %d %s, want %d %s", he.Status, he.Code, status, code)
	}
}

func TestStaffFromTokenForwardsBearer(t *testing.T) {
	f := coretest.New()
	t.Cleanup(f.Close)
	store := core.Staff{
		ID: "00000000-0000-4000-8000-000000000002", Email: "store@shopperstop.local",
		Name: "Store Staff", Role: "store_staff", StoreID: storeA, IsActive: true,
	}
	f.AddStaff(adminToken, admin)
	f.AddStaff(staffToken, store)
	c := core.New(f.URL(), serviceTok, time.Now)

	for token, want := range map[string]core.Staff{adminToken: admin, staffToken: store} {
		got, err := c.StaffFromToken(context.Background(), token)
		if err != nil {
			t.Fatalf("StaffFromToken(%q): %v", token, err)
		}
		if got != want {
			t.Fatalf("StaffFromToken(%q) = %+v, want %+v", token, got, want)
		}
	}
}

func TestStaffFromTokenUnauthorized(t *testing.T) {
	f := coretest.New()
	t.Cleanup(f.Close)
	f.AddStaff(adminToken, admin)
	c := core.New(f.URL(), serviceTok, time.Now)

	for _, token := range []string{"", "unknown-token"} {
		_, err := c.StaffFromToken(context.Background(), token)
		requireHTTPError(t, err, http.StatusUnauthorized, "unauthorized")
	}
}

func TestStaffFromTokenCoreFailure(t *testing.T) {
	cases := map[string]struct {
		requestID string
		breakCore func(f *coretest.Fake)
	}{
		"core answers 500": {"req-500", func(f *coretest.Fake) { f.Fail(http.StatusInternalServerError) }},
		"core unreachable": {"req-down", func(f *coretest.Fake) { f.Close() }},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			buf := captureLogs(t)
			f := coretest.New()
			t.Cleanup(f.Close)
			f.AddStaff(adminToken, admin)
			tc.breakCore(f)
			c := core.New(f.URL(), serviceTok, time.Now)

			err := staffThroughRouter(t, c, adminToken, tc.requestID)
			requireHTTPError(t, err, http.StatusBadGateway, "internal")

			lines := failureLines(t, buf)
			if len(lines) != 1 {
				t.Fatalf("%d %q log lines, want 1: %s", len(lines), failMessage, buf.String())
			}
			if lines[0]["requestId"] != tc.requestID {
				t.Fatalf("requestId %v, want %q", lines[0]["requestId"], tc.requestID)
			}
		})
	}
}

func TestStaffFromTokenCached(t *testing.T) {
	f := coretest.New()
	t.Cleanup(f.Close)
	f.AddStaff(adminToken, admin)
	f.AddStaff(staffToken, admin)
	base := time.Date(2026, 10, 15, 10, 0, 0, 0, time.UTC)
	clk := &clock{now: base}
	c := core.New(f.URL(), serviceTok, clk.Now)
	ctx := context.Background()

	// Three calls within 30 seconds of the first, then one 31 seconds after it.
	for _, offset := range []time.Duration{0, 10 * time.Second, 20 * time.Second, 31 * time.Second} {
		clk.now = base.Add(offset)
		if _, err := c.StaffFromToken(ctx, adminToken); err != nil {
			t.Fatalf("StaffFromToken at +%s: %v", offset, err)
		}
	}
	if got := f.Calls(adminMe); got != 2 {
		t.Fatalf("core received %d admin/me calls, want 2", got)
	}

	// A different token is not served from another token's answer.
	if _, err := c.StaffFromToken(ctx, staffToken); err != nil {
		t.Fatal(err)
	}
	if got := f.Calls(adminMe); got != 3 {
		t.Fatalf("core received %d admin/me calls after a second token, want 3", got)
	}

	// Refusals are not cached: each unknown token reaches core.
	before := f.Calls(adminMe)
	for range 2 {
		_, err := c.StaffFromToken(ctx, "unknown-token")
		requireHTTPError(t, err, http.StatusUnauthorized, "unauthorized")
	}
	if got := f.Calls(adminMe) - before; got != 2 {
		t.Fatalf("core received %d calls for two refusals, want 2", got)
	}
}

func TestStore(t *testing.T) {
	f := coretest.New()
	t.Cleanup(f.Close)
	want := core.Store{ID: storeA, Name: "Koramangala", IsOpen: true}
	f.AddStore(want)
	c := core.New(f.URL(), serviceTok, time.Now)

	got, err := c.Store(context.Background(), storeA)
	if err != nil {
		t.Fatalf("Store: %v", err)
	}
	if got != want {
		t.Fatalf("Store = %+v, want %+v", got, want)
	}
}

func TestStoreNotFound(t *testing.T) {
	f := coretest.New()
	t.Cleanup(f.Close)
	c := core.New(f.URL(), serviceTok, time.Now)

	_, err := c.Store(context.Background(), unknownID)
	requireHTTPError(t, err, http.StatusNotFound, "not_found")
}
