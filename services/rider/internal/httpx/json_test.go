package httpx

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// readBody runs ReadJSON over body and returns the *Error it produced, or
// fails the test when ReadJSON accepted the body.
func readBody(t *testing.T, body string, dst any) *Error {
	t.Helper()
	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	w := httptest.NewRecorder()
	err := ReadJSON(w, r, dst)
	if err == nil {
		t.Fatalf("ReadJSON accepted %q", body)
	}
	var httpErr *Error
	if !errors.As(err, &httpErr) {
		t.Fatalf("ReadJSON returned %T, want *Error", err)
	}
	return httpErr
}

func TestReadJSONRejectsNUL(t *testing.T) {
	cases := map[string]string{
		"escaped NUL in a string": `{"name":"a\u0000b"}`,
		"raw NUL byte":            "{\"name\":\"a\x00b\"}",
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			var dst struct {
				Name string `json:"name"`
			}
			got := readBody(t, body, &dst)
			if got.Status != http.StatusBadRequest || got.Code != "validation" {
				t.Fatalf("got %d %s, want 400 validation", got.Status, got.Code)
			}
		})
	}
}

func TestReadJSONTooLarge(t *testing.T) {
	// A valid JSON string exactly one byte over the 1 MiB limit, so only the
	// size check can refuse it.
	body := `"` + strings.Repeat("a", 1<<20-1) + `"`
	if len(body) != 1<<20+1 {
		t.Fatalf("test body is %d bytes, want %d", len(body), 1<<20+1)
	}
	var dst string
	got := readBody(t, body, &dst)
	if got.Status != http.StatusBadRequest || got.Code != "validation" || got.Message != "body too large" {
		t.Fatalf("got %d %s %q, want 400 validation \"body too large\"", got.Status, got.Code, got.Message)
	}
}

func TestReadJSONRejectsMalformed(t *testing.T) {
	cases := map[string]string{
		"truncated object": `{"name":`,
		"empty body":       ``,
		"trailing data":    `{"name":"a"} {"name":"b"}`,
		"wrong type":       `{"name":5}`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			var dst struct {
				Name string `json:"name"`
			}
			got := readBody(t, body, &dst)
			if got.Status != http.StatusBadRequest || got.Code != "validation" || got.Message != "invalid JSON" {
				t.Fatalf("got %d %s %q, want 400 validation \"invalid JSON\"", got.Status, got.Code, got.Message)
			}
		})
	}
}

func TestWriteErrorEnvelope(t *testing.T) {
	t.Run("*Error keeps status, code and field", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodPost, "/", nil)
		w := httptest.NewRecorder()
		WriteError(w, r, &Error{Status: http.StatusBadRequest, Code: "validation", Message: "name is required", Field: "name"})
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status %d, want 400", w.Code)
		}
		want := `{"error":{"code":"validation","message":"name is required","field":"name"}}` + "\n"
		if got := w.Body.String(); got != want {
			t.Fatalf("body %q, want %q", got, want)
		}
		if ct := w.Header().Get("Content-Type"); ct != "application/json" {
			t.Fatalf("Content-Type %q, want application/json", ct)
		}
	})
	t.Run("plain error becomes 500 internal", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		WriteError(w, r, errors.New("connection refused: secret host"))
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status %d, want 500", w.Code)
		}
		want := `{"error":{"code":"internal","message":"internal error"}}` + "\n"
		if got := w.Body.String(); got != want {
			t.Fatalf("body %q, want %q", got, want)
		}
	})
}
