package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/coretest"
	"github.com/kapildev333/shopperstop/services/rider/internal/delivery"
)

const (
	readyPath  = "/api/rider/v1/me/ready-orders"
	claimPath  = "/api/rider/v1/me/deliveries"
	claimRoute = "POST /api/core/v1/admin/orders/{id}/status"
)

var idSeq atomic.Int64

// newID returns a canonical uuid no fixture uses, unique within this test process.
func newID() string {
	return fmt.Sprintf("00000000-0000-4000-8000-%012d", 100000+idSeq.Add(1))
}

// addOrder adds a fake core order of store in status, placed at placed, with two lines.
func addOrder(t *testing.T, store, status string, placed time.Time) core.Order {
	t.Helper()
	id := newID()
	o := core.Order{
		ID: id, Number: "SS-" + strings.ToUpper(id[len(id)-6:]), StoreID: store, Status: status,
		CustomerName: "Demo Customer", CustomerPhone: "+919800000000",
		Address:    core.OrderAddress{Line1: "12 80 Feet Rd, Koramangala", Pincode: "560034"},
		TotalCents: 33900, PaymentMethod: "cod", PlacedAt: placed,
		Items: []core.OrderItem{
			{Name: "Banana Robusta", UnitLabel: "1 kg", Quantity: 2},
			{Name: "Shimla Apple", UnitLabel: "1 kg", Quantity: 1},
		},
	}
	coreFake.AddOrder(o, "")
	return o
}

// readyJSON is one ready order as the list answers it.
type readyJSON struct {
	OrderID      string    `json:"orderId"`
	Number       string    `json:"number"`
	PlacedAt     time.Time `json:"placedAt"`
	ItemCount    int       `json:"itemCount"`
	TotalCents   int64     `json:"totalCents"`
	Pincode      string    `json:"pincode"`
	CustomerName string    `json:"customerName"`
}

// deliveryJSON is the Delivery the claim answers.
type deliveryJSON struct {
	ID            string `json:"id"`
	OrderID       string `json:"orderId"`
	OrderNumber   string `json:"orderNumber"`
	StoreID       string `json:"storeId"`
	Status        string `json:"status"`
	CustomerName  string `json:"customerName"`
	CustomerPhone string `json:"customerPhone"`
	Address       struct {
		Line1   string `json:"line1"`
		Line2   string `json:"line2"`
		Pincode string `json:"pincode"`
	} `json:"address"`
	TotalCents    int64  `json:"totalCents"`
	PaymentMethod string `json:"paymentMethod"`
	ItemCount     int    `json:"itemCount"`
	Items         []struct {
		Name      string `json:"name"`
		UnitLabel string `json:"unitLabel"`
		Quantity  int    `json:"quantity"`
	} `json:"items"`
	DeliveredAt *time.Time `json:"deliveredAt"`
}

// wantLines are the two lines addOrder gives every order.
var wantLines = []core.OrderItem{
	{Name: "Banana Robusta", UnitLabel: "1 kg", Quantity: 2},
	{Name: "Shimla Apple", UnitLabel: "1 kg", Quantity: 1},
}

// riderAt inserts an active rider of store and signs in; it returns the rider's id and token.
func riderAt(t *testing.T, store string) (string, string) {
	t.Helper()
	email := uniqueEmail(t)
	id := seedRiderAt(t, store, email, true)
	return id, signInAs(t, email, testPassword).Token
}

// countDeliveries counts the delivery rows of order orderID.
func countDeliveries(t *testing.T, orderID string) int64 {
	t.Helper()
	var n int64
	if err := testPool.QueryRow(context.Background(), "select count(*) from deliveries where order_id = $1", orderID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// claimCode posts one claim and returns its status, or -1 when the request fails.
// It never calls t, so goroutines may use it.
func claimCode(base, token, orderID string) int {
	b := fmt.Sprintf(`{"orderId":%q}`, orderID)
	req, err := http.NewRequest(http.MethodPost, base+claimPath, strings.NewReader(b))
	if err != nil {
		return -1
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return -1
	}
	defer resp.Body.Close()
	return resp.StatusCode
}

// captureLog sends the default logger to a buffer for the rest of the test and
// returns the parsed lines. Tests using it must not call t.Parallel.
func captureLog(t *testing.T) func() []map[string]any {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })
	return func() []map[string]any {
		var lines []map[string]any
		for _, l := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
			var m map[string]any
			if json.Unmarshal([]byte(l), &m) == nil {
				lines = append(lines, m)
			}
		}
		return lines
	}
}

func TestReadyOrdersOwnStoreOnly(t *testing.T) {
	store, other := newID(), newID()
	_, token := riderAt(t, store)
	t0 := time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC)
	late := addOrder(t, store, "ready", t0.Add(time.Hour))
	early := addOrder(t, store, "ready", t0)
	addOrder(t, other, "ready", t0)
	addOrder(t, store, "packing", t0)

	status, body := callAt(t, srv.URL, http.MethodGet, readyPath, token, nil)
	if status != http.StatusOK {
		t.Fatalf("ready orders: got %d %s, want 200", status, body)
	}
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(body, &keys); err != nil || len(keys) != 1 {
		t.Fatalf("ready orders body %s: want only items", body)
	}
	var list struct {
		Items []readyJSON `json:"items"`
	}
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatal(err)
	}
	if len(list.Items) != 2 || list.Items[0].OrderID != early.ID || list.Items[1].OrderID != late.ID {
		t.Fatalf("ready orders %s: want the store's two ready orders, oldest first", body)
	}
	got := list.Items[0]
	if got.Number != early.Number || got.ItemCount != 3 || got.TotalCents != 33900 ||
		got.Pincode != "560034" || got.CustomerName != "Demo Customer" || !got.PlacedAt.Equal(t0) {
		t.Fatalf("ready order %+v: want number %s, itemCount 3, total 33900, pincode, customer, placed %v", got, early.Number, t0)
	}
}

func TestReadyOrdersDropClaimed(t *testing.T) {
	store := newID()
	riderID, token := riderAt(t, store)
	t0 := time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC)
	claimed := addOrder(t, store, "ready", t0)
	open := addOrder(t, store, "ready", t0.Add(time.Minute))
	// A delivery row for claimed while core still says ready: only the list's filter can hide it.
	if _, err := testPool.Exec(context.Background(),
		`insert into deliveries (order_id, order_number, store_id, rider_id, customer_name, address_line1, address_pincode, total_cents, payment_method, item_count, items)
		 values ($1, 'SS-CLAIMED', $2, $3, 'Demo Customer', '12 80 Feet Rd', '560034', 33900, 'cod', 3, '[]')`,
		claimed.ID, store, riderID); err != nil {
		t.Fatal(err)
	}

	status, body := callAt(t, srv.URL, http.MethodGet, readyPath, token, nil)
	var list struct {
		Items []readyJSON `json:"items"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &list) != nil {
		t.Fatalf("ready orders: got %d %s, want 200", status, body)
	}
	if len(list.Items) != 1 || list.Items[0].OrderID != open.ID {
		t.Fatalf("ready orders %s: want only the unclaimed order %s", body, open.ID)
	}
}

func TestClaim(t *testing.T) {
	store := newID()
	riderID, token := riderAt(t, store)
	o := addOrder(t, store, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC))

	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": o.ID})
	if status != http.StatusCreated {
		t.Fatalf("claim: got %d %s, want 201", status, body)
	}
	var d deliveryJSON
	if err := json.Unmarshal(body, &d); err != nil {
		t.Fatal(err)
	}
	if d.ID == "" || d.Status != "assigned" || d.OrderID != o.ID || d.OrderNumber != o.Number || d.StoreID != store ||
		d.CustomerName != "Demo Customer" || d.CustomerPhone != "+919800000000" ||
		d.Address.Line1 != "12 80 Feet Rd, Koramangala" || d.Address.Pincode != "560034" ||
		d.TotalCents != 33900 || d.PaymentMethod != "cod" || d.ItemCount != 3 || d.DeliveredAt != nil {
		t.Fatalf("claim answer %s: want an assigned delivery of %s", body, o.Number)
	}
	if len(d.Items) != len(wantLines) {
		t.Fatalf("claim items %s: want the order's two lines", body)
	}
	for i, l := range d.Items {
		if l.Name != wantLines[i].Name || l.UnitLabel != wantLines[i].UnitLabel || l.Quantity != wantLines[i].Quantity {
			t.Fatalf("claim line %d %+v, want %+v", i, l, wantLines[i])
		}
	}
	if got := coreFake.OrderStatus(o.ID); got != "out_for_delivery" {
		t.Fatalf("core status %q, want out_for_delivery", got)
	}
	want := []coretest.StatusChange{{Status: "out_for_delivery", Actor: core.Actor{Type: "rider", ID: riderID, Name: "Asha Rao"}}}
	if got := coreFake.StatusChanges(o.ID); !reflect.DeepEqual(got, want) {
		t.Fatalf("core status changes %+v, want %+v", got, want)
	}
	if n := countDeliveries(t, o.ID); n != 1 {
		t.Fatalf("deliveries for the order: %d, want 1", n)
	}
}

func TestClaimLogsClaim(t *testing.T) {
	store := newID()
	riderID, token := riderAt(t, store)
	o := addOrder(t, store, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC))
	lines := captureLog(t)

	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": o.ID})
	var d deliveryJSON
	if status != http.StatusCreated || json.Unmarshal(body, &d) != nil {
		t.Fatalf("claim: got %d %s, want 201", status, body)
	}
	var found []map[string]any
	for _, m := range lines() {
		if m["msg"] == "delivery claimed" {
			found = append(found, m)
		}
	}
	if len(found) != 1 {
		t.Fatalf("delivery claimed lines: %d, want 1", len(found))
	}
	l := found[0]
	if l["level"] != "INFO" || l["deliveryId"] != d.ID || l["orderId"] != o.ID || l["number"] != o.Number ||
		l["riderId"] != riderID || l["requestId"] == nil || l["requestId"] == "" {
		t.Fatalf("delivery claimed line %v: want info with deliveryId, orderId, number, riderId and requestId", l)
	}
}

func TestClaimBadOrderID(t *testing.T) {
	_, token := riderAt(t, newID())
	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": "not-a-uuid"})
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "orderId" {
		t.Fatalf("claim with a bad id: got %d %s, want 400 validation on orderId", status, body)
	}
}

func TestClaimOtherStore(t *testing.T) {
	store, other := newID(), newID()
	_, token := riderAt(t, store)
	o := addOrder(t, other, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC))
	before := coreFake.Calls(claimRoute)

	for _, id := range []string{o.ID, unknownUUID} {
		status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": id})
		if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
			t.Fatalf("claim of %s: got %d %s, want 404 not_found", id, status, body)
		}
	}
	if n := countDeliveries(t, o.ID); n != 0 {
		t.Fatalf("deliveries for another store's order: %d, want 0", n)
	}
	if got := coreFake.Calls(claimRoute) - before; got != 0 {
		t.Fatalf("core received %d status calls, want 0", got)
	}
	if got := coreFake.OrderStatus(o.ID); got != "ready" {
		t.Fatalf("core status %q, want ready", got)
	}
}

func TestConcurrentClaims(t *testing.T) {
	store := newID()
	o := addOrder(t, store, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC))
	const riders = 5
	tokens := make([]string, riders)
	for i := range tokens {
		_, tokens[i] = riderAt(t, store)
	}

	codes := make([]int, riders)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range tokens {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			codes[i] = claimCode(srv.URL, tokens[i], o.ID)
		}()
	}
	close(start)
	wg.Wait()

	var created, conflicts int
	for _, c := range codes {
		switch c {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
			conflicts++
		default:
			t.Fatalf("concurrent claim answered %d, want 201 or 409 (all: %v)", c, codes)
		}
	}
	if created != 1 || conflicts != riders-1 {
		t.Fatalf("answers %v: want one 201 and %d 409", codes, riders-1)
	}
	if n := countDeliveries(t, o.ID); n != 1 {
		t.Fatalf("deliveries for the order: %d, want 1", n)
	}
	if n := len(coreFake.StatusChanges(o.ID)); n != 1 {
		t.Fatalf("core status changes: %d, want 1", n)
	}
}

func TestClaimRolledBackOnCoreConflict(t *testing.T) {
	store := newID()
	_, token := riderAt(t, store)
	o := addOrder(t, store, "packing", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC))

	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": o.ID})
	if e := decodeError(t, body); status != http.StatusConflict || e.Error.Code != "conflict" || e.Error.Message != "order is not ready for pickup" {
		t.Fatalf("claim of a packing order: got %d %s, want 409 conflict not ready for pickup", status, body)
	}
	if n := countDeliveries(t, o.ID); n != 0 {
		t.Fatalf("deliveries after the refusal: %d, want 0", n)
	}
	if got := coreFake.OrderStatus(o.ID); got != "packing" {
		t.Fatalf("core status %q, want packing", got)
	}
}

func TestClaimRolledBackOnCoreFailure(t *testing.T) {
	store := newID()
	_, token := riderAt(t, store)
	o := addOrder(t, store, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC))
	coreFake.FailRoute(claimRoute, http.StatusInternalServerError)
	t.Cleanup(func() { coreFake.FailRoute(claimRoute, 0) })

	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": o.ID})
	if e := decodeError(t, body); status != http.StatusBadGateway || e.Error.Code != "internal" {
		t.Fatalf("claim with core failing: got %d %s, want 502 internal", status, body)
	}
	if n := countDeliveries(t, o.ID); n != 0 {
		t.Fatalf("deliveries after core failed: %d, want 0", n)
	}
	if got := coreFake.OrderStatus(o.ID); got != "ready" {
		t.Fatalf("core status %q, want ready", got)
	}
}

// TestReadyOrdersWrongServiceToken: core refusing the rider's service token is the rider's failure, a 502, never a 401.
func TestReadyOrdersWrongServiceToken(t *testing.T) {
	store := newID()
	_, token := riderAt(t, store)
	wrong := core.New(coreFake.URL(), "wrong-token", time.Now)
	bad := httptest.NewServer(New(testPool, nil, auth.New(testPool, testPepper, nil, nil), delivery.New(testPool, wrong)))
	t.Cleanup(bad.Close)

	status, body := callAt(t, bad.URL, http.MethodGet, readyPath, token, nil)
	if e := decodeError(t, body); status != http.StatusBadGateway || e.Error.Code != "internal" {
		t.Fatalf("ready orders with a wrong service token: got %d %s, want 502 internal", status, body)
	}
}
