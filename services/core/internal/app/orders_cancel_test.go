package app

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// forceStatus sets an order's status by plain SQL, for a test that needs an order in a given state.
func forceStatus(t *testing.T, orderID, status string) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(), "update orders set status = $2::order_status where id = $1", orderID, status); err != nil {
		t.Fatal(err)
	}
}

// orderStatus reads an order's status by plain SQL.
func orderStatus(t *testing.T, orderID string) string {
	t.Helper()
	var s string
	if err := testPool.QueryRow(context.Background(), "select status::text from orders where id = $1", orderID).Scan(&s); err != nil {
		t.Fatal(err)
	}
	return s
}

// eventCount counts an order's events by plain SQL.
func eventCount(t *testing.T, orderID string) int {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(), "select count(*) from order_events where order_id = $1", orderID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// cancel sends POST /orders/{id}/cancel with the token and body and returns the status and body.
func cancel(t *testing.T, token, orderID string, body any) (int, []byte) {
	t.Helper()
	return call(t, http.MethodPost, ordersPath+"/"+orderID+"/cancel", token, body)
}

// TestCancelRestoresStock: a placed order is cancelled with a reason; its quantities go back to the stock.
func TestCancelRestoresStock(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 2)
	placed := mustPlace(t, b)
	if q := quantityAt(t, s.ID, p); q != 3 {
		t.Fatalf("stock after placement %d, want 3", q)
	}

	status, body := cancel(t, b.Token, placed.ID, map[string]string{"reason": "Ordered by mistake"})
	var o orderView
	if status != http.StatusOK || json.Unmarshal(body, &o) != nil {
		t.Fatalf("cancel: got %d %s, want 200", status, body)
	}
	if o.Status != "cancelled" || o.CancelReason != "Ordered by mistake" || o.CancelledAt == nil {
		t.Fatalf("cancelled order %+v, want status cancelled, the reason and a cancelledAt time", o)
	}
	if len(o.Events) != 2 {
		t.Fatalf("events %+v, want 2", o.Events)
	}
	if last := o.Events[1]; last.FromStatus != "placed" || last.ToStatus != "cancelled" || last.ActorType != "customer" || last.Note != "Ordered by mistake" {
		t.Fatalf("last event %+v, want placed to cancelled by the customer with the reason as the note", last)
	}
	if q := quantityAt(t, s.ID, p); q != 5 {
		t.Fatalf("stock after cancel %d, want 5", q)
	}
}

// TestCancelAccepted: an accepted order can be cancelled too, and its stock comes back.
func TestCancelAccepted(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 2)
	placed := mustPlace(t, b)
	forceStatus(t, placed.ID, "accepted")

	status, body := cancel(t, b.Token, placed.ID, map[string]any{})
	var o orderView
	if status != http.StatusOK || json.Unmarshal(body, &o) != nil {
		t.Fatalf("cancel an accepted order: got %d %s, want 200", status, body)
	}
	if last := o.Events[len(o.Events)-1]; last.FromStatus != "accepted" || last.ToStatus != "cancelled" {
		t.Fatalf("last event %+v, want accepted to cancelled", last)
	}
	if q := quantityAt(t, s.ID, p); q != 5 {
		t.Fatalf("stock after cancel %d, want 5", q)
	}
}

// TestCancelTooLate: from packing onward, and once cancelled, a cancel answers 409 and changes nothing.
func TestCancelTooLate(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	b := newBuyer(t, s.Pincode)
	for _, status := range []string{"packing", "ready", "out_for_delivery", "delivered", "cancelled"} {
		stockTo(t, s.ID, p, 5)
		setLine(t, b.Token, s.ID, p, 2)
		placed := mustPlace(t, b)
		forceStatus(t, placed.ID, status)

		code, body := cancel(t, b.Token, placed.ID, map[string]any{})
		expectError(t, "cancel a "+status+" order", code, body, http.StatusConflict, "conflict", "", "cannot move an order from "+status+" to cancelled")
		if got := orderStatus(t, placed.ID); got != status {
			t.Fatalf("status %s after the refused cancel, want %s", got, status)
		}
		if n := eventCount(t, placed.ID); n != 1 {
			t.Fatalf("%d events after the refused cancel, want 1", n)
		}
		if q := quantityAt(t, s.ID, p); q != 3 {
			t.Fatalf("stock %d after the refused cancel of a %s order, want 3", q, status)
		}
	}
}

// TestCancelOtherCustomer404: another customer's order, and an unknown id, are 404 for any cancel.
func TestCancelOtherCustomer404(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	owner := newBuyer(t, s.Pincode)
	setLine(t, owner.Token, s.ID, p, 2)
	placed := mustPlace(t, owner)
	other := newBuyer(t, s.Pincode)

	status, body := cancel(t, other.Token, placed.ID, map[string]any{})
	expectError(t, "another customer's order", status, body, http.StatusNotFound, "not_found", "", "not found")
	if got := orderStatus(t, placed.ID); got != "placed" {
		t.Fatalf("status %s after another customer's cancel, want placed", got)
	}
	status, body = cancel(t, owner.Token, missingOrderID, map[string]any{})
	expectError(t, "an unknown order", status, body, http.StatusNotFound, "not_found", "", "not found")
}

// TestCancelReasonTooLong: a reason over 500 characters names reason and changes nothing; 500 is fine.
func TestCancelReasonTooLong(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 2)
	placed := mustPlace(t, b)

	status, body := cancel(t, b.Token, placed.ID, map[string]string{"reason": strings.Repeat("a", 501)})
	expectError(t, "a 501-character reason", status, body, http.StatusBadRequest, "validation", "reason", "at most 500 characters")
	if got := orderStatus(t, placed.ID); got != "placed" {
		t.Fatalf("status %s after the refused cancel, want placed", got)
	}

	status, body = cancel(t, b.Token, placed.ID, map[string]string{"reason": strings.Repeat("a", 500)})
	if status != http.StatusOK {
		t.Fatalf("a 500-character reason: got %d %s, want 200", status, body)
	}
}

// TestCancelEmptyObject: {} cancels with no reason, and cancelReason is omitted from the answer.
func TestCancelEmptyObject(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 2)
	placed := mustPlace(t, b)

	status, body := cancel(t, b.Token, placed.ID, map[string]any{})
	if status != http.StatusOK {
		t.Fatalf("cancel with {}: got %d %s, want 200", status, body)
	}
	if strings.Contains(string(body), "cancelReason") {
		t.Fatalf("answer %s has a cancelReason, want none", body)
	}
}

// TestCancelNoBody: a cancel without a JSON body is 400 invalid JSON, like every JSON route.
func TestCancelNoBody(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 2)
	placed := mustPlace(t, b)

	status, body := cancel(t, b.Token, placed.ID, nil)
	expectError(t, "no body", status, body, http.StatusBadRequest, "validation", "", "invalid JSON")
	if got := orderStatus(t, placed.ID); got != "placed" {
		t.Fatalf("status %s after the refused cancel, want placed", got)
	}
}
