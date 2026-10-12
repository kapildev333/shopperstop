package app

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

const addressesPath = "/api/core/v1/me/addresses"

// addressJSON is one address as the API shows it. Line2 is "" when omitted.
type addressJSON struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Line1     string `json:"line1"`
	Line2     string `json:"line2"`
	Pincode   string `json:"pincode"`
	IsDefault bool   `json:"isDefault"`
}

type addressList struct {
	Items    []addressJSON `json:"items"`
	Page     int           `json:"page"`
	PageSize int           `json:"pageSize"`
	Total    int64         `json:"total"`
}

// createAddress posts one address and returns its id, failing unless it is 201.
func createAddress(t *testing.T, token string, body map[string]any) addressJSON {
	t.Helper()
	status, raw := call(t, http.MethodPost, addressesPath, token, body)
	var a addressJSON
	if status != http.StatusCreated || json.Unmarshal(raw, &a) != nil {
		t.Fatalf("create address %v: got %d %s, want 201", body, status, raw)
	}
	return a
}

// listAddresses reads GET /me/addresses with the default query.
func listAddresses(t *testing.T, token string) addressList {
	t.Helper()
	status, raw := call(t, http.MethodGet, addressesPath, token, nil)
	var l addressList
	if status != http.StatusOK || json.Unmarshal(raw, &l) != nil {
		t.Fatalf("list addresses: got %d %s, want 200", status, raw)
	}
	return l
}

// defaults returns the labels of the default addresses in a list.
func defaults(l addressList) []string {
	var labels []string
	for _, a := range l.Items {
		if a.IsDefault {
			labels = append(labels, a.Label)
		}
	}
	return labels
}

func TestAddressCreateAndList(t *testing.T) {
	s := newCustomer(t)
	createAddress(t, s.Token, map[string]any{"label": "Home", "line1": "12 Main Rd", "pincode": "560034", "isDefault": true})
	createAddress(t, s.Token, map[string]any{"label": "Work", "line1": "1 Park St", "pincode": "560038"})
	l := listAddresses(t, s.Token)
	if l.Total != 2 || len(l.Items) != 2 {
		t.Fatalf("list: got total %d and %d items, want 2 and 2", l.Total, len(l.Items))
	}
	if l.Items[0].Label != "Home" || !l.Items[0].IsDefault || l.Items[1].Label != "Work" || l.Items[1].IsDefault {
		t.Fatalf("list order: got %+v, want Home (default) then Work", l.Items)
	}
}

// TestAddressNewDefaultClearsOld: creating or patching with isDefault true
// leaves exactly one default.
func TestAddressNewDefaultClearsOld(t *testing.T) {
	s := newCustomer(t)
	home := createAddress(t, s.Token, map[string]any{"label": "Home", "line1": "12 Main Rd", "pincode": "560034", "isDefault": true})
	createAddress(t, s.Token, map[string]any{"label": "Work", "line1": "1 Park St", "pincode": "560038", "isDefault": true})
	if got := defaults(listAddresses(t, s.Token)); len(got) != 1 || got[0] != "Work" {
		t.Fatalf("after creating Work as default: defaults %v, want [Work]", got)
	}
	status, body := call(t, http.MethodPatch, addressesPath+"/"+home.ID, s.Token, map[string]any{"isDefault": true})
	if status != http.StatusOK {
		t.Fatalf("patch Home default: got %d %s, want 200", status, body)
	}
	if got := defaults(listAddresses(t, s.Token)); len(got) != 1 || got[0] != "Home" {
		t.Fatalf("after patching Home as default: defaults %v, want [Home]", got)
	}
}

func TestAddressBadPincode(t *testing.T) {
	s := newCustomer(t)
	status, body := call(t, http.MethodPost, addressesPath, s.Token,
		map[string]any{"label": "Home", "line1": "12 Main Rd", "pincode": "56003"})
	e := decodeError(t, body)
	if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "pincode" {
		t.Fatalf("create with pincode 56003: got %d %s, want 400 validation field pincode", status, body)
	}
	home := createAddress(t, s.Token, map[string]any{"label": "Home", "line1": "12 Main Rd", "pincode": "560034"})
	status, body = call(t, http.MethodPatch, addressesPath+"/"+home.ID, s.Token, map[string]any{"pincode": "012345"})
	e = decodeError(t, body)
	if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "pincode" {
		t.Fatalf("patch with pincode 012345: got %d %s, want 400 validation field pincode", status, body)
	}
}

func TestAddressEmptyLine2Clears(t *testing.T) {
	s := newCustomer(t)
	home := createAddress(t, s.Token, map[string]any{"label": "Home", "line1": "12 Main Rd", "line2": "Flat 2", "pincode": "560034"})
	if home.Line2 != "Flat 2" {
		t.Fatalf("created line2 %q, want Flat 2", home.Line2)
	}
	status, body := call(t, http.MethodPatch, addressesPath+"/"+home.ID, s.Token, map[string]any{"line2": ""})
	if status != http.StatusOK {
		t.Fatalf("clear line2: got %d %s, want 200", status, body)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body, &fields); err != nil {
		t.Fatal(err)
	}
	if _, ok := fields["line2"]; ok {
		t.Fatalf("response %s has line2 after clearing it, want it omitted", body)
	}
	if _, ok := fields["line1"]; !ok {
		t.Fatalf("response %s lost line1, want it unchanged", body)
	}
}

// TestAddressOtherCustomer404: another customer sees a 404 for both patch and
// delete, and the owner's address is unchanged.
func TestAddressOtherCustomer404(t *testing.T) {
	owner := newCustomer(t)
	other := newCustomer(t)
	home := createAddress(t, owner.Token, map[string]any{"label": "Home", "line1": "12 Main Rd", "pincode": "560034"})
	status, body := call(t, http.MethodPatch, addressesPath+"/"+home.ID, other.Token, map[string]any{"label": "Hijacked"})
	if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
		t.Fatalf("patch of another customer's address: got %d %s, want 404 not_found", status, body)
	}
	status, body = call(t, http.MethodDelete, addressesPath+"/"+home.ID, other.Token, nil)
	if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
		t.Fatalf("delete of another customer's address: got %d %s, want 404 not_found", status, body)
	}
	if l := listAddresses(t, owner.Token); len(l.Items) != 1 || l.Items[0].Label != "Home" {
		t.Fatalf("owner's list after the other customer's requests: %+v, want Home unchanged", l.Items)
	}
}

func TestAddressDeleteDefault(t *testing.T) {
	s := newCustomer(t)
	home := createAddress(t, s.Token, map[string]any{"label": "Home", "line1": "12 Main Rd", "pincode": "560034", "isDefault": true})
	status, body := call(t, http.MethodDelete, addressesPath+"/"+home.ID, s.Token, nil)
	if status != http.StatusNoContent {
		t.Fatalf("delete default: got %d %s, want 204", status, body)
	}
	if l := listAddresses(t, s.Token); l.Total != 0 || len(l.Items) != 0 {
		t.Fatalf("list after delete: %+v, want empty", l)
	}
	if status, body := call(t, http.MethodDelete, addressesPath+"/"+home.ID, s.Token, nil); status != http.StatusNotFound {
		t.Fatalf("second delete: got %d %s, want 404", status, body)
	}
}

func TestAddressMalformedID(t *testing.T) {
	s := newCustomer(t)
	createAddress(t, s.Token, map[string]any{"label": "Home", "line1": "12 Main Rd", "pincode": "560034"})
	for _, method := range []string{http.MethodPatch, http.MethodDelete} {
		status, body := call(t, method, addressesPath+"/abc", s.Token, map[string]any{"label": "Home"})
		if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
			t.Fatalf("%s with id abc: got %d %s, want 404 not_found", method, status, body)
		}
	}
	if l := listAddresses(t, s.Token); l.Total != 1 {
		t.Fatalf("list after malformed-id requests: total %d, want the one address untouched", l.Total)
	}
}

func TestListPaging(t *testing.T) {
	s := newCustomer(t)
	status, body := call(t, http.MethodGet, addressesPath, s.Token, nil)
	if status != http.StatusOK || !strings.Contains(string(body), `"items":[]`) ||
		!strings.Contains(string(body), `"page":1`) || !strings.Contains(string(body), `"pageSize":24`) {
		t.Fatalf("empty list: got %d %s, want 200 with items [], page 1, pageSize 24", status, body)
	}
	status, body = call(t, http.MethodGet, addressesPath+"?pageSize=101", s.Token, nil)
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "pageSize" {
		t.Fatalf("pageSize=101: got %d %s, want 400 validation field pageSize", status, body)
	}
	createAddress(t, s.Token, map[string]any{"label": "Home", "line1": "12 Main Rd", "pincode": "560034", "isDefault": true})
	createAddress(t, s.Token, map[string]any{"label": "Work", "line1": "1 Park St", "pincode": "560038"})
	status, body = call(t, http.MethodGet, addressesPath+"?pageSize=1&page=2", s.Token, nil)
	var l addressList
	if err := json.Unmarshal(body, &l); err != nil {
		t.Fatal(err)
	}
	if status != http.StatusOK || l.Total != 2 || len(l.Items) != 1 || l.Items[0].Label != "Work" || l.Page != 2 {
		t.Fatalf("page 2 of size 1: got %d %s, want the second address Work with total 2", status, body)
	}
}
