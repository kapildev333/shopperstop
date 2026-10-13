package app

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

// cartPath and cartItemsPath are the customer's cart routes.
const (
	cartPath      = "/api/core/v1/me/cart"
	cartItemsPath = "/api/core/v1/me/cart/items"
)

// missingCartProductID names no product in any cart test.
const missingCartProductID = "00000000-0000-4000-8000-0000000007fe"

// cartProductView, cartLineView, cartView and cartUpdateView are the cart as the API answers it.
type cartProductView struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	PriceCents int64  `json:"priceCents"`
	InStock    bool   `json:"inStock"`
	Quantity   int32  `json:"quantity"`
}

type cartLineView struct {
	Product  cartProductView `json:"product"`
	Quantity int32           `json:"quantity"`
}

type cartView struct {
	StoreID          string         `json:"storeId"`
	Items            []cartLineView `json:"items"`
	SubtotalCents    int64          `json:"subtotalCents"`
	DeliveryFeeCents int64          `json:"deliveryFeeCents"`
	TotalCents       int64          `json:"totalCents"`
	MinOrderCents    int64          `json:"minOrderCents"`
	ShortfallCents   int64          `json:"shortfallCents"`
}

type cartUpdateView struct {
	cartView
	Replaced bool `json:"replaced"`
	Clamped  bool `json:"clamped"`
}

// cartProduct inserts an active product priced at price (its MRP too, since
// price may not exceed MRP) with 50 in stock at storeID.
func cartProduct(t *testing.T, storeID, name string, price int64) string {
	t.Helper()
	p := insertProduct(t, name, true)
	if _, err := testPool.Exec(context.Background(), "update products set price_cents = $2, mrp_cents = $2 where id = $1", p, price); err != nil {
		t.Fatal(err)
	}
	setStock(t, storeID, p, 50)
	return p
}

// putItem sends PUT /me/cart/items and returns the status and body.
func putItem(t *testing.T, token string, body any) (int, []byte) {
	t.Helper()
	return call(t, http.MethodPut, cartItemsPath, token, body)
}

// setLine sets productID to quantity in the customer's cart at storeID and returns the 200 answer.
func setLine(t *testing.T, token, storeID, productID string, quantity int) cartUpdateView {
	t.Helper()
	status, body := putItem(t, token, map[string]any{"storeId": storeID, "productId": productID, "quantity": quantity})
	var u cartUpdateView
	if status != http.StatusOK || json.Unmarshal(body, &u) != nil {
		t.Fatalf("PUT cart item %d: got %d %s, want 200", quantity, status, body)
	}
	return u
}

// readCart sends GET /me/cart and returns the 200 cart.
func readCart(t *testing.T, token string) cartView {
	t.Helper()
	status, body := call(t, http.MethodGet, cartPath, token, nil)
	var c cartView
	if status != http.StatusOK || json.Unmarshal(body, &c) != nil {
		t.Fatalf("GET cart: got %d %s, want 200", status, body)
	}
	return c
}

// requireEmptyCart fails unless body is the empty cart: no storeId, items [] and every amount 0.
func requireEmptyCart(t *testing.T, body []byte) {
	t.Helper()
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		t.Fatalf("cart body %s is not an object: %v", body, err)
	}
	if _, ok := raw["storeId"]; ok {
		t.Fatalf("empty cart carries a storeId: %s", body)
	}
	if string(raw["items"]) != "[]" {
		t.Fatalf("empty cart items %s, want []", raw["items"])
	}
	var c cartView
	if err := json.Unmarshal(body, &c); err != nil {
		t.Fatal(err)
	}
	wantTotals(t, c, 0, 0, 0, 0, 0)
}

// wantTotals fails unless the cart's amounts are the given ones, in the order
// subtotal, delivery fee, total, minimum order, shortfall.
func wantTotals(t *testing.T, c cartView, subtotal, fee, total, minOrder, shortfall int64) {
	t.Helper()
	got := [5]int64{c.SubtotalCents, c.DeliveryFeeCents, c.TotalCents, c.MinOrderCents, c.ShortfallCents}
	want := [5]int64{subtotal, fee, total, minOrder, shortfall}
	if got != want {
		t.Fatalf("totals %v, want %v (subtotal, fee, total, minOrder, shortfall)", got, want)
	}
}

// cartRows counts the customer's cart rows with plain SQL.
func cartRows(t *testing.T, customerID string) int {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(), "select count(*) from carts where customer_id = $1", customerID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestCartEmptyWhenNone(t *testing.T) {
	s := newCustomer(t)
	status, body := call(t, http.MethodGet, cartPath, s.Token, nil)
	if status != http.StatusOK {
		t.Fatalf("GET cart with no cart: got %d %s, want 200", status, body)
	}
	requireEmptyCart(t, body)
}

func TestCartBelowFreeDelivery(t *testing.T) {
	storeID := insertStore(t, true)
	p := cartProduct(t, storeID, stockName(t), 4500)
	s := newCustomer(t)
	setLine(t, s.Token, storeID, p, 2)
	c := readCart(t, s.Token)
	if c.StoreID != storeID || len(c.Items) != 1 || c.Items[0].Quantity != 2 {
		t.Fatalf("cart %+v, want one line of 2 at the store", c)
	}
	wantTotals(t, c, 9000, 2500, 11500, 9900, 10900)
}

func TestCartAtFreeDelivery(t *testing.T) {
	storeID := insertStore(t, true)
	p := cartProduct(t, storeID, stockName(t), 19900)
	s := newCustomer(t)
	setLine(t, s.Token, storeID, p, 1)
	wantTotals(t, readCart(t, s.Token), 19900, 0, 19900, 9900, 0)
}

func TestCartLivePrice(t *testing.T) {
	storeID := insertStore(t, true)
	p := cartProduct(t, storeID, stockName(t), 4500)
	s := newCustomer(t)
	setLine(t, s.Token, storeID, p, 2)
	if _, err := testPool.Exec(context.Background(), "update products set price_cents = 5000, mrp_cents = 5000 where id = $1", p); err != nil {
		t.Fatal(err)
	}
	c := readCart(t, s.Token)
	if c.SubtotalCents != 10000 || c.Items[0].Product.PriceCents != 5000 {
		t.Fatalf("after repricing to 5000: subtotal %d, price %d; want 10000 and 5000", c.SubtotalCents, c.Items[0].Product.PriceCents)
	}
}

func TestCartKeepsDeactivatedLine(t *testing.T) {
	storeID := insertStore(t, true)
	p := cartProduct(t, storeID, stockName(t), 4500)
	s := newCustomer(t)
	setLine(t, s.Token, storeID, p, 2)
	if _, err := testPool.Exec(context.Background(), "update products set is_active = false where id = $1", p); err != nil {
		t.Fatal(err)
	}
	c := readCart(t, s.Token)
	if len(c.Items) != 1 {
		t.Fatalf("after deactivation the cart lists %d lines, want the line kept", len(c.Items))
	}
	line := c.Items[0]
	if line.Product.InStock || line.Product.Quantity != 0 || line.Quantity != 2 {
		t.Fatalf("deactivated line %+v, want inStock false, product quantity 0, line quantity 2", line)
	}
}

func TestCartSetThenChange(t *testing.T) {
	storeID := insertStore(t, true)
	p := cartProduct(t, storeID, stockName(t), 4500)
	s := newCustomer(t)
	for _, q := range []int{2, 5} {
		u := setLine(t, s.Token, storeID, p, q)
		if u.Replaced || u.Clamped {
			t.Fatalf("set to %d: replaced %v clamped %v, want both false", q, u.Replaced, u.Clamped)
		}
		if len(u.Items) != 1 || u.Items[0].Quantity != int32(q) {
			t.Fatalf("set to %d: items %+v, want one line of %d", q, u.Items, q)
		}
	}
	c := readCart(t, s.Token)
	if len(c.Items) != 1 || c.Items[0].Quantity != 5 {
		t.Fatalf("after set 2 then 5: %+v, want one line of 5", c.Items)
	}
}

func TestCartZeroRemovesLastLine(t *testing.T) {
	storeID := insertStore(t, true)
	p := cartProduct(t, storeID, stockName(t), 4500)
	s := newCustomer(t)
	setLine(t, s.Token, storeID, p, 2)
	status, body := putItem(t, s.Token, map[string]any{"storeId": storeID, "productId": p, "quantity": 0})
	if status != http.StatusOK {
		t.Fatalf("set to 0: got %d %s, want 200", status, body)
	}
	requireEmptyCart(t, body)
	status, body = call(t, http.MethodGet, cartPath, s.Token, nil)
	if status != http.StatusOK {
		t.Fatalf("GET after removing the last line: got %d %s, want 200", status, body)
	}
	requireEmptyCart(t, body)
	if n := cartRows(t, s.Customer.ID); n != 0 {
		t.Fatalf("%d cart rows after the last line went, want 0", n)
	}
}

func TestCartQuantityOver20(t *testing.T) {
	storeID := insertStore(t, true)
	p := cartProduct(t, storeID, stockName(t), 4500)
	s := newCustomer(t)
	setLine(t, s.Token, storeID, p, 2)
	status, body := putItem(t, s.Token, map[string]any{"storeId": storeID, "productId": p, "quantity": 21})
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "quantity" {
		t.Fatalf("quantity 21: got %d %s, want 400 validation field quantity", status, body)
	}
	if c := readCart(t, s.Token); len(c.Items) != 1 || c.Items[0].Quantity != 2 {
		t.Fatalf("after a refused quantity 21: %+v, want the cart unchanged at 2", c.Items)
	}
}

func TestCartInactiveOrUnknownProduct(t *testing.T) {
	storeID := insertStore(t, true)
	inactive := insertProduct(t, stockName(t), false)
	s := newCustomer(t)
	for _, p := range []string{inactive, missingCartProductID} {
		status, body := putItem(t, s.Token, map[string]any{"storeId": storeID, "productId": p, "quantity": 1})
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "productId" {
			t.Fatalf("product %s: got %d %s, want 400 validation field productId", p, status, body)
		}
	}
	if n := cartRows(t, s.Customer.ID); n != 0 {
		t.Fatalf("%d cart rows after refused products, want 0", n)
	}
}

func TestCartUnknownStore(t *testing.T) {
	p := cartProduct(t, insertStore(t, true), stockName(t), 4500)
	s := newCustomer(t)
	status, body := putItem(t, s.Token, map[string]any{"storeId": missingStoreID, "productId": p, "quantity": 1})
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "storeId" {
		t.Fatalf("unknown store: got %d %s, want 400 validation field storeId", status, body)
	}
}

// TestCartBadInput: the ids must be uuids and quantity must be present; each names its field.
func TestCartBadInput(t *testing.T) {
	storeID := insertStore(t, true)
	p := cartProduct(t, storeID, stockName(t), 4500)
	s := newCustomer(t)
	cases := []struct {
		name  string
		body  map[string]any
		field string
	}{
		{"storeId not a uuid", map[string]any{"storeId": "north", "productId": p, "quantity": 1}, "storeId"},
		{"productId not a uuid", map[string]any{"storeId": storeID, "productId": "milk", "quantity": 1}, "productId"},
		{"quantity missing", map[string]any{"storeId": storeID, "productId": p}, "quantity"},
	}
	for _, c := range cases {
		status, body := putItem(t, s.Token, c.body)
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != c.field {
			t.Fatalf("%s: got %d %s, want 400 validation field %s", c.name, status, body, c.field)
		}
	}
	if n := cartRows(t, s.Customer.ID); n != 0 {
		t.Fatalf("%d cart rows after refused input, want 0", n)
	}
}

func TestCartClear(t *testing.T) {
	storeID := insertStore(t, true)
	p := cartProduct(t, storeID, stockName(t), 4500)
	q := cartProduct(t, storeID, stockName(t), 19900)
	s := newCustomer(t)
	setLine(t, s.Token, storeID, p, 2)
	setLine(t, s.Token, storeID, q, 1)
	status, body := call(t, http.MethodDelete, cartPath, s.Token, nil)
	if status != http.StatusNoContent || len(body) != 0 {
		t.Fatalf("DELETE cart: got %d %s, want 204 with no body", status, body)
	}
	status, body = call(t, http.MethodGet, cartPath, s.Token, nil)
	if status != http.StatusOK {
		t.Fatalf("GET after clear: got %d %s, want 200", status, body)
	}
	requireEmptyCart(t, body)
	// Clearing again, with no cart left, is still 204.
	if status, body := call(t, http.MethodDelete, cartPath, s.Token, nil); status != http.StatusNoContent {
		t.Fatalf("DELETE with no cart: got %d %s, want 204", status, body)
	}
}

func TestCartStaffToken401(t *testing.T) {
	storeID := insertStore(t, true)
	p := cartProduct(t, storeID, stockName(t), 4500)
	for _, token := range []string{adminToken(t), storeStaffToken(t)} {
		for _, g := range []struct {
			method, path string
			body         any
		}{
			{http.MethodGet, cartPath, nil},
			{http.MethodPut, cartItemsPath, map[string]any{"storeId": storeID, "productId": p, "quantity": 1}},
			{http.MethodDelete, cartPath, nil},
		} {
			status, body := call(t, g.method, g.path, token, g.body)
			if e := decodeError(t, body); status != http.StatusUnauthorized || e.Error.Code != "unauthorized" {
				t.Fatalf("%s %s with a staff token: got %d %s, want 401 unauthorized", g.method, g.path, status, body)
			}
		}
	}
}

func TestCartIsPerCustomer(t *testing.T) {
	storeID := insertStore(t, true)
	p := cartProduct(t, storeID, stockName(t), 4500)
	a := newCustomer(t)
	b := newCustomer(t)
	setLine(t, a.Token, storeID, p, 2)
	if c := readCart(t, a.Token); len(c.Items) != 1 {
		t.Fatalf("customer A's cart %+v, want its line", c.Items)
	}
	status, body := call(t, http.MethodGet, cartPath, b.Token, nil)
	if status != http.StatusOK {
		t.Fatalf("customer B GET: got %d %s, want 200", status, body)
	}
	requireEmptyCart(t, body)
}

func TestCartClampedToStock(t *testing.T) {
	storeID := insertStore(t, true)
	p := insertProduct(t, stockName(t), true)
	setStock(t, storeID, p, 3)
	s := newCustomer(t)
	u := setLine(t, s.Token, storeID, p, 5)
	if !u.Clamped || u.Replaced {
		t.Fatalf("set 5 of 3 in stock: clamped %v replaced %v, want clamped true and replaced false", u.Clamped, u.Replaced)
	}
	if len(u.Items) != 1 || u.Items[0].Quantity != 3 {
		t.Fatalf("set 5 of 3 in stock: items %+v, want one line of 3", u.Items)
	}
	if c := readCart(t, s.Token); len(c.Items) != 1 || c.Items[0].Quantity != 3 {
		t.Fatalf("GET after the clamp: items %+v, want one line of 3", c.Items)
	}
}

func TestCartOutOfStockClampsToNothing(t *testing.T) {
	storeID := insertStore(t, true)
	p := insertProduct(t, stockName(t), true)
	setStock(t, storeID, p, 0)
	s := newCustomer(t)
	status, body := putItem(t, s.Token, map[string]any{"storeId": storeID, "productId": p, "quantity": 1})
	var u cartUpdateView
	if status != http.StatusOK || json.Unmarshal(body, &u) != nil {
		t.Fatalf("set 1 of 0 in stock: got %d %s, want 200", status, body)
	}
	if !u.Clamped || len(u.Items) != 0 {
		t.Fatalf("set 1 of 0 in stock: clamped %v items %+v, want clamped true and no line", u.Clamped, u.Items)
	}
	if n := cartRows(t, s.Customer.ID); n != 0 {
		t.Fatalf("%d cart rows after the only line clamped away, want 0", n)
	}
}

func TestCartOtherStoreReplaces(t *testing.T) {
	storeA := insertStore(t, true)
	storeB := insertStore(t, true)
	p := cartProduct(t, storeA, stockName(t), 4500)
	q := cartProduct(t, storeA, stockName(t), 4500)
	r := cartProduct(t, storeB, stockName(t), 4500)
	s := newCustomer(t)
	setLine(t, s.Token, storeA, p, 2)
	setLine(t, s.Token, storeA, q, 1)
	u := setLine(t, s.Token, storeB, r, 1)
	if !u.Replaced || u.Clamped {
		t.Fatalf("switch to store B: replaced %v clamped %v, want replaced true and clamped false", u.Replaced, u.Clamped)
	}
	if u.StoreID != storeB || len(u.Items) != 1 || u.Items[0].Product.ID != r {
		t.Fatalf("switch to store B: cart %+v, want store B holding only R", u.cartView)
	}
	c := readCart(t, s.Token)
	if c.StoreID != storeB || len(c.Items) != 1 || c.Items[0].Product.ID != r {
		t.Fatalf("GET after the switch: cart %+v, want store B holding only R", c)
	}
}

func TestCartZeroForOtherStoreKeepsCart(t *testing.T) {
	storeA := insertStore(t, true)
	storeB := insertStore(t, true)
	p := cartProduct(t, storeA, stockName(t), 4500)
	r := cartProduct(t, storeB, stockName(t), 4500)
	s := newCustomer(t)
	setLine(t, s.Token, storeA, p, 2)
	u := setLine(t, s.Token, storeB, r, 0)
	if u.Replaced || u.Clamped {
		t.Fatalf("zero for store B: replaced %v clamped %v, want both false", u.Replaced, u.Clamped)
	}
	if u.StoreID != storeA || len(u.Items) != 1 || u.Items[0].Product.ID != p {
		t.Fatalf("zero for store B: cart %+v, want store A holding P", u.cartView)
	}
}
