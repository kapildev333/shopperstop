package app

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"
)

const orderEventsPath = "/api/core/v1/admin/order-events"

// feedItem is one item of GET /admin/order-events.
type feedItem struct {
	Seq           int64     `json:"seq"`
	OrderID       string    `json:"orderId"`
	OrderNumber   string    `json:"orderNumber"`
	StoreID       string    `json:"storeId"`
	CustomerID    string    `json:"customerId"`
	FromStatus    string    `json:"fromStatus"`
	ToStatus      string    `json:"toStatus"`
	PaymentMethod string    `json:"paymentMethod"`
	PaymentStatus string    `json:"paymentStatus"`
	ActorType     string    `json:"actorType"`
	CreatedAt     time.Time `json:"createdAt"`
}

// lastSeq is the highest event seq so far, 0 with no events.
func lastSeq(t *testing.T) int64 {
	t.Helper()
	var n int64
	if err := testPool.QueryRow(context.Background(), "select coalesce(max(seq), 0) from order_events").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// feed reads the events feed with the payment service's token and query, failing unless it is 200.
func feed(t *testing.T, query string) ([]feedItem, string) {
	t.Helper()
	status, body := call(t, http.MethodGet, orderEventsPath+query, testPaymentToken, nil)
	var out struct {
		Items []feedItem `json:"items"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &out) != nil || out.Items == nil {
		t.Fatalf("GET order-events%s: got %d %s, want 200 with items", query, status, body)
	}
	return out.Items, string(body)
}

// TestEventFeedTailsPlacements: two placements and a payment come out of the feed
// in commit order with ascending seq, each with its order's ids and current
// payment state; limit and after page through them.
func TestEventFeedTailsPlacements(t *testing.T) {
	before := lastSeq(t)
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 9)
	cash := newBuyer(t, s.Pincode)
	setLine(t, cash.Token, s.ID, p, 1)
	a := mustPlace(t, cash)
	online := verified(t, newBuyer(t, s.Pincode))
	setLine(t, online.Token, s.ID, p, 1)
	_, raw := placePaid(t, online, "online")
	var b orderView
	if err := json.Unmarshal(raw, &b); err != nil {
		t.Fatal(err)
	}
	mustPay(t, b.ID, "paid", "pay_feed")

	items, body := feed(t, "?after="+strconv.FormatInt(before, 10))
	if len(items) != 3 {
		t.Fatalf("feed after %d: %s, want 3 events", before, body)
	}
	if items[0].Seq <= before || items[1].Seq <= items[0].Seq || items[2].Seq <= items[1].Seq {
		t.Fatalf("seqs %d, %d, %d after %d: want strictly ascending", items[0].Seq, items[1].Seq, items[2].Seq, before)
	}
	want := []feedItem{
		{OrderID: a.ID, OrderNumber: a.Number, StoreID: s.ID, CustomerID: cash.ID, ToStatus: "placed", PaymentMethod: "cod", ActorType: "customer"},
		{OrderID: b.ID, OrderNumber: b.Number, StoreID: s.ID, CustomerID: online.ID, ToStatus: "placed", PaymentMethod: "online", PaymentStatus: "paid", ActorType: "customer"},
		{OrderID: b.ID, OrderNumber: b.Number, StoreID: s.ID, CustomerID: online.ID, FromStatus: "placed", ToStatus: "placed", PaymentMethod: "online", PaymentStatus: "paid", ActorType: "system"},
	}
	for i, w := range want {
		got := items[i]
		w.Seq, w.CreatedAt = got.Seq, got.CreatedAt
		if got != w || got.CreatedAt.IsZero() || got.CreatedAt.Location() != time.UTC {
			t.Fatalf("item %d: %+v, want %+v", i, got, w)
		}
	}
	if first := strings.Index(body, "}"); strings.Contains(body[:first], "paymentStatus") || strings.Contains(body[:first], "fromStatus") {
		t.Fatalf("cash placement item %s: want no paymentStatus and no fromStatus", body[:first+1])
	}

	if one, _ := feed(t, "?after="+strconv.FormatInt(before, 10)+"&limit=1"); len(one) != 1 || one[0].Seq != items[0].Seq {
		t.Fatalf("limit=1: %+v, want only seq %d", one, items[0].Seq)
	}
	if next, _ := feed(t, "?after="+strconv.FormatInt(items[0].Seq, 10)+"&limit=1"); len(next) != 1 || next[0].Seq != items[1].Seq {
		t.Fatalf("after the first: %+v, want only seq %d", next, items[1].Seq)
	}
	if rest, body := feed(t, "?after="+strconv.FormatInt(items[2].Seq, 10)); len(rest) != 0 || body != `{"items":[]}`+"\n" {
		t.Fatalf("after the last: %q, want {\"items\":[]}", body)
	}
}

// TestEventFeedValidation: after and limit must be whole numbers in range.
func TestEventFeedValidation(t *testing.T) {
	for _, row := range []struct{ query, field string }{
		{"?after=-1", "after"},
		{"?after=x", "after"},
		{"?after=", "after"},
		{"?limit=0", "limit"},
		{"?limit=501", "limit"},
		{"?limit=1.5", "limit"},
	} {
		status, body := call(t, http.MethodGet, orderEventsPath+row.query, testPaymentToken, nil)
		expectError(t, row.query, status, body, http.StatusBadRequest, "validation", row.field, "")
	}
	if items, _ := feed(t, "?limit=500"); len(items) > 500 {
		t.Fatalf("limit=500 answered %d items", len(items))
	}
}

// TestEventFeedForServicesOnly: only the payment service reads the feed.
func TestEventFeedForServicesOnly(t *testing.T) {
	status, body := call(t, http.MethodGet, orderEventsPath, adminToken(t), nil)
	expectError(t, "admin", status, body, http.StatusForbidden, "forbidden", "", "services only")
	status, body = call(t, http.MethodGet, orderEventsPath, testServiceToken, nil)
	expectError(t, "rider service", status, body, http.StatusForbidden, "forbidden", "", "")
	for what, token := range map[string]string{"no token": "", "customer": newCustomer(t).Token} {
		status, body := call(t, http.MethodGet, orderEventsPath, token, nil)
		expectError(t, what, status, body, http.StatusUnauthorized, "unauthorized", "", "")
	}
}

// TestEventWritesWaitForTheEventsLock: while another transaction holds the
// events lock, a status change waits for it, so seq follows commit order.
func TestEventWritesWaitForTheEventsLock(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	id := orderIn(t, s.ID, newCustomer(t).Customer.ID, p, "placed")
	token := adminToken(t)
	ctx := context.Background()
	tx, err := testPool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "select pg_advisory_xact_lock(hashtext('order_events'))"); err != nil {
		t.Fatal(err)
	}

	done := make(chan int, 1)
	go func() {
		req, _ := http.NewRequest(http.MethodPost, srv.URL+adminOrderPath(id)+"/status", bytes.NewReader([]byte(`{"status":"accepted"}`)))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			done <- 0
			return
		}
		resp.Body.Close()
		done <- resp.StatusCode
	}()
	select {
	case status := <-done:
		t.Fatalf("status change answered %d while the events lock was held, want it to wait", status)
	case <-time.After(300 * time.Millisecond):
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case status := <-done:
		if status != http.StatusOK {
			t.Fatalf("status change after the lock: %d, want 200", status)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("status change still waiting 5 s after the lock was released")
	}
}
