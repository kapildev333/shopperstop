package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPageDefaults(t *testing.T) {
	page, size, err := Page(httptest.NewRequest(http.MethodGet, "/", nil))
	if err != nil || page != 1 || size != 24 {
		t.Fatalf("Page = %d, %d, %v; want 1, 24, nil", page, size, err)
	}

	b, err := json.Marshal(NewList[string](nil, 1, 24, 0))
	if err != nil {
		t.Fatal(err)
	}
	want := `{"items":[],"page":1,"pageSize":24,"total":0}`
	if string(b) != want {
		t.Fatalf("empty list encodes %s, want %s", b, want)
	}
}

func TestPageRejectsOutOfRange(t *testing.T) {
	cases := []struct{ query, field string }{
		{"page=0", "page"},
		{"page=x", "page"},
		{"pageSize=0", "pageSize"},
		{"pageSize=101", "pageSize"},
	}
	for _, c := range cases {
		r := httptest.NewRequest(http.MethodGet, "/?"+c.query, nil)
		_, _, err := Page(r)
		var apiErr *Error
		if !errors.As(err, &apiErr) {
			t.Fatalf("%s: Page returned %v, want *Error", c.query, err)
		}
		if apiErr.Status != http.StatusBadRequest || apiErr.Code != "validation" || apiErr.Field != c.field {
			t.Fatalf("%s: got %d %s field %q, want 400 validation field %s", c.query, apiErr.Status, apiErr.Code, apiErr.Field, c.field)
		}
	}

	_, size, err := Page(httptest.NewRequest(http.MethodGet, "/?pageSize=100", nil))
	if err != nil || size != 100 {
		t.Fatalf("pageSize=100: got %d, %v; want 100, nil", size, err)
	}
}

// TestPageRejectsOffsetTooLarge: (page-1)*pageSize must fit an int32 offset.
func TestPageRejectsOffsetTooLarge(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?page=2147483647&pageSize=100", nil)
	_, _, err := Page(r)
	var apiErr *Error
	if !errors.As(err, &apiErr) {
		t.Fatalf("page=2147483647&pageSize=100: Page returned %v, want *Error", err)
	}
	if apiErr.Status != http.StatusBadRequest || apiErr.Code != "validation" || apiErr.Field != "page" {
		t.Fatalf("page=2147483647&pageSize=100: got %d %s field %q, want 400 validation field page", apiErr.Status, apiErr.Code, apiErr.Field)
	}

	// The largest page whose offset still fits is accepted.
	page, size, err := Page(httptest.NewRequest(http.MethodGet, "/?page=2147483647&pageSize=1", nil))
	if err != nil || page != 2147483647 || size != 1 {
		t.Fatalf("page=2147483647&pageSize=1: got %d, %d, %v; want accepted", page, size, err)
	}
}
