package app

import (
	"context"
	"encoding/json"
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
