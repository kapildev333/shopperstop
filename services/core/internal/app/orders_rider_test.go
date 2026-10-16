package app

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// riderA and riderB are rider ids the rider service would send; core keeps no riders.
const (
	riderA = "00000000-0000-4000-8000-0000000008a1"
	riderB = "00000000-0000-4000-8000-0000000008b2"
)

// rider is the actor member a service sends for a rider.
func rider(id, name string) map[string]string {
	return map[string]string{"type": "rider", "id": id, "name": name}
}

// mustStatus posts a status change and decodes the 200 order.
func mustStatus(t *testing.T, token, orderID string, body any) orderView {
	t.Helper()
	status, raw := setStatus(t, token, orderID, body)
	var o orderView
	if status != http.StatusOK || json.Unmarshal(raw, &o) != nil {
		t.Fatalf("status change %v: got %d %s, want 200", body, status, raw)
	}
	return o
}

// TestRiderHandoff: the service takes a ready order out for delivery for rider A,
// whose name lands on the order and on the event; rider B then delivers it and the
// order keeps rider A's name. The customer reads both.
func TestRiderHandoff(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, s.ID, c.Customer.ID, p, "ready")

	o := mustStatus(t, testServiceToken, id, map[string]any{"status": "out_for_delivery", "actor": rider(riderA, "  Ravi Kumar ")})
	last := o.Events[len(o.Events)-1]
	if o.Status != "out_for_delivery" || o.RiderName != "Ravi Kumar" || last.ActorType != "rider" || last.ActorName != "Ravi Kumar" {
		t.Fatalf("out for delivery: status %s riderName %q last event %+v", o.Status, o.RiderName, last)
	}

	o = mustStatus(t, testServiceToken, id, map[string]any{"status": "delivered", "actor": rider(riderB, "Sunil")})
	last = o.Events[len(o.Events)-1]
	if o.Status != "delivered" || o.DeliveredAt == nil || o.RiderName != "Ravi Kumar" || last.ActorName != "Sunil" {
		t.Fatalf("delivered: status %s riderName %q last event %+v", o.Status, o.RiderName, last)
	}

	mine := readOrder(t, ordersPath+"/"+id, c.Token)
	if mine.RiderName != "Ravi Kumar" || mine.Events[1].ActorName != "Ravi Kumar" || mine.Events[0].ActorName != "" {
		t.Fatalf("customer read: riderName %q events %+v", mine.RiderName, mine.Events)
	}
}

// TestStaffOutForDeliveryHasNoRider: a staff move names no rider, and the order and
// its events carry no riderName or actorName members.
func TestStaffOutForDeliveryHasNoRider(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, s.ID, c.Customer.ID, p, "ready")
	status, raw := setStatus(t, adminToken(t), id, map[string]string{"status": "out_for_delivery"})
	if status != http.StatusOK || strings.Contains(string(raw), "riderName") || strings.Contains(string(raw), "actorName") {
		t.Fatalf("staff out for delivery: got %d %s, want 200 without riderName or actorName", status, raw)
	}
}

// TestServiceActorRules: the service must name a valid rider and may only make the
// rider's two moves; staff may not name an actor. Nothing changes on a refusal.
func TestServiceActorRules(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	ready := orderIn(t, s.ID, c.Customer.ID, p, "ready")
	for _, row := range []struct {
		what  string
		token string
		body  any
		want  int
		code  string
		field string
	}{
		{"no actor", testServiceToken, map[string]any{"status": "out_for_delivery"}, 400, "validation", "actor"},
		{"not a rider", testServiceToken, map[string]any{"status": "out_for_delivery", "actor": map[string]string{"type": "staff", "id": riderA, "name": "Ravi"}}, 400, "validation", "actor"},
		{"bad id", testServiceToken, map[string]any{"status": "out_for_delivery", "actor": rider("r1", "Ravi")}, 400, "validation", "actor"},
		{"blank name", testServiceToken, map[string]any{"status": "out_for_delivery", "actor": rider(riderA, "  ")}, 400, "validation", "actor"},
		{"long name", testServiceToken, map[string]any{"status": "out_for_delivery", "actor": rider(riderA, strings.Repeat("a", 81))}, 400, "validation", "actor"},
		{"staff names an actor", adminToken(t), map[string]any{"status": "out_for_delivery", "actor": rider(riderA, "Ravi")}, 400, "validation", "actor"},
		{"service cancels", testServiceToken, map[string]any{"status": "cancelled", "actor": rider(riderA, "Ravi")}, 403, "forbidden", ""},
		{"service skips ahead", testServiceToken, map[string]any{"status": "delivered", "actor": rider(riderA, "Ravi")}, 409, "conflict", ""},
	} {
		status, raw := setStatus(t, row.token, ready, row.body)
		expectError(t, row.what, status, raw, row.want, row.code, row.field, "")
		if got := orderStatus(t, ready); got != "ready" {
			t.Fatalf("%s: status %s, want ready", row.what, got)
		}
		if n := eventCount(t, ready); n != 1 {
			t.Fatalf("%s: %d events, want 1", row.what, n)
		}
	}
	if status, raw := setStatus(t, testServiceToken, ready, map[string]any{"status": "out_for_delivery", "actor": rider(riderA, strings.Repeat("a", 80))}); status != http.StatusOK {
		t.Fatalf("80-character name: got %d %s, want 200", status, raw)
	}
}

// TestServiceForbiddenBeforeLookup: a service cancel is refused as forbidden even
// for an order that does not exist, so the answer does not reveal which ids exist.
func TestServiceForbiddenBeforeLookup(t *testing.T) {
	status, raw := setStatus(t, testServiceToken, missingOrderID, map[string]any{"status": "cancelled", "actor": rider(riderA, "Ravi")})
	expectError(t, "service cancel on a missing order", status, raw, 403, "forbidden", "", "")
}
