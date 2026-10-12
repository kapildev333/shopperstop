package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"testing"
)

// Service-area tests use pincodes 5613xx, which no other test uses. The
// too-many test sends 561400 as well: that list is refused before any write.

// serviceAreas is the body the service-areas routes answer.
type serviceAreas struct {
	Pincodes []string `json:"pincodes"`
}

// conflictEnvelope is the 409 of a pincode another store serves.
type conflictEnvelope struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Field   string `json:"field"`
		Pincode string `json:"pincode"`
		StoreID string `json:"storeId"`
	} `json:"error"`
}

func serviceAreasPath(id string) string {
	return adminStoresPath + "/" + id + "/service-areas"
}

// putServiceAreas sends the PUT with the given pincodes and returns the answer.
func putServiceAreas(t *testing.T, token, id string, pincodes any) (int, []byte) {
	t.Helper()
	return call(t, http.MethodPut, serviceAreasPath(id), token, map[string]any{"pincodes": pincodes})
}

// getServiceAreas reads the list through the admin route, failing unless it answers 200.
func getServiceAreas(t *testing.T, token, id string) serviceAreas {
	t.Helper()
	status, raw := call(t, http.MethodGet, serviceAreasPath(id), token, nil)
	var list serviceAreas
	if status != http.StatusOK || json.Unmarshal(raw, &list) != nil {
		t.Fatalf("GET service areas of %s: got %d %s, want 200", id, status, raw)
	}
	return list
}

// setServiceAreas puts the list and fails unless it answers 200.
func setServiceAreas(t *testing.T, token, id string, pincodes ...string) {
	t.Helper()
	if status, raw := putServiceAreas(t, token, id, pincodes); status != http.StatusOK {
		t.Fatalf("PUT %v for %s: got %d %s, want 200", pincodes, id, status, raw)
	}
}

// servedBy answers the status of serviceability for pincode and the id of the store it names.
func servedBy(t *testing.T, pincode string) (int, string) {
	t.Helper()
	status, raw := call(t, http.MethodGet, "/api/core/v1/serviceability?pincode="+pincode, "", nil)
	var sv struct {
		Store struct {
			ID string `json:"id"`
		} `json:"store"`
	}
	if status == http.StatusOK && json.Unmarshal(raw, &sv) != nil {
		t.Fatalf("serviceability of %s: %s is not a store", pincode, raw)
	}
	return status, sv.Store.ID
}

func TestServiceAreasReplace(t *testing.T) {
	token := adminToken(t)
	s := createStore(t, token, newStoreBody("Replace", "561320"))
	setServiceAreas(t, token, s.ID, "561330", "561332")

	status, raw := putServiceAreas(t, token, s.ID, []string{"561332", "561331", "561331"})
	var list serviceAreas
	if status != http.StatusOK || json.Unmarshal(raw, &list) != nil || !slices.Equal(list.Pincodes, []string{"561331", "561332"}) {
		t.Fatalf("replace: got %d %s, want 200 with the sorted, deduplicated list 561331, 561332", status, raw)
	}
	if got := getServiceAreas(t, token, s.ID); !slices.Equal(got.Pincodes, []string{"561331", "561332"}) {
		t.Fatalf("GET after replace: got %v, want 561331, 561332", got.Pincodes)
	}
	if status, _ := servedBy(t, "561330"); status != http.StatusNotFound {
		t.Fatalf("dropped pincode 561330: got %d, want 404 not_serviceable", status)
	}
	if status, id := servedBy(t, "561331"); status != http.StatusOK || id != s.ID {
		t.Fatalf("new pincode 561331: got %d store %s, want 200 store %s", status, id, s.ID)
	}
}

func TestServiceAreasEmpty(t *testing.T) {
	token := adminToken(t)
	s := createStore(t, token, newStoreBody("Empty", "561333"))
	fresh := createStore(t, token, newStoreBody("Fresh", "561334"))
	if status, raw := call(t, http.MethodGet, serviceAreasPath(fresh.ID), token, nil); status != http.StatusOK || strings.TrimSpace(string(raw)) != `{"pincodes":[]}` {
		t.Fatalf("GET of a store with no pincodes: got %d %s, want 200 {\"pincodes\":[]}", status, raw)
	}
	setServiceAreas(t, token, s.ID, "561335")

	status, raw := putServiceAreas(t, token, s.ID, []string{})
	if status != http.StatusOK || strings.TrimSpace(string(raw)) != `{"pincodes":[]}` {
		t.Fatalf("empty replace: got %d %s, want 200 {\"pincodes\":[]}", status, raw)
	}
	if got := getServiceAreas(t, token, s.ID); got.Pincodes == nil || len(got.Pincodes) != 0 {
		t.Fatalf("GET after empty replace: got %v, want an empty list", got.Pincodes)
	}
	if status, _ := servedBy(t, "561335"); status != http.StatusNotFound {
		t.Fatalf("former pincode 561335: got %d, want 404 not_serviceable", status)
	}
}

func TestServiceAreasUnknownStore(t *testing.T) {
	token := adminToken(t)
	if status, raw := call(t, http.MethodGet, serviceAreasPath(zeroID), token, nil); decodeError(t, raw).Error.Code != "not_found" || status != http.StatusNotFound {
		t.Fatalf("GET unknown store: got %d %s, want 404 not_found", status, raw)
	}
	if status, raw := putServiceAreas(t, token, zeroID, []string{"561336"}); decodeError(t, raw).Error.Code != "not_found" || status != http.StatusNotFound {
		t.Fatalf("PUT unknown store: got %d %s, want 404 not_found", status, raw)
	}
}

func TestServiceAreasBadPincode(t *testing.T) {
	token := adminToken(t)
	s := createStore(t, token, newStoreBody("Bad pincode", "561337"))
	setServiceAreas(t, token, s.ID, "561338")
	status, raw := putServiceAreas(t, token, s.ID, []string{"561339", "5600"})
	if e := decodeError(t, raw); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "pincodes" {
		t.Fatalf("bad pincode: got %d %s, want 400 validation field pincodes", status, raw)
	}
	if got := getServiceAreas(t, token, s.ID); !slices.Equal(got.Pincodes, []string{"561338"}) {
		t.Fatalf("list after refused replace: got %v, want 561338 only", got.Pincodes)
	}
}

func TestServiceAreasTooMany(t *testing.T) {
	token := adminToken(t)
	s := createStore(t, token, newStoreBody("Too many", "561340"))
	list := make([]string, 0, 101)
	for i := range 101 {
		list = append(list, fmt.Sprintf("%06d", 561300+i))
	}
	status, raw := putServiceAreas(t, token, s.ID, list)
	if e := decodeError(t, raw); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "pincodes" {
		t.Fatalf("101 pincodes: got %d %s, want 400 validation field pincodes", status, raw)
	}
	if got := getServiceAreas(t, token, s.ID); len(got.Pincodes) != 0 {
		t.Fatalf("list after refused replace: got %v, want none", got.Pincodes)
	}
}

func TestServiceAreasMissingList(t *testing.T) {
	token := adminToken(t)
	s := createStore(t, token, newStoreBody("Missing list", "561341"))
	bodies := []any{map[string]any{}, map[string]any{"pincodes": nil}}
	for _, body := range bodies {
		status, raw := call(t, http.MethodPut, serviceAreasPath(s.ID), token, body)
		if e := decodeError(t, raw); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "pincodes" {
			t.Fatalf("PUT %v: got %d %s, want 400 validation field pincodes", body, status, raw)
		}
	}
}

func TestServiceAreasHeldByOtherStore(t *testing.T) {
	token := adminToken(t)
	b := createStore(t, token, newStoreBody("Holder", "561342"))
	setServiceAreas(t, token, b.ID, "561344")
	a := createStore(t, token, newStoreBody("Claimant", "561343"))
	setServiceAreas(t, token, a.ID, "561345")

	status, raw := putServiceAreas(t, token, a.ID, []string{"561346", "561344"})
	var e conflictEnvelope
	if err := json.Unmarshal(raw, &e); err != nil {
		t.Fatal(err)
	}
	if status != http.StatusConflict || e.Error.Code != "conflict" || e.Error.Field != "pincodes" || e.Error.Pincode != "561344" || e.Error.StoreID != b.ID {
		t.Fatalf("held pincode: got %d %s, want 409 conflict field pincodes pincode 561344 storeId %s", status, raw, b.ID)
	}
	if got := getServiceAreas(t, token, a.ID); !slices.Equal(got.Pincodes, []string{"561345"}) {
		t.Fatalf("claimant's list after refused replace: got %v, want 561345 only", got.Pincodes)
	}
	if status, id := servedBy(t, "561344"); status != http.StatusOK || id != b.ID {
		t.Fatalf("held pincode 561344 after refusal: got %d store %s, want store %s", status, id, b.ID)
	}
}
