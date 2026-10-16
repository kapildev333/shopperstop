package app

import (
	"bytes"
	"context"
	"encoding/base32"
	"encoding/binary"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

// adminOrderPath is the staff route for one order.
func adminOrderPath(id string) string { return "/api/core/v1/admin/orders/" + id }

// storeOrdersPath is the staff order list of one store.
func storeOrdersPath(storeID string) string { return adminStoresPath + "/" + storeID + "/orders" }

// setStatus posts a status change for orderID with token and returns the status and body.
func setStatus(t *testing.T, token, orderID string, body any) (int, []byte) {
	t.Helper()
	return call(t, http.MethodPost, adminOrderPath(orderID)+"/status", token, body)
}

// shopStaffToken inserts a store-staff user of storeID and returns its token.
func shopStaffToken(t *testing.T, storeID string) string {
	t.Helper()
	email := uniqueEmail(t)
	if _, err := testPool.Exec(context.Background(),
		"insert into staff_users (email, password_hash, name, role, store_id) values ($1, $2, 'Shop Staff', 'store_staff', $3)",
		email, cheapHash(), storeID); err != nil {
		t.Fatal(err)
	}
	return staffSignIn(t, email)
}

// orderInSeq numbers the fixture orders, so each one gets its own order number.
var orderInSeq atomic.Int64

// orderIn inserts one order of customerID at storeID in status, with one line of
// productID (quantity 2 at 1000) and its placement event, and returns its id.
// It takes no stock.
func orderIn(t *testing.T, storeID, customerID, productID, status string) string {
	t.Helper()
	var n [8]byte
	binary.BigEndian.PutUint64(n[:], uint64(orderInSeq.Add(1)))
	number := "SS-" + base32.StdEncoding.EncodeToString(n[3:])
	ctx := context.Background()
	var id string
	if err := testPool.QueryRow(ctx, `insert into orders (number, customer_id, store_id, store_name, promised_minutes, status, customer_name, customer_phone,
		address_label, address_line1, address_pincode, subtotal_cents, delivery_fee_cents, total_cents)
		values ($1, $2, $3, 'Test store', 10, $4::order_status, 'Asha', '+919800000001', 'Home', '12 Test Rd', '570000', 2000, 0, 2000)
		returning id`, number, customerID, storeID, status).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, `insert into order_items (order_id, product_id, name, unit_label, price_cents, mrp_cents, quantity)
		values ($1, $2, 'Fixture', '1 unit', 1000, 1000, 2)`, id, productID); err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, `insert into order_events (order_id, to_status, actor_type, actor_id)
		values ($1, 'placed', 'customer', $2)`, id, customerID); err != nil {
		t.Fatal(err)
	}
	return id
}

// lockedBuffer is a bytes.Buffer the server's goroutine can write while the test reads it.
type lockedBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (l *lockedBuffer) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.Write(p)
}

func (l *lockedBuffer) String() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.String()
}

// transitionLines decodes the `order transition` log lines written for orderID.
func transitionLines(t *testing.T, buf *lockedBuffer, orderID string) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, raw := range strings.Split(buf.String(), "\n") {
		if raw == "" {
			continue
		}
		var line map[string]any
		if err := json.Unmarshal([]byte(raw), &line); err != nil {
			t.Fatalf("log line %q is not JSON: %v", raw, err)
		}
		if line["msg"] == "order transition" && line["orderId"] == orderID {
			out = append(out, line)
		}
	}
	return out
}

// statusNames are the seven statuses in table order.
var statusNames = []string{"placed", "accepted", "packing", "ready", "out_for_delivery", "delivered", "cancelled"}

// staffMoves are the seven moves of the transition table, as (from, to) pairs.
var staffMoves = map[[2]string]bool{
	{"placed", "accepted"}:            true,
	{"placed", "cancelled"}:           true,
	{"accepted", "packing"}:           true,
	{"accepted", "cancelled"}:         true,
	{"packing", "ready"}:              true,
	{"ready", "out_for_delivery"}:     true,
	{"out_for_delivery", "delivered"}: true,
}

// TestStatusTransitionMatrix: over every ordered pair of statuses, staff move an
// order along exactly the seven moves of the table. An allowed move answers 200
// with one more event (a cancel also returns the quantities to stock); any other
// answers 409 conflict and changes nothing.
func TestStatusTransitionMatrix(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	token := adminToken(t)
	for _, from := range statusNames {
		for _, to := range statusNames {
			what := from + " to " + to
			id := orderIn(t, s.ID, c.Customer.ID, p, from)
			before := quantityAt(t, s.ID, p)
			status, body := setStatus(t, token, id, map[string]any{"status": to})
			if staffMoves[[2]string{from, to}] {
				var o orderView
				if status != http.StatusOK || json.Unmarshal(body, &o) != nil {
					t.Fatalf("%s: got %d %s, want 200", what, status, body)
				}
				if o.Status != to || len(o.Events) != 2 {
					t.Fatalf("%s: status %s with %d events, want %s with 2", what, o.Status, len(o.Events), to)
				}
				last := o.Events[len(o.Events)-1]
				if last.FromStatus != from || last.ToStatus != to || last.ActorType != "staff" {
					t.Fatalf("%s: last event %+v", what, last)
				}
				want := before
				if to == "cancelled" {
					want += 2
				}
				if q := quantityAt(t, s.ID, p); q != want {
					t.Fatalf("%s: stock %d, want %d", what, q, want)
				}
				continue
			}
			expectError(t, what, status, body, http.StatusConflict, "conflict", "", "cannot move an order from "+from+" to "+to)
			if got := orderStatus(t, id); got != from {
				t.Fatalf("%s: status %s after the refused move, want %s", what, got, from)
			}
			if n := eventCount(t, id); n != 1 {
				t.Fatalf("%s: %d events after the refused move, want 1", what, n)
			}
			if q := quantityAt(t, s.ID, p); q != before {
				t.Fatalf("%s: stock %d after the refused move, want %d", what, q, before)
			}
		}
	}
}

// TestStatusAcceptWithNote: the note is the event's note, and an accept has no cancelReason.
func TestStatusAcceptWithNote(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, s.ID, c.Customer.ID, p, "placed")
	status, body := setStatus(t, adminToken(t), id, map[string]string{"status": "accepted", "note": "on it"})
	var o orderView
	if status != http.StatusOK || json.Unmarshal(body, &o) != nil {
		t.Fatalf("accept: got %d %s, want 200", status, body)
	}
	if last := o.Events[len(o.Events)-1]; last.Note != "on it" {
		t.Fatalf("last event note %q, want on it", last.Note)
	}
	if strings.Contains(string(body), "cancelReason") {
		t.Fatalf("accept answers a cancelReason: %s", body)
	}
}

// TestStatusCancelByStaff: staff cancel records the note as cancelReason and sets cancelledAt.
func TestStatusCancelByStaff(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, s.ID, c.Customer.ID, p, "placed")
	status, body := setStatus(t, adminToken(t), id, map[string]string{"status": "cancelled", "note": "Customer unreachable"})
	var o orderView
	if status != http.StatusOK || json.Unmarshal(body, &o) != nil {
		t.Fatalf("cancel by staff: got %d %s, want 200", status, body)
	}
	if o.CancelReason != "Customer unreachable" || o.CancelledAt == nil {
		t.Fatalf("cancel by staff: reason %q, cancelledAt %v", o.CancelReason, o.CancelledAt)
	}
}

// TestStatusDelivered: moving out_for_delivery to delivered sets deliveredAt and logs a staff event.
func TestStatusDelivered(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, s.ID, c.Customer.ID, p, "out_for_delivery")
	status, body := setStatus(t, adminToken(t), id, map[string]string{"status": "delivered"})
	var o orderView
	if status != http.StatusOK || json.Unmarshal(body, &o) != nil {
		t.Fatalf("delivered: got %d %s, want 200", status, body)
	}
	if o.DeliveredAt == nil {
		t.Fatalf("delivered order has no deliveredAt: %s", body)
	}
	last := o.Events[len(o.Events)-1]
	if last.FromStatus != "out_for_delivery" || last.ToStatus != "delivered" || last.ActorType != "staff" {
		t.Fatalf("last event %+v, want out_for_delivery to delivered by staff", last)
	}
}

// TestStatusUnknown: a status outside the seven, or none, is 400 on status; an
// over-long note is 400 on note; nothing changes.
func TestStatusUnknown(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, s.ID, c.Customer.ID, p, "placed")
	token := adminToken(t)
	const msg = "must be one of placed, accepted, packing, ready, out_for_delivery, delivered, cancelled"
	for _, body := range []any{map[string]string{"status": "lost"}, map[string]string{}} {
		status, raw := setStatus(t, token, id, body)
		expectError(t, "status", status, raw, http.StatusBadRequest, "validation", "status", msg)
	}
	status, raw := setStatus(t, token, id, map[string]string{"status": "accepted", "note": strings.Repeat("a", 501)})
	expectError(t, "long note", status, raw, http.StatusBadRequest, "validation", "note", "at most 500 characters")
	if got := orderStatus(t, id); got != "placed" {
		t.Fatalf("status %s after the refused changes, want placed", got)
	}
}

// TestStoreOrdersBoard: the store's list is filtered by status, newest first, and
// its query parameters are checked.
func TestStoreOrdersBoard(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	placed := orderIn(t, s.ID, c.Customer.ID, p, "placed")
	accepted := orderIn(t, s.ID, c.Customer.ID, p, "accepted")
	token := adminToken(t)
	list := func(query string) (int, []byte) {
		return call(t, http.MethodGet, storeOrdersPath(s.ID)+query, token, nil)
	}

	status, body := list("?status=placed")
	var board orderListView
	if status != http.StatusOK || json.Unmarshal(body, &board) != nil {
		t.Fatalf("board placed: got %d %s, want 200", status, body)
	}
	if board.Total != 1 || len(board.Items) != 1 || board.Items[0].ID != placed {
		t.Fatalf("board placed: total %d, items %+v; want the placed order alone", board.Total, board.Items)
	}
	o := board.Items[0]
	if o.CustomerName != "Asha" || o.CustomerPhone != "+919800000001" || o.Address.Pincode != "570000" || len(o.Items) != 1 || len(o.Events) != 1 {
		t.Fatalf("board placed: order %+v", o)
	}

	status, body = list("")
	if status != http.StatusOK || json.Unmarshal(body, &board) != nil {
		t.Fatalf("board: got %d %s, want 200", status, body)
	}
	if board.Total != 2 || len(board.Items) != 2 || board.Items[0].ID != accepted || board.Items[1].ID != placed {
		t.Fatalf("board: total %d, want 2 with the accepted order first", board.Total)
	}

	status, body = list("?status=")
	if status != http.StatusOK || json.Unmarshal(body, &board) != nil || board.Total != 2 {
		t.Fatalf("board with an empty status: got %d %s, want 200 with total 2", status, body)
	}

	status, body = list("?status=lost")
	expectError(t, "status lost", status, body, http.StatusBadRequest, "validation", "status", "")

	status, body = list("?pageSize=0")
	expectError(t, "pageSize 0", status, body, http.StatusBadRequest, "validation", "pageSize", "")
}

// TestStoreStaffIsolation: store staff of A get 404 for B's order and B's list,
// and cannot move B's order; an unknown store is 404 for an admin too.
func TestStoreStaffIsolation(t *testing.T) {
	a := newShop(t)
	b := newShop(t)
	p := cartProduct(t, b.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, b.ID, c.Customer.ID, p, "placed")
	staff := shopStaffToken(t, a.ID)

	status, body := call(t, http.MethodGet, adminOrderPath(id), staff, nil)
	expectError(t, "other store's order", status, body, http.StatusNotFound, "not_found", "", "not found")
	status, body = setStatus(t, staff, id, map[string]string{"status": "accepted"})
	expectError(t, "other store's status change", status, body, http.StatusNotFound, "not_found", "", "not found")
	if got := orderStatus(t, id); got != "placed" {
		t.Fatalf("status %s after the refused change, want placed", got)
	}
	if n := eventCount(t, id); n != 1 {
		t.Fatalf("%d events after the refused change, want 1", n)
	}
	status, body = call(t, http.MethodGet, storeOrdersPath(b.ID), staff, nil)
	expectError(t, "other store's list", status, body, http.StatusNotFound, "not_found", "", "not found")
	status, body = call(t, http.MethodGet, storeOrdersPath(b.ID)+"?status=lost&page=0", staff, nil)
	expectError(t, "other store's list with a bad status", status, body, http.StatusNotFound, "not_found", "", "not found")
	status, body = call(t, http.MethodGet, storeOrdersPath(missingStoreID), staff, nil)
	expectError(t, "unknown store's list for store staff", status, body, http.StatusNotFound, "not_found", "", "not found")
	status, body = call(t, http.MethodGet, storeOrdersPath(missingStoreID), adminToken(t), nil)
	expectError(t, "unknown store's list", status, body, http.StatusNotFound, "not_found", "", "not found")
}

// TestStoreStaffOwnOrder: store staff reach their own store's order, its list and its status.
func TestStoreStaffOwnOrder(t *testing.T) {
	a := newShop(t)
	p := cartProduct(t, a.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, a.ID, c.Customer.ID, p, "placed")
	staff := shopStaffToken(t, a.ID)

	got := readOrder(t, adminOrderPath(id), staff)
	if got.ID != id || got.StoreID != a.ID || got.Status != "placed" || got.CustomerName != "Asha" || got.CustomerPhone != "+919800000001" ||
		got.Address.Label != "Home" || got.Address.Line1 != "12 Test Rd" || got.Address.Pincode != "570000" ||
		got.SubtotalCents != 2000 || got.DeliveryFeeCents != 0 || got.TotalCents != 2000 {
		t.Fatalf("own order: %+v, want the placed fixture order of store %s for Asha, +919800000001, Home, 12 Test Rd, 570000, 2000 + 0 = 2000", got, a.ID)
	}
	if len(got.Items) != 1 || got.Items[0].ProductID != p || got.Items[0].Name != "Fixture" || got.Items[0].PriceCents != 1000 || got.Items[0].Quantity != 2 {
		t.Fatalf("own order items: %+v, want one line of 2 Fixture at 1000", got.Items)
	}
	if len(got.Events) != 1 || got.Events[0].ToStatus != "placed" || got.Events[0].ActorType != "customer" {
		t.Fatalf("own order events: %+v, want one placed event by the customer", got.Events)
	}
	status, body := call(t, http.MethodGet, storeOrdersPath(a.ID), staff, nil)
	var board orderListView
	if status != http.StatusOK || json.Unmarshal(body, &board) != nil || board.Total != 1 {
		t.Fatalf("own list: got %d %s, want 200 with total 1", status, body)
	}
	status, body = setStatus(t, staff, id, map[string]string{"status": "accepted"})
	var o orderView
	if status != http.StatusOK || json.Unmarshal(body, &o) != nil || o.Status != "accepted" {
		t.Fatalf("own status change: got %d %s, want 200 accepted", status, body)
	}
}

// TestAdminOrderUnknown404: an unknown order id, and one that is not a uuid, are 404 for an admin.
func TestAdminOrderUnknown404(t *testing.T) {
	token := adminToken(t)
	for _, path := range []string{adminOrderPath(missingOrderID), "/api/core/v1/admin/orders/abc"} {
		status, body := call(t, http.MethodGet, path, token, nil)
		expectError(t, path, status, body, http.StatusNotFound, "not_found", "", "not found")
	}
}

// TestStaffOrderRoutesCustomerToken401: a customer token is not a staff session on the three staff order routes.
func TestStaffOrderRoutesCustomerToken401(t *testing.T) {
	c := newCustomer(t)
	for _, row := range []struct {
		method, path string
		body         any
	}{
		{http.MethodGet, storeOrdersPath(testStoreID), nil},
		{http.MethodGet, adminOrderPath(missingOrderID), nil},
		{http.MethodPost, adminOrderPath(missingOrderID) + "/status", map[string]string{"status": "accepted"}},
	} {
		status, body := call(t, row.method, row.path, c.Token, row.body)
		expectError(t, row.method+" "+row.path, status, body, http.StatusUnauthorized, "unauthorized", "", "")
	}
}

// requireTransitionKeys fails unless the line's keys are exactly the slog keys the
// handler always writes plus Decision 7's (orderId, number, to, actorType, actorId,
// requestId), with from only when withFrom.
func requireTransitionKeys(t *testing.T, what string, line map[string]any, withFrom bool) {
	t.Helper()
	want := map[string]bool{"time": true, "level": true, "msg": true, "orderId": true, "number": true,
		"to": true, "actorType": true, "actorId": true, "requestId": true}
	if withFrom {
		want["from"] = true
	}
	for k := range line {
		if !want[k] {
			t.Fatalf("%s: extra key %q in %v", what, k, line)
		}
	}
	for k := range want {
		if _, ok := line[k]; !ok {
			t.Fatalf("%s: missing key %q in %v", what, k, line)
		}
	}
}

// statusAsync posts raw as a status change for orderID with token and returns the
// answer. It runs in goroutines, so it never fails the test itself: the caller checks err.
func statusAsync(token, orderID, raw string) answer {
	req, err := http.NewRequest(http.MethodPost, srv.URL+adminOrderPath(orderID)+"/status", strings.NewReader(raw))
	if err != nil {
		return answer{err: err}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return answer{err: err}
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	return answer{status: resp.StatusCode, body: body, err: err}
}

// TestStatusConcurrentSameTransition: the admin and the store's staff move one
// accepted order to packing at once. One answers 200, the other 409 conflict, and
// the order ends packing with three events: placed, accepted, packing.
func TestStatusConcurrentSameTransition(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	admin := adminToken(t)
	staff := shopStaffToken(t, s.ID)
	for range 10 {
		id := orderIn(t, s.ID, c.Customer.ID, p, "placed")
		if status, body := setStatus(t, admin, id, map[string]string{"status": "accepted"}); status != http.StatusOK {
			t.Fatalf("accept: got %d %s, want 200", status, body)
		}
		start := make(chan struct{})
		var wg sync.WaitGroup
		var got [2]answer
		for i, token := range []string{admin, staff} {
			wg.Add(1)
			go func() {
				defer wg.Done()
				<-start
				got[i] = statusAsync(token, id, `{"status":"packing"}`)
			}()
		}
		close(start)
		wg.Wait()

		var won, lost int
		for _, a := range got {
			if a.err != nil {
				t.Fatal(a.err)
			}
			switch a.status {
			case http.StatusOK:
				won++
			case http.StatusConflict:
				if e := decodeError(t, a.body); e.Error.Code != "conflict" {
					t.Fatalf("409 with code %q, want conflict: %s", e.Error.Code, a.body)
				}
				lost++
			default:
				t.Fatalf("racing status change: got %d %s, want 200 or 409", a.status, a.body)
			}
		}
		if won != 1 || lost != 1 {
			t.Fatalf("racing status change: %d answered 200 and %d 409, want one each", won, lost)
		}
		if now := orderStatus(t, id); now != "packing" {
			t.Fatalf("status %s after the race, want packing", now)
		}
		if n := eventCount(t, id); n != 3 {
			t.Fatalf("%d events after the race, want 3 (placed, accepted, packing)", n)
		}
	}
}

// TestTransitionLogLine: each transition logs one `order transition` line after it
// commits; a refused move logs nothing. Placement has no `from`.
func TestTransitionLogLine(t *testing.T) {
	var buf lockedBuffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })

	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 1)
	placed := mustPlace(t, b)
	token := adminToken(t)

	if status, body := setStatus(t, token, placed.ID, map[string]string{"status": "accepted"}); status != http.StatusOK {
		t.Fatalf("accept: got %d %s, want 200", status, body)
	}
	lines := transitionLines(t, &buf, placed.ID)
	if len(lines) != 2 {
		t.Fatalf("%d transition lines after placement and accept, want 2: %v", len(lines), lines)
	}
	first := lines[0]
	if first["to"] != "placed" || first["actorType"] != "customer" || first["actorId"] != b.ID || first["number"] != placed.Number {
		t.Fatalf("placement line %v", first)
	}
	if _, ok := first["from"]; ok {
		t.Fatalf("placement line has a from: %v", first)
	}
	requireTransitionKeys(t, "placement line", first, false)
	second := lines[1]
	if second["from"] != "placed" || second["to"] != "accepted" || second["actorType"] != "staff" {
		t.Fatalf("accept line %v", second)
	}
	requireTransitionKeys(t, "accept line", second, true)

	if status, body := setStatus(t, token, placed.ID, map[string]string{"status": "packing"}); status != http.StatusOK {
		t.Fatalf("packing: got %d %s, want 200", status, body)
	}
	if status, body := setStatus(t, token, placed.ID, map[string]string{"status": "packing"}); status != http.StatusConflict {
		t.Fatalf("packing again: got %d %s, want 409", status, body)
	}
	packing := 0
	for _, line := range transitionLines(t, &buf, placed.ID) {
		if line["to"] == "packing" {
			packing++
		}
	}
	if packing != 1 {
		t.Fatalf("%d lines to packing, want 1 (the refused move logs none)", packing)
	}
}
