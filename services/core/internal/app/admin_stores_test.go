package app

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// Admin store tests use pincodes 5612xx, which no other test uses.
const adminStoresPath = "/api/core/v1/admin/stores"

// adminStore is the admin view of a store as the admin routes answer it.
type adminStore struct {
	ID                     string `json:"id"`
	Name                   string `json:"name"`
	City                   string `json:"city"`
	AddressLine            string `json:"addressLine"`
	Pincode                string `json:"pincode"`
	IsOpen                 bool   `json:"isOpen"`
	DeliveryFeeCents       int64  `json:"deliveryFeeCents"`
	FreeDeliveryAboveCents int64  `json:"freeDeliveryAboveCents"`
	MinOrderCents          int64  `json:"minOrderCents"`
	PromisedMinutes        int32  `json:"promisedMinutes"`
}

// adminToken signs the shared admin in and returns the token.
func adminToken(t *testing.T) string {
	t.Helper()
	seedStaff(t)
	return staffSignIn(t, adminStaffEmail)
}

// newStoreBody is a valid create body with the given name and pincode.
func newStoreBody(name, pincode string) map[string]any {
	return map[string]any{"name": name, "addressLine": "1 Admin Rd", "pincode": pincode, "promisedMinutes": 10}
}

// createStore posts a store through the admin route and returns its admin view.
func createStore(t *testing.T, token string, body map[string]any) adminStore {
	t.Helper()
	status, raw := call(t, http.MethodPost, adminStoresPath, token, body)
	var s adminStore
	if status != http.StatusCreated || json.Unmarshal(raw, &s) != nil {
		t.Fatalf("create store: got %d %s, want 201", status, raw)
	}
	return s
}

// getAdminStore reads one store through the admin route, failing unless it answers 200.
func getAdminStore(t *testing.T, token, id string) adminStore {
	t.Helper()
	status, raw := call(t, http.MethodGet, adminStoresPath+"/"+id, token, nil)
	var s adminStore
	if status != http.StatusOK || json.Unmarshal(raw, &s) != nil {
		t.Fatalf("GET store %s: got %d %s, want 200", id, status, raw)
	}
	return s
}

func TestCreateStore(t *testing.T) {
	token := adminToken(t)
	status, raw := call(t, http.MethodPost, adminStoresPath, token, map[string]any{
		"name": "HSR Layout", "addressLine": "27th Main, HSR Layout", "pincode": "561201",
		"promisedMinutes": 12, "deliveryFeeCents": 2500,
	})
	var s adminStore
	if status != http.StatusCreated || json.Unmarshal(raw, &s) != nil || s.ID == "" {
		t.Fatalf("create: got %d %s, want 201 with an id", status, raw)
	}
	if s.IsOpen || s.DeliveryFeeCents != 2500 || s.MinOrderCents != 0 || s.AddressLine != "27th Main, HSR Layout" || s.Pincode != "561201" {
		t.Fatalf("create body %s: want closed, fee 2500, minimum 0, address and pincode echoed", raw)
	}
	status, raw = call(t, http.MethodGet, "/api/core/v1/serviceability?pincode=561201", "", nil)
	if e := decodeError(t, raw); status != http.StatusNotFound || e.Error.Code != "not_serviceable" {
		t.Fatalf("serviceability of the new store's pincode: got %d %s, want 404 not_serviceable", status, raw)
	}
}

func TestCreateStoreValidation(t *testing.T) {
	token := adminToken(t)
	with := func(k string, v any) map[string]any {
		b := newStoreBody("HSR Layout", "561202")
		b[k] = v
		return b
	}
	missing := newStoreBody("HSR Layout", "561202")
	delete(missing, "promisedMinutes")
	cases := []struct {
		field string
		body  map[string]any
	}{
		{"deliveryFeeCents", with("deliveryFeeCents", -1)},
		{"freeDeliveryAboveCents", with("freeDeliveryAboveCents", 10000001)},
		{"minOrderCents", with("minOrderCents", -1)},
		{"deliveryFeeCents", with("deliveryFeeCents", nil)},
		{"name", with("name", "  ")},
		{"addressLine", with("addressLine", "")},
		{"pincode", with("pincode", "5600")},
		{"promisedMinutes", missing},
		{"promisedMinutes", with("promisedMinutes", 0)},
		{"promisedMinutes", with("promisedMinutes", 241)},
		{"city", with("city", strings.Repeat("x", 101))},
		{"city", with("city", nil)},
	}
	var before int
	if err := testPool.QueryRow(t.Context(), "select count(*) from stores").Scan(&before); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		status, raw := call(t, http.MethodPost, adminStoresPath, token, c.body)
		e := decodeError(t, raw)
		if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != c.field {
			t.Fatalf("create with %s %v: got %d %s, want 400 validation field %s", c.field, c.body, status, raw, c.field)
		}
	}
	var after int
	if err := testPool.QueryRow(t.Context(), "select count(*) from stores").Scan(&after); err != nil {
		t.Fatal(err)
	}
	if after != before {
		t.Fatalf("stores went from %d to %d after refused creates, want no change", before, after)
	}
}

func TestListStoresPaged(t *testing.T) {
	token := adminToken(t)
	createStore(t, token, newStoreBody("Paged A", "561203"))
	createStore(t, token, newStoreBody("Paged B", "561204"))
	status, raw := call(t, http.MethodGet, adminStoresPath+"?pageSize=1", token, nil)
	var list struct {
		Items    []adminStore `json:"items"`
		Page     int          `json:"page"`
		PageSize int          `json:"pageSize"`
		Total    int64        `json:"total"`
	}
	if status != http.StatusOK || json.Unmarshal(raw, &list) != nil {
		t.Fatalf("list: got %d %s, want 200", status, raw)
	}
	var firstID string
	var total int64
	if err := testPool.QueryRow(t.Context(), "select id from stores order by name, id limit 1").Scan(&firstID); err != nil {
		t.Fatal(err)
	}
	if err := testPool.QueryRow(t.Context(), "select count(*) from stores").Scan(&total); err != nil {
		t.Fatal(err)
	}
	if len(list.Items) != 1 || list.Items[0].ID != firstID || list.Page != 1 || list.PageSize != 1 || list.Total != total {
		t.Fatalf("list body %s: want the first store by name, page 1, pageSize 1, total %d", raw, total)
	}
}

func TestAdminGetUnknownStore(t *testing.T) {
	status, raw := call(t, http.MethodGet, adminStoresPath+"/"+zeroID, adminToken(t), nil)
	if e := decodeError(t, raw); status != http.StatusNotFound || e.Error.Code != "not_found" {
		t.Fatalf("unknown store: got %d %s, want 404 not_found", status, raw)
	}
}

func TestPatchStoreClose(t *testing.T) {
	token := adminToken(t)
	id := insertStore(t, true, "561205")
	before := getAdminStore(t, token, id)
	status, raw := call(t, http.MethodPatch, adminStoresPath+"/"+id, token, map[string]any{"isOpen": false})
	var after adminStore
	if status != http.StatusOK || json.Unmarshal(raw, &after) != nil {
		t.Fatalf("close: got %d %s, want 200", status, raw)
	}
	want := before
	want.IsOpen = false
	if after != want {
		t.Fatalf("close body %+v: want only isOpen changed from %+v", after, before)
	}
	status, raw = call(t, http.MethodGet, "/api/core/v1/serviceability?pincode=561205", "", nil)
	var sv struct {
		Store struct {
			IsOpen bool `json:"isOpen"`
		} `json:"store"`
	}
	if status != http.StatusOK || json.Unmarshal(raw, &sv) != nil || sv.Store.IsOpen {
		t.Fatalf("serviceability after close: got %d %s, want 200 with isOpen false", status, raw)
	}
}

func TestPatchStoreBlankName(t *testing.T) {
	token := adminToken(t)
	id := insertStore(t, true, "561206")
	status, raw := call(t, http.MethodPatch, adminStoresPath+"/"+id, token, map[string]any{"name": "  "})
	if e := decodeError(t, raw); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "name" {
		t.Fatalf("blank name: got %d %s, want 400 validation field name", status, raw)
	}
	if got := getAdminStore(t, token, id); got.Name != "Test store" {
		t.Fatalf("name after refused change: got %q, want %q", got.Name, "Test store")
	}
}

func TestPatchStoreNull(t *testing.T) {
	token := adminToken(t)
	id := insertStore(t, true, "561207")
	status, raw := call(t, http.MethodPatch, adminStoresPath+"/"+id, token, map[string]any{"isOpen": nil})
	if e := decodeError(t, raw); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "isOpen" {
		t.Fatalf("null isOpen: got %d %s, want 400 validation field isOpen", status, raw)
	}
}

func TestPatchUnknownStore(t *testing.T) {
	status, raw := call(t, http.MethodPatch, adminStoresPath+"/"+zeroID, adminToken(t), map[string]any{"promisedMinutes": 10})
	if e := decodeError(t, raw); status != http.StatusNotFound || e.Error.Code != "not_found" {
		t.Fatalf("change unknown store: got %d %s, want 404 not_found", status, raw)
	}
}

func TestDeleteUnusedStore(t *testing.T) {
	token := adminToken(t)
	id := insertStore(t, true, "561208")
	if status, raw := call(t, http.MethodDelete, adminStoresPath+"/"+id, token, nil); status != http.StatusNoContent {
		t.Fatalf("delete: got %d %s, want 204", status, raw)
	}
	if status, raw := call(t, http.MethodGet, adminStoresPath+"/"+id, token, nil); status != http.StatusNotFound {
		t.Fatalf("GET after delete: got %d %s, want 404", status, raw)
	}
	status, raw := call(t, http.MethodGet, "/api/core/v1/serviceability?pincode=561208", "", nil)
	if e := decodeError(t, raw); status != http.StatusNotFound || e.Error.Code != "not_serviceable" {
		t.Fatalf("serviceability after delete: got %d %s, want 404 not_serviceable", status, raw)
	}
}

func TestDeleteStoreWithStaff(t *testing.T) {
	token := adminToken(t)
	s := createStore(t, token, newStoreBody("Staffed", "561209"))
	status, raw := call(t, http.MethodPost, staffUsersPath, token, map[string]any{
		"email": uniqueEmail(t), "password": testPassword, "name": "Staffed Staff", "role": "store_staff", "storeId": s.ID,
	})
	if status != http.StatusCreated {
		t.Fatalf("create store staff: got %d %s, want 201", status, raw)
	}
	status, raw = call(t, http.MethodDelete, adminStoresPath+"/"+s.ID, token, nil)
	if e := decodeError(t, raw); status != http.StatusConflict || e.Error.Code != "conflict" {
		t.Fatalf("delete store with staff: got %d %s, want 409 conflict", status, raw)
	}
	if got := getAdminStore(t, token, s.ID); got.ID != s.ID {
		t.Fatalf("store after refused delete: got %+v, want it kept", got)
	}
}

func TestDeleteUnknownStore(t *testing.T) {
	status, raw := call(t, http.MethodDelete, adminStoresPath+"/"+zeroID, adminToken(t), nil)
	if e := decodeError(t, raw); status != http.StatusNotFound || e.Error.Code != "not_found" {
		t.Fatalf("delete unknown store: got %d %s, want 404 not_found", status, raw)
	}
}

func TestStoreStaffOnStores403(t *testing.T) {
	seedStaff(t)
	token := staffSignIn(t, storeStaffEmail)
	status, raw := call(t, http.MethodGet, "/api/core/v1/admin/me", token, nil)
	var me staffView
	if status != http.StatusOK || json.Unmarshal(raw, &me) != nil || me.StoreID == "" {
		t.Fatalf("GET /admin/me: got %d %s, want 200 with a storeId", status, raw)
	}
	other := insertStore(t, true, "561210")
	for _, id := range []string{me.StoreID, other} {
		status, raw := call(t, http.MethodGet, adminStoresPath+"/"+id, token, nil)
		if e := decodeError(t, raw); status != http.StatusForbidden || e.Error.Code != "forbidden" {
			t.Fatalf("store staff GET %s: got %d %s, want 403 forbidden", id, status, raw)
		}
	}
}

func TestCreateStoreCity(t *testing.T) {
	token := adminToken(t)
	with := newStoreBody("City Layout", "561211")
	with["city"] = "  Bengaluru "
	if s := createStore(t, token, with); s.City != "Bengaluru" || getAdminStore(t, token, s.ID).City != "Bengaluru" {
		t.Fatalf("create with city: got %q, want Bengaluru stored trimmed", s.City)
	}
	status, raw := call(t, http.MethodPost, adminStoresPath, token, newStoreBody("No City Layout", "561212"))
	if status != http.StatusCreated || strings.Contains(string(raw), `"city"`) {
		t.Fatalf("create without city: got %d %s, want 201 without a city member", status, raw)
	}
}

func TestPatchStoreCity(t *testing.T) {
	token := adminToken(t)
	id := insertStore(t, true, "561213")
	patch := func(body map[string]any) (int, []byte) {
		return call(t, http.MethodPatch, adminStoresPath+"/"+id, token, body)
	}
	if status, raw := patch(map[string]any{"city": " Bengaluru "}); status != http.StatusOK || getAdminStore(t, token, id).City != "Bengaluru" {
		t.Fatalf("set city: got %d %s, want 200 and city Bengaluru", status, raw)
	}
	if status, raw := patch(map[string]any{"name": "Renamed"}); status != http.StatusOK || getAdminStore(t, token, id).City != "Bengaluru" {
		t.Fatalf("patch without city: got %d %s, want the city unchanged", status, raw)
	}
	status, raw := patch(map[string]any{"city": strings.Repeat("x", 101)})
	if e := decodeError(t, raw); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "city" || getAdminStore(t, token, id).City != "Bengaluru" {
		t.Fatalf("101-character city: got %d %s, want 400 validation field city and the city unchanged", status, raw)
	}
	if status, raw := patch(map[string]any{"city": ""}); status != http.StatusOK || strings.Contains(string(raw), `"city"`) {
		t.Fatalf("clear city: got %d %s, want 200 without a city member", status, raw)
	}
}
