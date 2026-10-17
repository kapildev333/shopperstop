package app

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"testing"
)

// insertStore inserts a store that delivers to the given pincodes and returns
// its id. Stores in this file use pincodes 5611xx, which no other test uses.
func insertStore(t *testing.T, isOpen bool, pincodes ...string) string {
	t.Helper()
	ctx := context.Background()
	var id string
	if err := testPool.QueryRow(ctx,
		`insert into stores (name, address_line, pincode, is_open, delivery_fee_cents, free_delivery_above_cents, min_order_cents, promised_minutes)
		 values ('Test store', '1 Test Rd', '560001', $1, 2500, 19900, 9900, 10) returning id`, isOpen).Scan(&id); err != nil {
		t.Fatal(err)
	}
	for _, p := range pincodes {
		if _, err := testPool.Exec(ctx, "insert into store_service_areas (store_id, pincode) values ($1, $2)", id, p); err != nil {
			t.Fatal(err)
		}
	}
	return id
}

// publicStoreKeys are the only keys of the public Store object.
var publicStoreKeys = []string{"id", "name", "isOpen", "deliveryFeeCents", "freeDeliveryAboveCents", "minOrderCents", "promisedMinutes"}

// keysOf returns the sorted keys of a JSON object.
func keysOf(t *testing.T, body []byte) []string {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(body, &m); err != nil {
		t.Fatalf("body %s is not an object: %v", body, err)
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func TestServiceability(t *testing.T) {
	openID := insertStore(t, true, "561101")
	closedID := insertStore(t, false, "561102")

	status, body := call(t, http.MethodGet, "/api/core/v1/serviceability?pincode=561101", "", nil)
	var open struct {
		Store struct {
			ID     string `json:"id"`
			IsOpen bool   `json:"isOpen"`
		} `json:"store"`
	}
	if err := json.Unmarshal(body, &open); err != nil || status != http.StatusOK {
		t.Fatalf("open store: got %d %s, want 200", status, body)
	}
	if open.Store.ID != openID || !open.Store.IsOpen {
		t.Fatalf("open store: got %s, want store %s with isOpen true", body, openID)
	}

	status, body = call(t, http.MethodGet, "/api/core/v1/serviceability?pincode=561102", "", nil)
	var closed struct {
		Store struct {
			ID     string `json:"id"`
			IsOpen bool   `json:"isOpen"`
		} `json:"store"`
	}
	if err := json.Unmarshal(body, &closed); err != nil || status != http.StatusOK {
		t.Fatalf("closed store: got %d %s, want 200", status, body)
	}
	if closed.Store.ID != closedID || closed.Store.IsOpen {
		t.Fatalf("closed store: got %s, want store %s with isOpen false", body, closedID)
	}
	var wrapper struct {
		Store json.RawMessage `json:"store"`
	}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		t.Fatal(err)
	}
	if got := keysOf(t, wrapper.Store); strings.Join(got, ",") != strings.Join(sortedCopy(publicStoreKeys), ",") {
		t.Fatalf("store keys %v, want exactly the public fields", got)
	}
}

func TestServiceabilityUnserved(t *testing.T) {
	status, body := call(t, http.MethodGet, "/api/core/v1/serviceability?pincode=561199", "", nil)
	if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_serviceable" {
		t.Fatalf("unserved pincode: got %d %s, want 404 not_serviceable", status, body)
	}
}

func TestServiceabilityMalformed(t *testing.T) {
	for _, path := range []string{
		"/api/core/v1/serviceability?pincode=56003",
		"/api/core/v1/serviceability?pincode=0560034",
		"/api/core/v1/serviceability",
	} {
		status, body := call(t, http.MethodGet, path, "", nil)
		e := decodeError(t, body)
		if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "pincode" {
			t.Fatalf("GET %s: got %d %s, want 400 validation field pincode", path, status, body)
		}
	}
}

func TestPublicStoreFields(t *testing.T) {
	id := insertStore(t, true, "561103")
	status, body := call(t, http.MethodGet, "/api/core/v1/stores/"+id, "", nil)
	if status != http.StatusOK {
		t.Fatalf("public store: got %d %s, want 200", status, body)
	}
	if got := keysOf(t, body); strings.Join(got, ",") != strings.Join(sortedCopy(publicStoreKeys), ",") {
		t.Fatalf("public store keys %v, want exactly %v", got, publicStoreKeys)
	}
	var s struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &s); err != nil || s.ID != id {
		t.Fatalf("public store id: got %s, want %s", body, id)
	}
}

func TestPublicStoreUnknown(t *testing.T) {
	for _, id := range []string{zeroID, "abc"} {
		status, body := call(t, http.MethodGet, "/api/core/v1/stores/"+id, "", nil)
		if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
			t.Fatalf("GET /stores/%s: got %d %s, want 404 not_found", id, status, body)
		}
	}
}

// sortedCopy returns a sorted copy of keys, leaving the input alone.
func sortedCopy(keys []string) []string {
	out := append([]string(nil), keys...)
	sort.Strings(out)
	return out
}

func TestPublicStoreCity(t *testing.T) {
	id := insertStore(t, true, "561104")
	if _, err := testPool.Exec(context.Background(), "update stores set city = 'Bengaluru' where id = $1", id); err != nil {
		t.Fatal(err)
	}
	want := strings.Join(sortedCopy(append([]string{"city"}, publicStoreKeys...)), ",")
	for _, path := range []string{"/api/core/v1/stores/" + id, "/api/core/v1/serviceability?pincode=561104"} {
		status, body := call(t, http.MethodGet, path, "", nil)
		var wrapper struct {
			Store json.RawMessage `json:"store"`
		}
		if status != http.StatusOK || json.Unmarshal(body, &wrapper) != nil {
			t.Fatalf("GET %s: got %d %s, want 200", path, status, body)
		}
		if wrapper.Store != nil {
			body = wrapper.Store
		}
		var s struct {
			City string `json:"city"`
		}
		if got := strings.Join(keysOf(t, body), ","); got != want || json.Unmarshal(body, &s) != nil || s.City != "Bengaluru" {
			t.Fatalf("GET %s: got %s, want keys %s and city Bengaluru", path, body, want)
		}
	}
}

func TestPublicStoreLocation(t *testing.T) {
	id := insertStore(t, true, "561105")
	if _, err := testPool.Exec(context.Background(), "update stores set lat = 12.9352, lng = 77.6245 where id = $1", id); err != nil {
		t.Fatal(err)
	}
	want := strings.Join(sortedCopy(append([]string{"location"}, publicStoreKeys...)), ",")
	for _, path := range []string{"/api/core/v1/stores/" + id, "/api/core/v1/serviceability?pincode=561105"} {
		status, body := call(t, http.MethodGet, path, "", nil)
		var wrapper struct {
			Store json.RawMessage `json:"store"`
		}
		if status != http.StatusOK || json.Unmarshal(body, &wrapper) != nil {
			t.Fatalf("GET %s: got %d %s, want 200", path, status, body)
		}
		if wrapper.Store != nil {
			body = wrapper.Store
		}
		var s struct {
			Location map[string]float64 `json:"location"`
		}
		if got := strings.Join(keysOf(t, body), ","); got != want || json.Unmarshal(body, &s) != nil || len(s.Location) != 2 || s.Location["lat"] != 12.9352 || s.Location["lng"] != 77.6245 {
			t.Fatalf("GET %s: got %s, want keys %s and location {lat 12.9352, lng 77.6245}", path, body, want)
		}
	}
}
