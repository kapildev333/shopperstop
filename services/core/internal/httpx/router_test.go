package httpx

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// captureLogs sends slog.Default to a JSON buffer for the rest of the test.
// Tests that use it must not call t.Parallel: the default logger is global.
func captureLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })
	return &buf
}

// logLines decodes every JSON line written to buf.
func logLines(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var out []map[string]any
	for line := range strings.SplitSeq(strings.TrimSpace(buf.String()), "\n") {
		if line == "" {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal([]byte(line), &m); err != nil {
			t.Fatalf("log line %q is not JSON: %v", line, err)
		}
		out = append(out, m)
	}
	return out
}

// logWithMsg returns the first log line whose msg is msg, or nil.
func logWithMsg(lines []map[string]any, msg string) map[string]any {
	for _, m := range lines {
		if m["msg"] == msg {
			return m
		}
	}
	return nil
}

func do(t *testing.T, h http.Handler, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}

func TestUnknownRouteIsNotFound(t *testing.T) {
	captureLogs(t)
	r := NewRouter(nil)
	w := do(t, r, httptest.NewRequest(http.MethodGet, "/nope", nil))
	if w.Code != http.StatusNotFound {
		t.Fatalf("status %d, want 404", w.Code)
	}
	want := `{"error":{"code":"not_found","message":"not found"}}` + "\n"
	if got := w.Body.String(); got != want {
		t.Fatalf("body %q, want %q", got, want)
	}
}

// TestWrongMethodIs405: a path the router serves, asked with another method,
// answers 405 method_not_allowed with Allow listing the path's methods in a
// fixed order; a CORS preflight on that path still answers 204.
func TestWrongMethodIs405(t *testing.T) {
	captureLogs(t)
	r := NewRouter([]string{"http://b"})
	ok := func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }
	r.Patch("/x/{id}", ok)
	r.Get("/x/{id}", ok)
	r.Get("/y", ok)

	for _, row := range []struct{ method, path, allow string }{
		{http.MethodDelete, "/x/1", "GET, PATCH"},
		{http.MethodPost, "/y", "GET"},
		{http.MethodOptions, "/y", "GET"},
	} {
		w := do(t, r, httptest.NewRequest(row.method, row.path, nil))
		if w.Code != http.StatusMethodNotAllowed {
			t.Fatalf("%s %s: status %d, want 405", row.method, row.path, w.Code)
		}
		if got := w.Header().Get("Allow"); got != row.allow {
			t.Fatalf("%s %s: Allow %q, want %q", row.method, row.path, got, row.allow)
		}
		want := `{"error":{"code":"method_not_allowed","message":"method not allowed"}}` + "\n"
		if got := w.Body.String(); got != want {
			t.Fatalf("%s %s: body %q, want %q", row.method, row.path, got, want)
		}
	}

	req := httptest.NewRequest(http.MethodOptions, "/x/1", nil)
	req.Header.Set("Origin", "http://b")
	req.Header.Set("Access-Control-Request-Method", "PATCH")
	if w := do(t, r, req); w.Code != http.StatusNoContent {
		t.Fatalf("preflight: status %d, want 204", w.Code)
	}
}

func TestPanicIsInternal(t *testing.T) {
	logs := captureLogs(t)
	r := NewRouter(nil)
	r.Get("/boom", func(http.ResponseWriter, *http.Request) { panic("kaboom") })

	req := httptest.NewRequest(http.MethodGet, "/boom", nil)
	req.Header.Set("X-Request-Id", "p1")
	w := do(t, r, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500", w.Code)
	}
	want := `{"error":{"code":"internal","message":"internal error"}}` + "\n"
	if got := w.Body.String(); got != want {
		t.Fatalf("body %q, want %q (the panic text must not leak)", got, want)
	}
	var found bool
	for _, m := range logLines(t, logs) {
		if m["panic"] == "kaboom" && m["requestId"] == "p1" {
			found = true
		}
	}
	if !found {
		t.Fatalf("no log line with panic=kaboom and requestId=p1 in %s", logs.String())
	}
}

func TestLogUsesRoutePattern(t *testing.T) {
	logs := captureLogs(t)
	r := NewRouter(nil)
	r.Get("/api/core/v1/stores/{id}", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	const path = "/api/core/v1/stores/123e4567-e89b-12d3-a456-426614174000"
	do(t, r, httptest.NewRequest(http.MethodGet, path, nil))

	line := logWithMsg(logLines(t, logs), "request")
	if line == nil {
		t.Fatalf("no request log line in %s", logs.String())
	}
	if line["route"] != "/api/core/v1/stores/{id}" {
		t.Fatalf("route %v, want the pattern", line["route"])
	}
	if strings.Contains(logs.String(), "123e4567") {
		t.Fatalf("raw path leaked into the log: %s", logs.String())
	}
}

func TestRequestIDEchoed(t *testing.T) {
	logs := captureLogs(t)
	r := NewRouter(nil)
	r.Get("/ping", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	t.Run("accepted from the client", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/ping", nil)
		req.Header.Set("X-Request-Id", "abc")
		w := do(t, r, req)
		if got := w.Header().Get("X-Request-Id"); got != "abc" {
			t.Fatalf("response X-Request-Id %q, want abc", got)
		}
		line := logWithMsg(logLines(t, logs), "request")
		if line == nil || line["requestId"] != "abc" {
			t.Fatalf("log line %v does not carry requestId abc", line)
		}
	})

	t.Run("generated when absent", func(t *testing.T) {
		w := do(t, r, httptest.NewRequest(http.MethodGet, "/ping", nil))
		got := w.Header().Get("X-Request-Id")
		if len(got) != 32 {
			t.Fatalf("generated X-Request-Id %q, want 32 hex characters", got)
		}
		lines := logLines(t, logs)
		last := lines[len(lines)-1]
		if last["requestId"] != got {
			t.Fatalf("log requestId %v, want %q", last["requestId"], got)
		}
	})
}

func TestAbortHandlerPropagates(t *testing.T) {
	captureLogs(t)
	r := NewRouter(nil)
	r.Get("/abort", func(http.ResponseWriter, *http.Request) { panic(http.ErrAbortHandler) })
	defer func() {
		if v := recover(); v != http.ErrAbortHandler {
			t.Fatalf("recovered %v, want http.ErrAbortHandler re-panicked", v)
		}
	}()
	do(t, r, httptest.NewRequest(http.MethodGet, "/abort", nil))
	t.Fatal("ServeHTTP returned; the abort was answered instead of propagated")
}

func TestCORSAllowsConfiguredOrigin(t *testing.T) {
	captureLogs(t)
	r := NewRouter([]string{"http://a", "http://b"})
	r.Get("/x", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	t.Run("simple request", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("Origin", "http://b")
		w := do(t, r, req)
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://b" {
			t.Fatalf("Access-Control-Allow-Origin %q, want http://b", got)
		}
		if got := w.Header().Get("Vary"); !strings.Contains(got, "Origin") {
			t.Fatalf("Vary %q, want Origin", got)
		}
	})

	t.Run("preflight", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/x", nil)
		req.Header.Set("Origin", "http://b")
		req.Header.Set("Access-Control-Request-Method", "PATCH")
		w := do(t, r, req)
		if w.Code != http.StatusNoContent {
			t.Fatalf("preflight status %d, want 204", w.Code)
		}
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://b" {
			t.Fatalf("Access-Control-Allow-Origin %q, want http://b", got)
		}
		if got := w.Header().Get("Access-Control-Allow-Methods"); got != "GET, POST, PUT, PATCH, DELETE" {
			t.Fatalf("Access-Control-Allow-Methods %q", got)
		}
		if got := w.Header().Get("Access-Control-Allow-Headers"); got != "Authorization, Content-Type" {
			t.Fatalf("Access-Control-Allow-Headers %q", got)
		}
	})

	t.Run("unknown path is 404 with request id and CORS", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/nope", nil)
		req.Header.Set("Origin", "http://b")
		w := do(t, r, req)
		if w.Code != http.StatusNotFound {
			t.Fatalf("status %d, want 404", w.Code)
		}
		if got := w.Header().Get("X-Request-Id"); got == "" {
			t.Fatal("404 response has no X-Request-Id")
		}
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://b" {
			t.Fatalf("Access-Control-Allow-Origin %q, want http://b", got)
		}
	})
}

func TestCORSRejectsUnknownOrigin(t *testing.T) {
	captureLogs(t)
	r := NewRouter([]string{"http://a", ""})
	r.Get("/x", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	t.Run("unknown origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("Origin", "http://evil")
		w := do(t, r, req)
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("Access-Control-Allow-Origin %q, want none", got)
		}
		if got := w.Header().Get("Vary"); !strings.Contains(got, "Origin") {
			t.Fatalf("Vary %q, want Origin on the unknown-origin response", got)
		}
	})

	t.Run("empty origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("Origin", "")
		w := do(t, r, req)
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("Access-Control-Allow-Origin %q, want none", got)
		}
	})
}

func TestLogNamesSubject(t *testing.T) {
	logs := captureLogs(t)
	r := NewRouter(nil)
	r.Get("/who", func(w http.ResponseWriter, req *http.Request) {
		SetSubject(req.Context(), "customer", "c1")
		w.WriteHeader(http.StatusNoContent)
	})
	do(t, r, httptest.NewRequest(http.MethodGet, "/who", nil))

	line := logWithMsg(logLines(t, logs), "request")
	if line == nil {
		t.Fatal("no request log line")
	}
	if line["subjectType"] != "customer" || line["subjectId"] != "c1" {
		t.Fatalf("request line has subjectType %v subjectId %v, want customer c1", line["subjectType"], line["subjectId"])
	}
}

func TestLogOmitsSubjectWhenAnonymous(t *testing.T) {
	logs := captureLogs(t)
	r := NewRouter(nil)
	r.Get("/anon", func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	do(t, r, httptest.NewRequest(http.MethodGet, "/anon", nil))

	line := logWithMsg(logLines(t, logs), "request")
	if line == nil {
		t.Fatal("no request log line")
	}
	for _, key := range []string{"subjectType", "subjectId"} {
		if _, ok := line[key]; ok {
			t.Fatalf("anonymous request line carries %s = %v", key, line[key])
		}
	}
}
