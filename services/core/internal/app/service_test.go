package app

import (
	"net/http"
	"testing"
)

// TestServiceReadsOrdersAndStores: the service reads every store's orders and stores like an admin.
func TestServiceReadsOrdersAndStores(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, s.ID, c.Customer.ID, p, "ready")
	for _, path := range []string{
		adminStoresPath,
		adminStoresPath + "/" + s.ID,
		storeOrdersPath(s.ID) + "?status=ready",
		adminOrderPath(id),
	} {
		if status, raw := call(t, http.MethodGet, path, testServiceToken, nil); status != http.StatusOK {
			t.Fatalf("GET %s with the service token: got %d %s, want 200", path, status, raw)
		}
	}
}

// TestServiceTokenElsewhere: a service token is 403 on every other staff route and
// 401 on customer routes; a wrong token is 401.
func TestServiceTokenElsewhere(t *testing.T) {
	for _, path := range []string{"/api/core/v1/admin/me", "/api/core/v1/admin/staff-users", "/api/core/v1/admin/dashboard", adminStoresPath + "/" + testStoreID + "/stock"} {
		status, raw := call(t, http.MethodGet, path, testServiceToken, nil)
		expectError(t, path, status, raw, http.StatusForbidden, "forbidden", "", "staff only")
	}
	for _, path := range []string{"/api/core/v1/me", ordersPath} {
		status, raw := call(t, http.MethodGet, path, testServiceToken, nil)
		expectError(t, path, status, raw, http.StatusUnauthorized, "unauthorized", "", "")
	}
	status, raw := call(t, http.MethodGet, adminStoresPath, testServiceToken+"x", nil)
	expectError(t, "wrong token", status, raw, http.StatusUnauthorized, "unauthorized", "", "")
}

// TestServiceOnStoreAdministration: the service reads a store but may not change it
// or read its service areas.
func TestServiceOnStoreAdministration(t *testing.T) {
	s := newShop(t)
	path := adminStoresPath + "/" + s.ID
	if status, raw := call(t, http.MethodGet, path, testServiceToken, nil); status != http.StatusOK {
		t.Fatalf("GET %s: got %d %s, want 200", path, status, raw)
	}
	status, raw := call(t, http.MethodPatch, path, testServiceToken, map[string]any{"isOpen": false})
	expectError(t, "PATCH store", status, raw, http.StatusForbidden, "forbidden", "", "staff only")
	status, raw = call(t, http.MethodGet, path+"/service-areas", testServiceToken, nil)
	expectError(t, "GET service areas", status, raw, http.StatusForbidden, "forbidden", "", "staff only")
}
