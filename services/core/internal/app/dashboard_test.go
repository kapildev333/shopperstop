package app

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

const dashboardPath = "/api/core/v1/admin/dashboard"

// dashboardStoreView is one entry of the dashboard body.
type dashboardStoreView struct {
	StoreID           string           `json:"storeId"`
	StoreName         string           `json:"storeName"`
	OrdersToday       map[string]int64 `json:"ordersToday"`
	LowStockCount     int64            `json:"lowStockCount"`
	RevenueTodayCents int64            `json:"revenueTodayCents"`
}

// dashboardView is the GET /admin/dashboard body.
type dashboardView struct {
	Items []dashboardStoreView `json:"items"`
}

// dashboardEntry reads the dashboard with token (200 expected) and returns the
// entry of storeID, failing when the store is absent.
func dashboardEntry(t *testing.T, token, storeID string) dashboardStoreView {
	t.Helper()
	status, body := call(t, http.MethodGet, dashboardPath, token, nil)
	var d dashboardView
	if status != http.StatusOK || json.Unmarshal(body, &d) != nil {
		t.Fatalf("dashboard: got %d %s, want 200", status, body)
	}
	for _, it := range d.Items {
		if it.StoreID == storeID {
			return it
		}
	}
	t.Fatalf("dashboard has no entry for store %s: %s", storeID, body)
	return dashboardStoreView{}
}

// backdate moves the order's placement and delivery two days into the past.
func backdate(t *testing.T, orderID string) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(),
		"update orders set placed_at = now() - interval '2 days', delivered_at = now() - interval '2 days' where id = $1", orderID); err != nil {
		t.Fatal(err)
	}
}

// TestDashboardToday: the store's orders placed today count by status, and revenue
// is the total of the orders delivered today. An order placed two days ago is not today.
func TestDashboardToday(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	orderIn(t, s.ID, c.Customer.ID, p, "placed")
	delivered := orderIn(t, s.ID, c.Customer.ID, p, "delivered")
	if _, err := testPool.Exec(context.Background(),
		"update orders set delivered_at = now(), subtotal_cents = 12500, total_cents = 12500 where id = $1", delivered); err != nil {
		t.Fatal(err)
	}
	backdate(t, orderIn(t, s.ID, c.Customer.ID, p, "delivered"))

	e := dashboardEntry(t, adminToken(t), s.ID)
	if e.StoreName != "Test store" {
		t.Fatalf("storeName %q, want Test store", e.StoreName)
	}
	if len(e.OrdersToday) != len(statusNames) {
		t.Fatalf("ordersToday has %d keys, want %d: %v", len(e.OrdersToday), len(statusNames), e.OrdersToday)
	}
	for _, name := range statusNames {
		want := int64(0)
		if name == "placed" || name == "delivered" {
			want = 1
		}
		if got, ok := e.OrdersToday[name]; !ok || got != want {
			t.Fatalf("ordersToday[%s] = %d (present %v), want %d", name, got, ok, want)
		}
	}
	if e.RevenueTodayCents != 12500 {
		t.Fatalf("revenueTodayCents %d, want 12500", e.RevenueTodayCents)
	}
}

// TestDashboardTwoDaysAgo: an order delivered two days ago is in no count and earns no revenue today.
func TestDashboardTwoDaysAgo(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	backdate(t, orderIn(t, s.ID, c.Customer.ID, p, "delivered"))

	e := dashboardEntry(t, adminToken(t), s.ID)
	for _, name := range statusNames {
		if e.OrdersToday[name] != 0 {
			t.Fatalf("ordersToday[%s] = %d, want 0", name, e.OrdersToday[name])
		}
	}
	if e.RevenueTodayCents != 0 {
		t.Fatalf("revenueTodayCents %d, want 0", e.RevenueTodayCents)
	}
}

// TestDashboardLowStock: a product stocked below 5 at the store counts once in lowStockCount.
func TestDashboardLowStock(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	stockTo(t, s.ID, p, 10)
	token := adminToken(t)
	before := dashboardEntry(t, token, s.ID).LowStockCount
	stockTo(t, s.ID, p, 2)
	if after := dashboardEntry(t, token, s.ID).LowStockCount; after != before+1 {
		t.Fatalf("lowStockCount %d after stock 2, want %d (one more than %d)", after, before+1, before)
	}
}

// TestDashboardStoreStaffOwnStore: store staff see their own store alone.
func TestDashboardStoreStaffOwnStore(t *testing.T) {
	a := newShop(t)
	status, body := call(t, http.MethodGet, dashboardPath, shopStaffToken(t, a.ID), nil)
	var d dashboardView
	if status != http.StatusOK || json.Unmarshal(body, &d) != nil {
		t.Fatalf("store staff dashboard: got %d %s, want 200", status, body)
	}
	if len(d.Items) != 1 || d.Items[0].StoreID != a.ID {
		t.Fatalf("store staff dashboard: items %+v, want the one store %s", d.Items, a.ID)
	}
}

// TestDashboardAdminAllStores: an admin sees every store, in name then id order.
func TestDashboardAdminAllStores(t *testing.T) {
	newShop(t)
	status, body := call(t, http.MethodGet, dashboardPath, adminToken(t), nil)
	var d dashboardView
	if status != http.StatusOK || json.Unmarshal(body, &d) != nil {
		t.Fatalf("admin dashboard: got %d %s, want 200", status, body)
	}
	rows, err := testPool.Query(context.Background(), "select id::text from stores order by name, id")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var want []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			t.Fatal(err)
		}
		want = append(want, id)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	got := make([]string, len(d.Items))
	for i, it := range d.Items {
		got[i] = it.StoreID
	}
	if len(got) != len(want) {
		t.Fatalf("admin dashboard has %d stores, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("admin dashboard store %d is %s, want %s", i, got[i], want[i])
		}
	}
}

// TestDashboardCustomerToken401: a customer token is not a staff session.
func TestDashboardCustomerToken401(t *testing.T) {
	c := newCustomer(t)
	status, body := call(t, http.MethodGet, dashboardPath, c.Token, nil)
	expectError(t, "customer on the dashboard", status, body, http.StatusUnauthorized, "unauthorized", "", "")
}
