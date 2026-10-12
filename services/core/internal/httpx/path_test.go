package httpx

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// pathIDStatus routes path through a handler that reads {id} with PathID and
// returns the response plus the id it accepted ("" when refused).
func pathIDStatus(t *testing.T, path string) (*httptest.ResponseRecorder, string) {
	t.Helper()
	r := NewRouter(nil)
	var got string
	r.Get("/things/{id}", func(w http.ResponseWriter, req *http.Request) {
		id, err := PathID(req, "id")
		if err != nil {
			WriteError(w, req, err)
			return
		}
		got = id
		w.WriteHeader(http.StatusNoContent)
	})
	return do(t, r, httptest.NewRequest(http.MethodGet, path, nil)), got
}

func TestPathIDRejectsMalformed(t *testing.T) {
	ids := []string{
		"abc",
		"00000000-0000-4000-8000-00000000000",   // 35 characters
		"00000000000040008000000000000301",      // no hyphens
		"00000000-0000-4000-8000-0000000003010", // 37 characters
	}
	for _, id := range ids {
		w, got := pathIDStatus(t, "/things/"+id)
		if w.Code != http.StatusNotFound {
			t.Fatalf("%q: status %d, want 404", id, w.Code)
		}
		var body struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || body.Error.Code != "not_found" {
			t.Fatalf("%q: body %s, want code not_found", id, w.Body.String())
		}
		if got != "" {
			t.Fatalf("%q: handler ran with %q", id, got)
		}
	}
}

func TestPathIDAcceptsCanonical(t *testing.T) {
	for _, id := range []string{
		"00000000-0000-4000-8000-000000000301",
		"0000ABCD-0000-4000-8000-000000000301",
	} {
		w, got := pathIDStatus(t, "/things/"+id)
		if w.Code != http.StatusNoContent || got != id {
			t.Fatalf("%q: status %d got %q, want 204 and the id", id, w.Code, got)
		}
	}
}

func TestIsUUID(t *testing.T) {
	for id, want := range map[string]bool{
		"00000000-0000-4000-8000-000000000301":  true,
		"0000ABCD-0000-4000-8000-000000000301":  true,
		"0000abcd-0000-4000-8000-000000000301":  true,
		"00000000-0000-4000-8000-00000000000":   false,
		"00000000000040008000000000000301":      false,
		"00000000-0000-4000-8000-0000000003010": false,
		"abc":                                   false,
		"":                                      false,
	} {
		if got := IsUUID(id); got != want {
			t.Fatalf("IsUUID(%q) = %v, want %v", id, got, want)
		}
	}
}
