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
	"sort"
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
	return addOrderFor(t, store, status, placed, "")
}

// addOrderFor is addOrder with customerToken as the bearer that reads the order as its customer.
func addOrderFor(t *testing.T, store, status string, placed time.Time, customerToken string) core.Order {
	t.Helper()
	o := newOrder(store, status, placed)
	coreFake.AddOrder(o, customerToken)
	return o
}

// addOnlineOrder is addOrder for an order paid online, whose payment core holds as paymentStatus.
func addOnlineOrder(t *testing.T, store, status string, placed time.Time, paymentStatus string) core.Order {
	t.Helper()
	o := newOrder(store, status, placed)
	o.PaymentMethod, o.PaymentStatus = "online", paymentStatus
	coreFake.AddOrder(o, "")
	return o
}

// newOrder is a cash order of store in status, placed at placed, with two lines.
func newOrder(store, status string, placed time.Time) core.Order {
	id := newID()
	return core.Order{
		ID: id, Number: "SS-" + strings.ToUpper(id[len(id)-6:]), StoreID: store, Status: status,
		CustomerName: "Demo Customer", CustomerPhone: "+919800000000",
		Address:    core.OrderAddress{Line1: "12 80 Feet Rd, Koramangala", Pincode: "560034"},
		TotalCents: 33900, PaymentMethod: "cod", PlacedAt: placed,
		Items: []core.OrderItem{
			{Name: "Banana Robusta", UnitLabel: "1 kg", Quantity: 2},
			{Name: "Shimla Apple", UnitLabel: "1 kg", Quantity: 1},
		},
	}
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

func TestReadyOrdersPassPaymentThrough(t *testing.T) {
	store := newID()
	_, token := riderAt(t, store)
	t0 := time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC)
	cash := addOrder(t, store, "ready", t0)
	online := addOnlineOrder(t, store, "ready", t0.Add(time.Minute), "paid")

	status, body := callAt(t, srv.URL, http.MethodGet, readyPath, token, nil)
	var list struct {
		Items []map[string]any `json:"items"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &list) != nil || len(list.Items) != 2 {
		t.Fatalf("ready orders: got %d %s, want 200 with two orders", status, body)
	}
	got, paid := list.Items[0], list.Items[1]
	if got["orderId"] != cash.ID || got["paymentMethod"] != "cod" {
		t.Fatalf("cash order %v: want %s with paymentMethod cod", got, cash.ID)
	}
	if _, ok := got["paymentStatus"]; ok {
		t.Fatalf("cash order %v: want no paymentStatus member", got)
	}
	if paid["orderId"] != online.ID || paid["paymentMethod"] != "online" || paid["paymentStatus"] != "paid" {
		t.Fatalf("online order %v: want %s with paymentMethod online and paymentStatus paid", paid, online.ID)
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

func TestClaimKeepsPayment(t *testing.T) {
	store := newID()
	_, token := riderAt(t, store)
	t0 := time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC)
	online := addOnlineOrder(t, store, "ready", t0, "paid")
	cash := addOrder(t, store, "ready", t0)

	// The claim's answer and a later read both carry the payment core held at the claim.
	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": online.ID})
	var claimed map[string]any
	if status != http.StatusCreated || json.Unmarshal(body, &claimed) != nil {
		t.Fatalf("claim: got %d %s, want 201", status, body)
	}
	status, body = callAt(t, srv.URL, http.MethodGet, claimPath+"/"+claimed["id"].(string), token, nil)
	var read map[string]any
	if status != http.StatusOK || json.Unmarshal(body, &read) != nil {
		t.Fatalf("read: got %d %s, want 200", status, body)
	}
	for name, d := range map[string]map[string]any{"claim": claimed, "read": read} {
		if d["paymentMethod"] != "online" || d["paymentStatus"] != "paid" {
			t.Fatalf("%s %v: want paymentMethod online and paymentStatus paid", name, d)
		}
	}

	status, body = callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": cash.ID})
	var cod map[string]any
	if status != http.StatusCreated || json.Unmarshal(body, &cod) != nil {
		t.Fatalf("cash claim: got %d %s, want 201", status, body)
	}
	if _, ok := cod["paymentStatus"]; ok || cod["paymentMethod"] != "cod" {
		t.Fatalf("cash claim %v: want paymentMethod cod and no paymentStatus member", cod)
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

const listPath = "/api/rider/v1/me/deliveries"

func deliveryPath(id string) string { return listPath + "/" + id }

// deliveredPath is the delivered route of one delivery id.
func deliveredPath(id string) string { return listPath + "/" + id + "/delivered" }

// deliveryListBody is the paged answer of GET /me/deliveries.
type deliveryListBody struct {
	Items    []deliveryJSON `json:"items"`
	Page     int            `json:"page"`
	PageSize int            `json:"pageSize"`
	Total    int64          `json:"total"`
}

// insertDelivery inserts a delivery of riderID at store straight into the table,
// in status with assignedAt (and deliveredAt when delivered), and returns its id.
// The list tests need rows of several statuses without going through core.
func insertDelivery(t *testing.T, riderID, store, status string, assignedAt time.Time, deliveredAt *time.Time) string {
	t.Helper()
	var id string
	err := testPool.QueryRow(context.Background(),
		`insert into deliveries (order_id, order_number, store_id, rider_id, customer_name, address_line1, address_pincode,
			total_cents, payment_method, item_count, items, status, assigned_at, delivered_at)
		 values ($1, 'SS-LIST', $2, $3, 'Demo Customer', '12 80 Feet Rd', '560034', 33900, 'cod', 3, '[]', $4::delivery_status, $5, $6)
		 returning id`,
		newID(), store, riderID, status, assignedAt, deliveredAt).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func TestListDefaultsToAssigned(t *testing.T) {
	store := newID()
	riderID, token := riderAt(t, store)
	t0 := time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC)
	assigned := insertDelivery(t, riderID, store, "assigned", t0, nil)
	done := t0.Add(time.Hour)
	insertDelivery(t, riderID, store, "delivered", t0.Add(-time.Hour), &done)

	status, body := callAt(t, srv.URL, http.MethodGet, listPath, token, nil)
	if status != http.StatusOK {
		t.Fatalf("list: got %d %s, want 200", status, body)
	}
	var list deliveryListBody
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatal(err)
	}
	if list.Total != 1 || list.Page != 1 || list.PageSize != 24 || len(list.Items) != 1 {
		t.Fatalf("list %s: want one assigned delivery on page 1 of 24", body)
	}
	if got := list.Items[0]; got.ID != assigned || got.Status != "assigned" || got.DeliveredAt != nil {
		t.Fatalf("list item %+v: want the assigned delivery %s", got, assigned)
	}
}

func TestListDelivered(t *testing.T) {
	store := newID()
	riderID, token := riderAt(t, store)
	t0 := time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC)
	older, newer := t0, t0.Add(time.Hour)
	olderDone, newerDone := older.Add(time.Minute), newer.Add(time.Minute)
	first := insertDelivery(t, riderID, store, "delivered", older, &olderDone)
	second := insertDelivery(t, riderID, store, "delivered", newer, &newerDone)
	insertDelivery(t, riderID, store, "assigned", t0.Add(2*time.Hour), nil)

	status, body := callAt(t, srv.URL, http.MethodGet, listPath+"?status=delivered", token, nil)
	if status != http.StatusOK {
		t.Fatalf("list delivered: got %d %s, want 200", status, body)
	}
	var list deliveryListBody
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatal(err)
	}
	if list.Total != 2 || len(list.Items) != 2 {
		t.Fatalf("list delivered %s: want the two delivered deliveries", body)
	}
	if list.Items[0].ID != second || list.Items[1].ID != first {
		t.Fatalf("list delivered %s: want newest claim first (%s, %s)", body, second, first)
	}
	for _, d := range list.Items {
		if d.Status != "delivered" || d.DeliveredAt == nil {
			t.Fatalf("list item %+v: want status delivered with deliveredAt", d)
		}
	}
}

func TestListBadStatus(t *testing.T) {
	_, token := riderAt(t, newID())
	status, body := callAt(t, srv.URL, http.MethodGet, listPath+"?status=packing", token, nil)
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "status" {
		t.Fatalf("list with status=packing: got %d %s, want 400 validation on status", status, body)
	}
}

func TestGetOtherRidersDelivery(t *testing.T) {
	store := newID()
	riderID, token := riderAt(t, store)
	_, otherToken := riderAt(t, store)
	id := insertDelivery(t, riderID, store, "assigned", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC), nil)

	status, body := callAt(t, srv.URL, http.MethodGet, deliveryPath(id), token, nil)
	if status != http.StatusOK {
		t.Fatalf("own delivery: got %d %s, want 200", status, body)
	}
	for _, path := range []string{deliveryPath(id), deliveryPath(unknownUUID), deliveryPath("not-a-uuid")} {
		status, body := callAt(t, srv.URL, http.MethodGet, path, otherToken, nil)
		if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
			t.Fatalf("GET %s by another rider: got %d %s, want 404 not_found", path, status, body)
		}
	}
}

func TestDeliveredOtherRidersDelivery(t *testing.T) {
	store := newID()
	_, token := riderAt(t, store)
	_, otherToken := riderAt(t, store)
	o := addOrder(t, store, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC))
	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": o.ID})
	var claimed deliveryJSON
	if status != http.StatusCreated || json.Unmarshal(body, &claimed) != nil {
		t.Fatalf("claim: got %d %s, want 201", status, body)
	}
	changes := len(coreFake.StatusChanges(o.ID))

	status, body = callAt(t, srv.URL, http.MethodPost, deliveredPath(claimed.ID), otherToken, nil)
	if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
		t.Fatalf("delivered by another rider: got %d %s, want 404 not_found", status, body)
	}
	status, body = callAt(t, srv.URL, http.MethodGet, deliveryPath(claimed.ID), token, nil)
	var kept deliveryJSON
	if status != http.StatusOK || json.Unmarshal(body, &kept) != nil || kept.Status != "assigned" || kept.DeliveredAt != nil {
		t.Fatalf("owner's delivery after another rider's attempt: got %d %s, want still assigned", status, body)
	}
	if got := len(coreFake.StatusChanges(o.ID)); got != changes {
		t.Fatalf("core status changes %d, want %d: another rider's attempt must not move the order", got, changes)
	}
	if got := coreFake.OrderStatus(o.ID); got != "out_for_delivery" {
		t.Fatalf("core status %q, want out_for_delivery", got)
	}
}

func TestDeliveredOnce(t *testing.T) {
	store := newID()
	riderID, token := riderAt(t, store)
	o := addOrder(t, store, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC))
	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": o.ID})
	var claimed deliveryJSON
	if status != http.StatusCreated || json.Unmarshal(body, &claimed) != nil {
		t.Fatalf("claim: got %d %s, want 201", status, body)
	}

	status, body = callAt(t, srv.URL, http.MethodPost, deliveredPath(claimed.ID), token, nil)
	var done deliveryJSON
	if status != http.StatusOK || json.Unmarshal(body, &done) != nil {
		t.Fatalf("delivered: got %d %s, want 200", status, body)
	}
	if done.Status != "delivered" || done.DeliveredAt == nil || done.ID != claimed.ID {
		t.Fatalf("delivered answer %s: want status delivered with deliveredAt", body)
	}
	if got := coreFake.OrderStatus(o.ID); got != "delivered" {
		t.Fatalf("core status %q, want delivered", got)
	}
	want := core.Actor{Type: "rider", ID: riderID, Name: "Asha Rao"}
	changes := coreFake.StatusChanges(o.ID)
	if len(changes) != 2 || changes[1].Status != "delivered" || changes[1].Actor != want {
		t.Fatalf("core status changes %+v: want delivered with actor %+v last", changes, want)
	}

	status, body = callAt(t, srv.URL, http.MethodPost, deliveredPath(claimed.ID), token, nil)
	if e := decodeError(t, body); status != http.StatusConflict || e.Error.Code != "conflict" || e.Error.Message != "delivery is not assigned" {
		t.Fatalf("second delivered: got %d %s, want 409 conflict delivery is not assigned", status, body)
	}
}

func TestDeliveredStaysAssignedWhenCoreFails(t *testing.T) {
	store := newID()
	_, token := riderAt(t, store)
	o := addOrder(t, store, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC))
	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": o.ID})
	var claimed deliveryJSON
	if status != http.StatusCreated || json.Unmarshal(body, &claimed) != nil {
		t.Fatalf("claim: got %d %s, want 201", status, body)
	}

	coreFake.FailRoute(claimRoute, http.StatusInternalServerError)
	t.Cleanup(func() { coreFake.FailRoute(claimRoute, 0) })
	status, body = callAt(t, srv.URL, http.MethodPost, deliveredPath(claimed.ID), token, nil)
	if e := decodeError(t, body); status != http.StatusBadGateway || e.Error.Code != "internal" {
		t.Fatalf("delivered with core failing: got %d %s, want 502 internal", status, body)
	}
	status, body = callAt(t, srv.URL, http.MethodGet, deliveryPath(claimed.ID), token, nil)
	var kept deliveryJSON
	if status != http.StatusOK || json.Unmarshal(body, &kept) != nil || kept.Status != "assigned" || kept.DeliveredAt != nil {
		t.Fatalf("delivery after core failed: got %d %s, want still assigned", status, body)
	}
	if got := coreFake.OrderStatus(o.ID); got != "out_for_delivery" {
		t.Fatalf("core status %q, want out_for_delivery", got)
	}

	coreFake.FailRoute(claimRoute, 0)
	status, body = callAt(t, srv.URL, http.MethodPost, deliveredPath(claimed.ID), token, nil)
	if status != http.StatusOK {
		t.Fatalf("retry after core recovers: got %d %s, want 200", status, body)
	}
}

func TestClaimAndDeliveredLogged(t *testing.T) {
	store := newID()
	riderID, token := riderAt(t, store)
	o := addOrder(t, store, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC))
	lines := captureLog(t)

	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": o.ID})
	var claimed deliveryJSON
	if status != http.StatusCreated || json.Unmarshal(body, &claimed) != nil {
		t.Fatalf("claim: got %d %s, want 201", status, body)
	}
	if status, body = callAt(t, srv.URL, http.MethodPost, deliveredPath(claimed.ID), token, nil); status != http.StatusOK {
		t.Fatalf("delivered: got %d %s, want 200", status, body)
	}

	byMsg := map[string][]map[string]any{}
	for _, m := range lines() {
		if msg, ok := m["msg"].(string); ok {
			byMsg[msg] = append(byMsg[msg], m)
		}
	}
	for _, msg := range []string{"delivery claimed", "delivery delivered"} {
		if len(byMsg[msg]) != 1 {
			t.Fatalf("%q lines: %d, want 1", msg, len(byMsg[msg]))
		}
		l := byMsg[msg][0]
		if l["level"] != "INFO" || l["deliveryId"] != claimed.ID || l["orderId"] != o.ID || l["number"] != o.Number ||
			l["riderId"] != riderID || l["requestId"] == nil || l["requestId"] == "" {
			t.Fatalf("%q line %v: want info with deliveryId, orderId, number, riderId and requestId", msg, l)
		}
	}
}

const locationPath = "/api/rider/v1/me/location"

// customerRoute is the core route the customer's delivery read calls with the customer's bearer.
const customerRoute = "GET /api/core/v1/orders/{id}"

func customerDeliveryPath(orderID string) string {
	return "/api/rider/v1/orders/" + orderID + "/delivery"
}

// customerDeliveryJSON is the customer's view of a delivery.
type customerDeliveryJSON struct {
	RiderName string `json:"riderName"`
	Status    string `json:"status"`
	Location  *struct {
		Lat        float64   `json:"lat"`
		Lng        float64   `json:"lng"`
		RecordedAt time.Time `json:"recordedAt"`
	} `json:"location"`
}

// claimOrder claims orderID for the rider with token and returns the 201 delivery.
func claimOrder(t *testing.T, token, orderID string) deliveryJSON {
	t.Helper()
	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": orderID})
	var d deliveryJSON
	if status != http.StatusCreated || json.Unmarshal(body, &d) != nil {
		t.Fatalf("claim of %s: got %d %s, want 201", orderID, status, body)
	}
	return d
}

// putPosition sends one position for the rider with token and fails unless it answers 204.
func putPosition(t *testing.T, token string, lat, lng float64) {
	t.Helper()
	if status, body := callAt(t, srv.URL, http.MethodPut, locationPath, token, map[string]float64{"lat": lat, "lng": lng}); status != http.StatusNoContent {
		t.Fatalf("location %v,%v: got %d %s, want 204", lat, lng, status, body)
	}
}

// readCustomerDelivery reads orderID with the customer's bearer and fails unless it answers 200.
func readCustomerDelivery(t *testing.T, customer, orderID string) (customerDeliveryJSON, []byte) {
	t.Helper()
	status, body := callAt(t, srv.URL, http.MethodGet, customerDeliveryPath(orderID), customer, nil)
	var got customerDeliveryJSON
	if status != http.StatusOK || json.Unmarshal(body, &got) != nil {
		t.Fatalf("customer read of %s: got %d %s, want 200", orderID, status, body)
	}
	return got, body
}

// locationRows counts the rider_locations rows of riderID.
func locationRows(t *testing.T, riderID string) int64 {
	t.Helper()
	var n int64
	if err := testPool.QueryRow(context.Background(), "select count(*) from rider_locations where rider_id = $1", riderID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// keysOf returns the sorted keys of a JSON object body.
func keysOf(t *testing.T, body []byte) []string {
	t.Helper()
	var m map[string]json.RawMessage
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

func TestPutLocationReplaces(t *testing.T) {
	riderID, token := riderAt(t, newID())
	putPosition(t, token, 12.9, 77.5)
	putPosition(t, token, 13.1, 77.7)

	if n := locationRows(t, riderID); n != 1 {
		t.Fatalf("location rows for the rider: %d, want 1", n)
	}
	var lat, lng float64
	var recorded time.Time
	if err := testPool.QueryRow(context.Background(),
		"select lat, lng, recorded_at from rider_locations where rider_id = $1", riderID).Scan(&lat, &lng, &recorded); err != nil {
		t.Fatal(err)
	}
	if lat != 13.1 || lng != 77.7 || recorded.IsZero() {
		t.Fatalf("stored location %v,%v at %v: want the second position, recorded", lat, lng, recorded)
	}
}

func TestPutLocationRefusals(t *testing.T) {
	riderID, token := riderAt(t, newID())
	cases := []struct {
		name  string
		body  map[string]any
		field string
	}{
		{"missing lat", map[string]any{"lng": 77.5}, "lat"},
		{"lat 91", map[string]any{"lat": 91.0, "lng": 77.5}, "lat"},
		{"missing lng", map[string]any{"lat": 12.9}, "lng"},
		{"lng -181", map[string]any{"lat": 12.9, "lng": -181.0}, "lng"},
		{"null lat", map[string]any{"lat": nil, "lng": 77.6}, "lat"},
	}
	for _, c := range cases {
		status, body := callAt(t, srv.URL, http.MethodPut, locationPath, token, c.body)
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != c.field {
			t.Fatalf("%s: got %d %s, want 400 validation on %s", c.name, status, body, c.field)
		}
	}
	if n := locationRows(t, riderID); n != 0 {
		t.Fatalf("location rows after refusals: %d, want 0", n)
	}
}

func TestCustomerFollowsRider(t *testing.T) {
	store := newID()
	riderID, token := riderAt(t, store)
	customer := "customer-" + newID()
	o := addOrderFor(t, store, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC), customer)
	claimOrder(t, token, o.ID)

	before, _ := readCustomerDelivery(t, customer, o.ID)
	if before.RiderName != "Asha Rao" || before.Status != "assigned" || before.Location != nil {
		t.Fatalf("customer read after the claim %+v: want Asha Rao, assigned, no location yet", before)
	}

	putPosition(t, token, 12.9716, 77.5946)
	got, body := readCustomerDelivery(t, customer, o.ID)
	if got.Location == nil || got.Location.Lat != 12.9716 || got.Location.Lng != 77.5946 {
		t.Fatalf("customer read %s: want the rider's position", body)
	}
	if d := time.Since(got.Location.RecordedAt); d < -time.Minute || d > time.Minute {
		t.Fatalf("recordedAt %v is not the server's clock now", got.Location.RecordedAt)
	}
	if keys := keysOf(t, body); strings.Join(keys, ",") != "location,riderName,status" {
		t.Fatalf("customer read keys %v: want location, riderName, status only", keys)
	}
	var loc map[string]json.RawMessage
	if err := json.Unmarshal(keysBody(t, body, "location"), &loc); err != nil || len(loc) != 3 {
		t.Fatalf("location %s: want lat, lng and recordedAt only", body)
	}
	if strings.Contains(string(body), riderID) {
		t.Fatalf("customer read %s names the rider's id", body)
	}
}

// keysBody returns the raw value of key in a JSON object body.
func keysBody(t *testing.T, body []byte, key string) []byte {
	t.Helper()
	var m map[string]json.RawMessage
	if err := json.Unmarshal(body, &m); err != nil {
		t.Fatal(err)
	}
	return m[key]
}

func TestCustomerLocationHiddenAfterDelivery(t *testing.T) {
	store := newID()
	_, token := riderAt(t, store)
	customer := "customer-" + newID()
	o := addOrderFor(t, store, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC), customer)
	claimed := claimOrder(t, token, o.ID)
	putPosition(t, token, 12.9716, 77.5946)
	if got, _ := readCustomerDelivery(t, customer, o.ID); got.Location == nil {
		t.Fatal("customer read while assigned: want the location")
	}

	if status, body := callAt(t, srv.URL, http.MethodPost, deliveredPath(claimed.ID), token, nil); status != http.StatusOK {
		t.Fatalf("delivered: got %d %s, want 200", status, body)
	}
	got, body := readCustomerDelivery(t, customer, o.ID)
	if got.Status != "delivered" || got.Location != nil || got.RiderName != "Asha Rao" {
		t.Fatalf("customer read after delivery %s: want delivered, rider name, no location", body)
	}
}

// TestCustomerLocationBeforeClaimHidden: a position recorded before the claim is an earlier shift's, not the delivery's.
func TestCustomerLocationBeforeClaimHidden(t *testing.T) {
	store := newID()
	_, token := riderAt(t, store)
	customer := "customer-" + newID()
	o := addOrderFor(t, store, "ready", time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC), customer)
	putPosition(t, token, 12.9, 77.5)
	claimOrder(t, token, o.ID)

	if got, body := readCustomerDelivery(t, customer, o.ID); got.Status != "assigned" || got.Location != nil {
		t.Fatalf("customer read %s: want assigned with no location from before the claim", body)
	}
	putPosition(t, token, 13.1, 77.7)
	if got, body := readCustomerDelivery(t, customer, o.ID); got.Location == nil || got.Location.Lat != 13.1 {
		t.Fatalf("customer read %s: want the position recorded after the claim", body)
	}
}

func TestCustomerReadRefusals(t *testing.T) {
	store := newID()
	_, token := riderAt(t, store)
	t0 := time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC)
	owner, stranger := "customer-"+newID(), "customer-"+newID()
	claimed := addOrderFor(t, store, "ready", t0, owner)
	claimOrder(t, token, claimed.ID)
	unclaimed := addOrderFor(t, store, "ready", t0, owner)
	addOrderFor(t, store, "ready", t0, stranger) // gives the stranger a live customer token

	cases := []struct {
		name, path, bearer, code string
		status                   int
	}{
		{"another customer's order", customerDeliveryPath(claimed.ID), stranger, "not_found", http.StatusNotFound},
		{"order without a delivery", customerDeliveryPath(unclaimed.ID), owner, "not_found", http.StatusNotFound},
		{"order id not a uuid", customerDeliveryPath("not-a-uuid"), owner, "not_found", http.StatusNotFound},
		{"unknown token", customerDeliveryPath(claimed.ID), "customer-unknown", "unauthorized", http.StatusUnauthorized},
	}
	for _, c := range cases {
		status, body := callAt(t, srv.URL, http.MethodGet, c.path, c.bearer, nil)
		if e := decodeError(t, body); status != c.status || e.Error.Code != c.code {
			t.Fatalf("%s: got %d %s, want %d %s", c.name, status, body, c.status, c.code)
		}
	}

	before := coreFake.Calls(customerRoute)
	status, body := callAt(t, srv.URL, http.MethodGet, customerDeliveryPath(claimed.ID), "", nil)
	if e := decodeError(t, body); status != http.StatusUnauthorized || e.Error.Code != "unauthorized" {
		t.Fatalf("no token: got %d %s, want 401 unauthorized", status, body)
	}
	if got := coreFake.Calls(customerRoute) - before; got != 0 {
		t.Fatalf("core received %d customer reads for a request without a token, want 0", got)
	}
}
