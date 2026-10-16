package httpx

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// readPatch runs ReadPatch over body and returns its error.
func readPatch(body string, dst any) error {
	r := httptest.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
	return ReadPatch(httptest.NewRecorder(), r, dst)
}

func TestReadPatchRejectsNull(t *testing.T) {
	var dst struct {
		Phone *string `json:"phone"`
	}
	err := readPatch(`{"phone":null}`, &dst)
	var apiErr *Error
	if !errors.As(err, &apiErr) {
		t.Fatalf("ReadPatch returned %v, want *Error", err)
	}
	if apiErr.Status != http.StatusBadRequest || apiErr.Code != "validation" || apiErr.Field != "phone" {
		t.Fatalf("got %d %s field %q, want 400 validation field phone", apiErr.Status, apiErr.Code, apiErr.Field)
	}

	var ok struct {
		Name *string `json:"name"`
	}
	if err := readPatch(`{"name":"a"}`, &ok); err != nil {
		t.Fatalf("ReadPatch refused a present member: %v", err)
	}
	if ok.Name == nil || *ok.Name != "a" {
		t.Fatalf("Name = %v, want \"a\"", ok.Name)
	}
}

func TestReadPatchRequiresObject(t *testing.T) {
	for _, body := range []string{`[]`, `"x"`, `null`} {
		var dst struct {
			Name *string `json:"name"`
		}
		err := readPatch(body, &dst)
		var apiErr *Error
		if !errors.As(err, &apiErr) {
			t.Fatalf("%s: ReadPatch returned %v, want *Error", body, err)
		}
		if apiErr.Status != http.StatusBadRequest || apiErr.Code != "validation" || apiErr.Message != "invalid JSON" {
			t.Fatalf("%s: got %d %s %q, want 400 validation invalid JSON", body, apiErr.Status, apiErr.Code, apiErr.Message)
		}
	}
}
