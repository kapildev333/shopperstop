package app

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"testing"
)

// verified marks the customer's email verified, as POST /auth/verify-email would.
func verified(t *testing.T, b buyer) buyer {
	t.Helper()
	if _, err := testPool.Exec(context.Background(), "update customers set email_verified = true where id = $1", b.ID); err != nil {
		t.Fatal(err)
	}
	return b
}

// placePaid sends POST /orders with the buyer's address and paymentMethod method.
func placePaid(t *testing.T, b buyer, method string) (int, []byte) {
	t.Helper()
	return call(t, http.MethodPost, ordersPath, b.Token, map[string]any{"addressId": b.AddressID, "paymentMethod": method})
}

// TestPlaceOnline: a verified customer's online order is placed as a cash one is,
// with payment status pending on every read and no reference yet.
func TestPlaceOnline(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := verified(t, newBuyer(t, s.Pincode))
	setLine(t, b.Token, s.ID, p, 2)

	status, body := placePaid(t, b, "online")
	var o orderView
	if status != http.StatusCreated || json.Unmarshal(body, &o) != nil {
		t.Fatalf("place online: got %d %s, want 201", status, body)
	}
	if o.Status != "placed" || o.PaymentMethod != "online" || o.PaymentStatus != "pending" || strings.Contains(string(body), "paymentReference") {
		t.Fatalf("online order %s: want placed, online, pending and no paymentReference", body)
	}
	if got := quantityAt(t, s.ID, p); got != 3 {
		t.Fatalf("stock after placement %d, want 3", got)
	}
	for _, read := range []struct{ path, token string }{{ordersPath + "/" + o.ID, b.Token}, {adminOrderPath(o.ID), adminToken(t)}} {
		if got := readOrder(t, read.path, read.token); got.PaymentMethod != "online" || got.PaymentStatus != "pending" {
			t.Fatalf("GET %s: paymentMethod %q paymentStatus %q, want online and pending", read.path, got.PaymentMethod, got.PaymentStatus)
		}
	}
}

// TestPlaceCash: an explicit cod order carries no paymentStatus or paymentReference member.
func TestPlaceCash(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 1)
	status, body := placePaid(t, b, "cod")
	if status != http.StatusCreated || !strings.Contains(string(body), `"paymentMethod":"cod"`) || strings.Contains(string(body), "paymentStatus") || strings.Contains(string(body), "paymentReference") {
		t.Fatalf("place cod: got %d %s, want 201 with paymentMethod cod and no payment status or reference", status, body)
	}
}

// TestPlaceOnlineUnverified: an unverified customer cannot pay online and nothing
// changes; the same cart is placed for cash.
func TestPlaceOnlineUnverified(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 2)

	status, body := placePaid(t, b, "online")
	expectError(t, "online, unverified", status, body, http.StatusConflict, "email_unverified", "", "")
	requireUnchanged(t, b, s.ID, map[string]int32{p: 2}, map[string]int32{p: 5})
	mustPlace(t, b)
}

// TestPlacePaymentMethodInvalid: any other method is 400 field paymentMethod and changes nothing.
func TestPlacePaymentMethodInvalid(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := verified(t, newBuyer(t, s.Pincode))
	setLine(t, b.Token, s.ID, p, 2)
	for _, method := range []string{"card", "ONLINE", " cod"} {
		status, body := placePaid(t, b, method)
		expectError(t, method, status, body, http.StatusBadRequest, "validation", "paymentMethod", "")
	}
	requireUnchanged(t, b, s.ID, map[string]int32{p: 2}, map[string]int32{p: 5})
}

// onlineOrder places a verified buyer's cart of 2 units (stock 5) at a new shop
// online and returns the 201 order with its shop.
func onlineOrder(t *testing.T) (orderView, shop) {
	t.Helper()
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := verified(t, newBuyer(t, s.Pincode))
	setLine(t, b.Token, s.ID, p, 2)
	status, body := placePaid(t, b, "online")
	var o orderView
	if status != http.StatusCreated || json.Unmarshal(body, &o) != nil {
		t.Fatalf("place online: got %d %s, want 201", status, body)
	}
	return o, s
}

// setPayment posts a payment change for orderID with token.
func setPayment(t *testing.T, token, orderID string, body any) (int, []byte) {
	t.Helper()
	return call(t, http.MethodPost, adminOrderPath(orderID)+"/payment", token, body)
}

// mustPay posts a payment change with the payment service's token and decodes the 200 order.
func mustPay(t *testing.T, orderID, status, reference string) orderView {
	t.Helper()
	code, body := setPayment(t, testPaymentToken, orderID, map[string]string{"status": status, "reference": reference})
	var o orderView
	if code != http.StatusOK || json.Unmarshal(body, &o) != nil {
		t.Fatalf("payment %s: got %d %s, want 200", status, code, body)
	}
	return o
}

// paymentLines counts the `order payment` log lines written for orderID.
func paymentLines(buf *lockedBuffer, orderID string) int {
	n := 0
	for _, line := range strings.Split(buf.String(), "\n") {
		if strings.Contains(line, `"msg":"order payment"`) && strings.Contains(line, orderID) {
			n++
		}
	}
	return n
}

// TestAcceptAwaitsPayment: staff cannot accept an online order while its payment
// is pending; once the payment service marks it paid they can.
func TestAcceptAwaitsPayment(t *testing.T) {
	o, _ := onlineOrder(t)
	token := adminToken(t)
	status, body := setStatus(t, token, o.ID, map[string]string{"status": "accepted"})
	expectError(t, "accept pending", status, body, http.StatusConflict, "payment_pending", "", "")
	if got, n := orderStatus(t, o.ID), eventCount(t, o.ID); got != "placed" || n != 1 {
		t.Fatalf("after the refused accept: status %s with %d events, want placed with 1", got, n)
	}
	mustPay(t, o.ID, "paid", "pay_123")
	if got := mustStatus(t, token, o.ID, map[string]string{"status": "accepted"}); got.Status != "accepted" {
		t.Fatalf("accept paid: status %s, want accepted", got.Status)
	}
}

// TestPendingOnlineOrderCancels: the customer and staff cancel an unpaid online
// order as they cancel a cash one, and the stock returns.
func TestPendingOnlineOrderCancels(t *testing.T) {
	for _, by := range []string{"customer", "staff"} {
		s := newShop(t)
		p := cartProduct(t, s.ID, stockName(t), 5000)
		stockTo(t, s.ID, p, 5)
		b := verified(t, newBuyer(t, s.Pincode))
		setLine(t, b.Token, s.ID, p, 2)
		_, body := placePaid(t, b, "online")
		var o orderView
		if err := json.Unmarshal(body, &o); err != nil {
			t.Fatal(err)
		}
		var status int
		if by == "customer" {
			status, body = call(t, http.MethodPost, ordersPath+"/"+o.ID+"/cancel", b.Token, map[string]string{})
		} else {
			status, body = setStatus(t, adminToken(t), o.ID, map[string]string{"status": "cancelled"})
		}
		if status != http.StatusOK || orderStatus(t, o.ID) != "cancelled" || quantityAt(t, s.ID, p) != 5 {
			t.Fatalf("%s cancels a pending online order: got %d %s, want 200, cancelled and stock 5", by, status, body)
		}
	}
}

// TestPaymentPaidThenRefunded: the payment service marks a pending payment paid
// and later refunded; each change keeps the order's status, sets the reference,
// adds one event by the system and logs one `order payment` line.
func TestPaymentPaidThenRefunded(t *testing.T) {
	var buf lockedBuffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })

	o, _ := onlineOrder(t)
	paid := mustPay(t, o.ID, "paid", "  pay_123 ")
	last := paid.Events[len(paid.Events)-1]
	if paid.Status != "placed" || paid.PaymentStatus != "paid" || paid.PaymentReference != "pay_123" || len(paid.Events) != 2 {
		t.Fatalf("paid: status %s payment %s reference %q with %d events, want placed, paid, pay_123 and 2", paid.Status, paid.PaymentStatus, paid.PaymentReference, len(paid.Events))
	}
	if last.FromStatus != "placed" || last.ToStatus != "placed" || last.ActorType != "system" || last.ActorName != "payment" || last.Note != "Payment paid, reference pay_123" {
		t.Fatalf("paid event %+v, want placed to placed by system payment with the reference", last)
	}
	if n := paymentLines(&buf, o.ID); n != 1 {
		t.Fatalf("%d order payment lines after paid, want 1", n)
	}

	cancelled := mustStatus(t, adminToken(t), o.ID, map[string]string{"status": "cancelled", "note": "store closing"})
	refunded := mustPay(t, o.ID, "refunded", "rfnd_9")
	last = refunded.Events[len(refunded.Events)-1]
	if refunded.Status != "cancelled" || refunded.PaymentStatus != "refunded" || refunded.PaymentReference != "rfnd_9" || len(refunded.Events) != len(cancelled.Events)+1 {
		t.Fatalf("refunded: status %s payment %s reference %q with %d events, want cancelled, refunded, rfnd_9 and one more", refunded.Status, refunded.PaymentStatus, refunded.PaymentReference, len(refunded.Events))
	}
	if last.FromStatus != "cancelled" || last.ToStatus != "cancelled" || last.ActorType != "system" || last.Note != "Payment refunded, reference rfnd_9" {
		t.Fatalf("refunded event %+v", last)
	}
	if mine := readOrder(t, ordersPath+"/"+o.ID, customerTokenOf(t, o.ID)); mine.PaymentStatus != "refunded" || mine.PaymentReference != "rfnd_9" {
		t.Fatalf("customer read: payment %s reference %q, want refunded and rfnd_9", mine.PaymentStatus, mine.PaymentReference)
	}
}

// customerTokenOf signs in a new session of the customer of orderID.
func customerTokenOf(t *testing.T, orderID string) string {
	t.Helper()
	var email string
	if err := testPool.QueryRow(context.Background(), "select c.email from orders o join customers c on c.id = o.customer_id where o.id = $1", orderID).Scan(&email); err != nil {
		t.Fatal(err)
	}
	status, body := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "", map[string]string{"email": email, "password": testPassword})
	var sb sessionBody
	if status != http.StatusOK || json.Unmarshal(body, &sb) != nil {
		t.Fatalf("sign in %s: got %d %s", email, status, body)
	}
	return sb.Token
}

// TestPaymentConflicts: paid only from pending, refunded only from paid, and a
// cash order has no payment to change; a refusal changes nothing.
func TestPaymentConflicts(t *testing.T) {
	o, s := onlineOrder(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	cash := orderIn(t, s.ID, newCustomer(t).Customer.ID, p, "placed")
	for _, row := range []struct {
		what, id, status string
	}{
		{"refund a pending payment", o.ID, "refunded"},
		{"pay a cash order", cash, "paid"},
		{"refund a cash order", cash, "refunded"},
	} {
		status, body := setPayment(t, testPaymentToken, row.id, map[string]string{"status": row.status, "reference": "ref_1"})
		expectError(t, row.what, status, body, http.StatusConflict, "conflict", "", "")
		if n := eventCount(t, row.id); n != 1 {
			t.Fatalf("%s: %d events, want 1", row.what, n)
		}
	}
	mustPay(t, o.ID, "paid", "pay_1")
	status, body := setPayment(t, testPaymentToken, o.ID, map[string]string{"status": "paid", "reference": "pay_2"})
	expectError(t, "pay twice", status, body, http.StatusConflict, "conflict", "", "")
	if got := readOrder(t, adminOrderPath(o.ID), adminToken(t)); got.PaymentReference != "pay_1" || len(got.Events) != 2 {
		t.Fatalf("after paying twice: reference %q with %d events, want pay_1 and 2", got.PaymentReference, len(got.Events))
	}
}

// TestPaymentValidation: the body is checked before the order is read.
func TestPaymentValidation(t *testing.T) {
	o, _ := onlineOrder(t)
	for _, row := range []struct {
		what  string
		body  map[string]string
		field string
	}{
		{"unknown status", map[string]string{"status": "failed", "reference": "r"}, "status"},
		{"pending", map[string]string{"status": "pending", "reference": "r"}, "status"},
		{"no reference", map[string]string{"status": "paid"}, "reference"},
		{"blank reference", map[string]string{"status": "paid", "reference": "   "}, "reference"},
		{"long reference", map[string]string{"status": "paid", "reference": strings.Repeat("r", 101)}, "reference"},
	} {
		status, body := setPayment(t, testPaymentToken, o.ID, row.body)
		expectError(t, row.what, status, body, http.StatusBadRequest, "validation", row.field, "")
	}
	status, body := setPayment(t, testPaymentToken, missingOrderID, map[string]string{"status": "paid", "reference": "r"})
	expectError(t, "unknown order", status, body, http.StatusNotFound, "not_found", "", "")
	if got := readOrder(t, adminOrderPath(o.ID), adminToken(t)); got.PaymentStatus != "pending" || len(got.Events) != 1 {
		t.Fatalf("after refusals: payment %s with %d events, want pending and 1", got.PaymentStatus, len(got.Events))
	}
}

// TestPaymentRouteForServicesOnly: staff are 403, customers and no token 401.
func TestPaymentRouteForServicesOnly(t *testing.T) {
	o, _ := onlineOrder(t)
	body := map[string]string{"status": "paid", "reference": "r"}
	status, raw := setPayment(t, adminToken(t), o.ID, body)
	expectError(t, "admin", status, raw, http.StatusForbidden, "forbidden", "", "services only")
	for what, token := range map[string]string{"no token": "", "customer": newCustomer(t).Token} {
		status, raw := setPayment(t, token, o.ID, body)
		expectError(t, what, status, raw, http.StatusUnauthorized, "unauthorized", "", "")
	}
}

// TestPaymentTimeoutCancels: the payment service cancels an unpaid order as the
// system; the stock returns and the event names the actor and has no actor id.
func TestPaymentTimeoutCancels(t *testing.T) {
	o, s := onlineOrder(t)
	got := mustStatus(t, testPaymentToken, o.ID, map[string]any{"status": "cancelled", "note": "not paid in 15 minutes", "actor": map[string]string{"type": "system", "name": "payment timeout"}})
	last := got.Events[len(got.Events)-1]
	if got.Status != "cancelled" || got.CancelReason != "not paid in 15 minutes" || last.ActorType != "system" || last.ActorName != "payment timeout" {
		t.Fatalf("timeout cancel: status %s reason %q last event %+v", got.Status, got.CancelReason, last)
	}
	if got := quantityAt(t, s.ID, o.Items[0].ProductID); got != 5 {
		t.Fatalf("stock after the timeout cancel %d, want 5", got)
	}
	var withID int
	if err := testPool.QueryRow(context.Background(), "select count(*) from order_events where order_id = $1 and actor_type = 'system' and actor_id is not null", o.ID).Scan(&withID); err != nil {
		t.Fatal(err)
	}
	if withID != 0 {
		t.Fatalf("%d system events with an actor id, want 0", withID)
	}
}

// TestPaymentServiceActorRules: the payment service only cancels, naming a system
// actor with a name and no id; the rider service still cannot cancel.
func TestPaymentServiceActorRules(t *testing.T) {
	o, _ := onlineOrder(t)
	system := map[string]string{"type": "system", "name": "payment timeout"}
	for _, row := range []struct {
		what  string
		token string
		body  any
		want  int
		code  string
		field string
	}{
		{"payment accepts", testPaymentToken, map[string]any{"status": "accepted", "actor": system}, 403, "forbidden", ""},
		{"payment delivers", testPaymentToken, map[string]any{"status": "delivered", "actor": system}, 403, "forbidden", ""},
		{"no actor", testPaymentToken, map[string]any{"status": "cancelled"}, 400, "validation", "actor"},
		{"rider actor", testPaymentToken, map[string]any{"status": "cancelled", "actor": rider(riderA, "Ravi")}, 400, "validation", "actor"},
		{"system with an id", testPaymentToken, map[string]any{"status": "cancelled", "actor": map[string]string{"type": "system", "id": riderA, "name": "payment timeout"}}, 400, "validation", "actor"},
		{"blank name", testPaymentToken, map[string]any{"status": "cancelled", "actor": map[string]string{"type": "system", "name": " "}}, 400, "validation", "actor"},
		{"rider cancels", testServiceToken, map[string]any{"status": "cancelled", "actor": system}, 403, "forbidden", ""},
	} {
		status, raw := setStatus(t, row.token, o.ID, row.body)
		expectError(t, row.what, status, raw, row.want, row.code, row.field, "")
		if got, n := orderStatus(t, o.ID), eventCount(t, o.ID); got != "placed" || n != 1 {
			t.Fatalf("%s: status %s with %d events, want placed with 1", row.what, got, n)
		}
	}
}
