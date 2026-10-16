package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const ordersPath = "/api/core/v1/orders"

// missingOrderID names no order in any order test.
const missingOrderID = "00000000-0000-4000-8000-0000000007fd"

// orderPin numbers the pincodes of this file: 570001 onward, which no other test uses.
var orderPin atomic.Int64

var orderNumberPattern = regexp.MustCompile(`^SS-[A-Z2-7]{8}$`)

// nextPincode returns a six-digit pincode no other test has used.
func nextPincode() string { return fmt.Sprint(570000 + orderPin.Add(1)) }

// shop is a store that delivers to its own pincode and has no minimum order.
type shop struct{ ID, Pincode string }

func newShop(t *testing.T) shop {
	t.Helper()
	s := shop{Pincode: nextPincode()}
	s.ID = insertStore(t, true, s.Pincode)
	if _, err := testPool.Exec(context.Background(), "update stores set min_order_cents = 0 where id = $1", s.ID); err != nil {
		t.Fatal(err)
	}
	return s
}

// stockTo sets the stock of productID at storeID to n.
func stockTo(t *testing.T, storeID, productID string, n int) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(), "update store_stock set quantity = $3 where store_id = $1 and product_id = $2", storeID, productID, n); err != nil {
		t.Fatal(err)
	}
}

// buyer is a signed-in customer with a phone and one address.
type buyer struct{ Token, ID, AddressID string }

// newBuyer makes a customer with the phone +919800000001 and a Home address at pincode.
func newBuyer(t *testing.T, pincode string) buyer {
	t.Helper()
	c := newCustomer(t)
	if status, body := call(t, http.MethodPatch, "/api/core/v1/me", c.Token, map[string]string{"phone": "+919800000001"}); status != http.StatusOK {
		t.Fatalf("set phone: got %d %s, want 200", status, body)
	}
	a := createAddress(t, c.Token, map[string]any{"label": "Home", "line1": "12 Test Rd", "pincode": pincode})
	return buyer{Token: c.Token, ID: c.Customer.ID, AddressID: a.ID}
}

// orderView, orderItemView and orderEventView are the order as the API answers it.
type orderView struct {
	ID      string `json:"id"`
	Number  string `json:"number"`
	StoreID string `json:"storeId"`
	Status  string `json:"status"`
	// CustomerName is the snapshot of the customer's name at placement.
	CustomerName  string `json:"customerName"`
	CustomerPhone string `json:"customerPhone"`
	Address       struct {
		Label   string `json:"label"`
		Line1   string `json:"line1"`
		Line2   string `json:"line2"`
		Pincode string `json:"pincode"`
	} `json:"address"`
	SubtotalCents    int64            `json:"subtotalCents"`
	DeliveryFeeCents int64            `json:"deliveryFeeCents"`
	TotalCents       int64            `json:"totalCents"`
	PaymentMethod    string           `json:"paymentMethod"`
	PlacedAt         time.Time        `json:"placedAt"`
	DeliveredAt      *time.Time       `json:"deliveredAt"`
	CancelledAt      *time.Time       `json:"cancelledAt"`
	CancelReason     string           `json:"cancelReason"`
	RiderName        string           `json:"riderName"`
	Items            []orderItemView  `json:"items"`
	Events           []orderEventView `json:"events"`
}

type orderItemView struct {
	ProductID  string `json:"productId"`
	Name       string `json:"name"`
	UnitLabel  string `json:"unitLabel"`
	ImageURL   string `json:"imageUrl"`
	PriceCents int64  `json:"priceCents"`
	MrpCents   int64  `json:"mrpCents"`
	Quantity   int32  `json:"quantity"`
}

type orderEventView struct {
	FromStatus string    `json:"fromStatus"`
	ToStatus   string    `json:"toStatus"`
	ActorType  string    `json:"actorType"`
	ActorName  string    `json:"actorName"`
	Note       string    `json:"note"`
	CreatedAt  time.Time `json:"createdAt"`
}

// place sends POST /orders with the buyer's address and returns the status and body.
func place(t *testing.T, b buyer) (int, []byte) {
	t.Helper()
	return call(t, http.MethodPost, ordersPath, b.Token, map[string]any{"addressId": b.AddressID})
}

// answer is one POST /orders result, collected by a goroutine for the test goroutine to check.
type answer struct {
	status int
	body   []byte
	err    error
}

// placeAsync sends POST /orders for the buyer and returns the answer. It runs in
// goroutines, so it never fails the test itself: the caller checks err.
func placeAsync(b buyer) answer {
	raw, err := json.Marshal(map[string]any{"addressId": b.AddressID})
	if err != nil {
		return answer{err: err}
	}
	req, err := http.NewRequest(http.MethodPost, srv.URL+ordersPath, bytes.NewReader(raw))
	if err != nil {
		return answer{err: err}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+b.Token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return answer{err: err}
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	return answer{status: resp.StatusCode, body: body, err: err}
}

// mustPlace places the buyer's cart and returns the order, failing unless it is 201.
func mustPlace(t *testing.T, b buyer) orderView {
	t.Helper()
	status, body := place(t, b)
	var o orderView
	if status != http.StatusCreated || json.Unmarshal(body, &o) != nil {
		t.Fatalf("place: got %d %s, want 201", status, body)
	}
	return o
}

// requireUnchanged fails unless the buyer has no order, the cart holds exactly
// the lines given (product id to quantity) and each product's stock at storeID is as given.
func requireUnchanged(t *testing.T, b buyer, storeID string, cart, stock map[string]int32) {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(), "select count(*) from orders where customer_id = $1", b.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("%d orders after a refused placement, want 0", n)
	}
	c := readCart(t, b.Token)
	if len(c.Items) != len(cart) {
		t.Fatalf("cart %+v, want %d lines", c.Items, len(cart))
	}
	for _, l := range c.Items {
		if q, ok := cart[l.Product.ID]; !ok || q != l.Quantity {
			t.Fatalf("cart line %s at %d, want %v", l.Product.ID, l.Quantity, cart)
		}
	}
	for p, want := range stock {
		if got := quantityAt(t, storeID, p); got != want {
			t.Fatalf("stock of %s is %d, want %d", p, got, want)
		}
	}
}

// wantAmounts fails unless the order's subtotal, delivery fee and total are the given ones.
func wantAmounts(t *testing.T, o orderView, subtotal, fee, total int64) {
	t.Helper()
	if o.SubtotalCents != subtotal || o.DeliveryFeeCents != fee || o.TotalCents != total {
		t.Fatalf("order amounts %d, %d, %d; want %d, %d, %d", o.SubtotalCents, o.DeliveryFeeCents, o.TotalCents, subtotal, fee, total)
	}
}

func TestPlaceOrder(t *testing.T) {
	s := newShop(t)
	name := stockName(t)
	p := cartProduct(t, s.ID, name, 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 2)

	status, body := place(t, b)
	var o orderView
	if status != http.StatusCreated || json.Unmarshal(body, &o) != nil {
		t.Fatalf("place: got %d %s, want 201", status, body)
	}
	if o.Status != "placed" || !orderNumberPattern.MatchString(o.Number) || o.PaymentMethod != "cod" || o.StoreID != s.ID {
		t.Fatalf("order %+v, want status placed, a number, paymentMethod cod and the shop", o)
	}
	if o.CustomerName != "Asha" || o.CustomerPhone != "+919800000001" {
		t.Fatalf("customer %q %q, want Asha and +919800000001", o.CustomerName, o.CustomerPhone)
	}
	if o.Address.Label != "Home" || o.Address.Line1 != "12 Test Rd" || o.Address.Pincode != s.Pincode {
		t.Fatalf("address %+v, want Home, 12 Test Rd, %s", o.Address, s.Pincode)
	}
	wantAmounts(t, o, 10000, 2500, 12500)
	if len(o.Items) != 1 {
		t.Fatalf("items %+v, want one", o.Items)
	}
	it := o.Items[0]
	if it.ProductID != p || it.Name != name || it.UnitLabel != "1 unit" || it.PriceCents != 5000 || it.MrpCents != 5000 || it.Quantity != 2 {
		t.Fatalf("item %+v, want product %s %s, 1 unit, 5000, 5000, quantity 2", it, p, name)
	}
	if len(o.Events) != 1 || o.Events[0].ToStatus != "placed" || o.Events[0].ActorType != "customer" {
		t.Fatalf("events %+v, want one placed event by the customer", o.Events)
	}
	if strings.Contains(string(body), "fromStatus") {
		t.Fatalf("placement body %s has a fromStatus, want it absent", body)
	}
	if o.PlacedAt.Location() != time.UTC {
		t.Fatalf("placedAt %s is not in UTC", o.PlacedAt)
	}
	if got := quantityAt(t, s.ID, p); got != 3 {
		t.Fatalf("stock after placement %d, want 3", got)
	}
	status, cartBody := call(t, http.MethodGet, cartPath, b.Token, nil)
	if status != http.StatusOK {
		t.Fatalf("GET cart after placement: got %d %s, want 200", status, cartBody)
	}
	requireEmptyCart(t, cartBody)
}

func TestPlaceOrderFee(t *testing.T) {
	s := newShop(t)
	cheap := cartProduct(t, s.ID, stockName(t), 5000)
	dear := cartProduct(t, s.ID, stockName(t), 19900)
	b1 := newBuyer(t, s.Pincode)
	setLine(t, b1.Token, s.ID, cheap, 2)
	wantAmounts(t, mustPlace(t, b1), 10000, 2500, 12500)
	b2 := newBuyer(t, s.Pincode)
	setLine(t, b2.Token, s.ID, dear, 1)
	wantAmounts(t, mustPlace(t, b2), 19900, 0, 19900)
}

func TestPlaceOrderEmptyCart(t *testing.T) {
	b := newBuyer(t, nextPincode())
	status, body := place(t, b)
	expectError(t, "empty cart", status, body, http.StatusBadRequest, "validation", "", "cart is empty")
}

func TestPlaceOrderOtherCustomersAddress(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	other := newBuyer(t, nextPincode())
	setLine(t, b.Token, s.ID, p, 2)
	cases := []struct {
		name    string
		body    map[string]any
		message string
	}{
		{"another customer's address", map[string]any{"addressId": other.AddressID}, "unknown address"},
		{"no addressId", map[string]any{}, "required"},
		{"addressId not a uuid", map[string]any{"addressId": "abc"}, "must be a uuid"},
	}
	for _, c := range cases {
		status, body := call(t, http.MethodPost, ordersPath, b.Token, c.body)
		expectError(t, c.name, status, body, http.StatusBadRequest, "validation", "addressId", c.message)
		requireUnchanged(t, b, s.ID, map[string]int32{p: 2}, map[string]int32{p: 5})
	}
}

func TestPlaceOrderBelowMinimum(t *testing.T) {
	s := newShop(t)
	if _, err := testPool.Exec(context.Background(), "update stores set min_order_cents = 9900 where id = $1", s.ID); err != nil {
		t.Fatal(err)
	}
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 1)
	status, body := place(t, b)
	expectError(t, "below the minimum", status, body, http.StatusBadRequest, "validation", "subtotal", "below the store's minimum order")
	requireUnchanged(t, b, s.ID, map[string]int32{p: 1}, map[string]int32{p: 5})
}

func TestPlaceOrderAddressServedElsewhere(t *testing.T) {
	a := newShop(t)
	other := newShop(t)
	p := cartProduct(t, a.ID, stockName(t), 5000)
	stockTo(t, a.ID, p, 5)
	b := newBuyer(t, other.Pincode)
	setLine(t, b.Token, a.ID, p, 1)
	status, body := place(t, b)
	expectError(t, "address served by store B", status, body, http.StatusConflict, "not_serviceable", "addressId", "the store does not deliver to this address")
	requireUnchanged(t, b, a.ID, map[string]int32{p: 1}, map[string]int32{p: 5})

	// An address that no store serves is refused the same way.
	unserved := createAddress(t, b.Token, map[string]any{"label": "Work", "line1": "4 Test Rd", "pincode": nextPincode()})
	b.AddressID = unserved.ID
	status, body = place(t, b)
	expectError(t, "address no store serves", status, body, http.StatusConflict, "not_serviceable", "addressId", "the store does not deliver to this address")
	requireUnchanged(t, b, a.ID, map[string]int32{p: 1}, map[string]int32{p: 5})
}

func TestPlaceOrderStoreClosed(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 2)
	if _, err := testPool.Exec(context.Background(), "update stores set is_open = false where id = $1", s.ID); err != nil {
		t.Fatal(err)
	}
	status, body := place(t, b)
	expectError(t, "store closed", status, body, http.StatusConflict, "not_serviceable", "", "the store is closed")
	requireUnchanged(t, b, s.ID, map[string]int32{p: 2}, map[string]int32{p: 5})
}

func TestPlaceOrderOutOfStock(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	q := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, q, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 2)
	setLine(t, b.Token, s.ID, q, 3)
	stockTo(t, s.ID, q, 1)
	status, body := place(t, b)
	expectError(t, "one line short", status, body, http.StatusConflict, "out_of_stock", "", "some products are out of stock")
	if ids := decodeError(t, body).Error.ProductIDs; !slices.Equal(ids, []string{q}) {
		t.Fatalf("productIds %v, want [%s]", ids, q)
	}
	requireUnchanged(t, b, s.ID, map[string]int32{p: 2, q: 3}, map[string]int32{p: 5, q: 1})
}

func TestPlaceOrderInactiveProduct(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 2)
	if _, err := testPool.Exec(context.Background(), "update products set is_active = false where id = $1", p); err != nil {
		t.Fatal(err)
	}
	status, body := place(t, b)
	expectError(t, "deactivated product", status, body, http.StatusConflict, "out_of_stock", "", "some products are out of stock")
	if ids := decodeError(t, body).Error.ProductIDs; !slices.Equal(ids, []string{p}) {
		t.Fatalf("productIds %v, want [%s]", ids, p)
	}
	requireUnchanged(t, b, s.ID, map[string]int32{p: 2}, map[string]int32{p: 5})
}

// TestPlaceOrderRaceForLastUnit: two buyers place for the last unit at once.
// Each round exactly one placement is 201 and the other is 409 out_of_stock.
func TestPlaceOrderRaceForLastUnit(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	x := newBuyer(t, s.Pincode)
	y := newBuyer(t, s.Pincode)
	for range 5 {
		// Stock first: the cart clamps its quantity to the stock.
		stockTo(t, s.ID, p, 1)
		setLine(t, x.Token, s.ID, p, 1)
		setLine(t, y.Token, s.ID, p, 1)
		start := make(chan struct{})
		var wg sync.WaitGroup
		var ax, ay answer
		wg.Add(2)
		go func() {
			defer wg.Done()
			<-start
			ax = placeAsync(x)
		}()
		go func() {
			defer wg.Done()
			<-start
			ay = placeAsync(y)
		}()
		close(start)
		wg.Wait()
		created, refused := 0, 0
		for _, r := range []answer{ax, ay} {
			if r.err != nil {
				t.Fatalf("placement request: %v", r.err)
			}
			switch r.status {
			case http.StatusCreated:
				created++
			case http.StatusConflict:
				expectError(t, "losing placement", r.status, r.body, http.StatusConflict, "out_of_stock", "", "some products are out of stock")
				if ids := decodeError(t, r.body).Error.ProductIDs; !slices.Equal(ids, []string{p}) {
					t.Fatalf("losing placement productIds %v, want [%s]", ids, p)
				}
				refused++
			default:
				t.Fatalf("placement got %d %s, want 201 or 409", r.status, r.body)
			}
		}
		if created != 1 || refused != 1 {
			t.Fatalf("round: %d created and %d refused, want 1 and 1", created, refused)
		}
		if got := quantityAt(t, s.ID, p); got != 0 {
			t.Fatalf("stock after the round %d, want 0", got)
		}
	}
}

// TestPlaceOrderDoubleSubmit: six placements of one cart at once place one order;
// the other five find the cart already emptied.
func TestPlaceOrderDoubleSubmit(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 10)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 2)

	const submits = 6
	start := make(chan struct{})
	var wg sync.WaitGroup
	answers := make([]answer, submits)
	for i := range submits {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			answers[i] = placeAsync(b)
		}()
	}
	close(start)
	wg.Wait()

	created, refused := 0, 0
	for _, r := range answers {
		if r.err != nil {
			t.Fatalf("placement request: %v", r.err)
		}
		switch r.status {
		case http.StatusCreated:
			created++
		case http.StatusBadRequest:
			expectError(t, "losing submit", r.status, r.body, http.StatusBadRequest, "validation", "", "cart is empty")
			refused++
		default:
			t.Fatalf("submit got %d %s, want 201 or 400", r.status, r.body)
		}
	}
	if created != 1 || refused != submits-1 {
		t.Fatalf("%d created and %d refused, want 1 and %d", created, refused, submits-1)
	}
	var orders int
	if err := testPool.QueryRow(context.Background(), "select count(*) from orders where customer_id = $1", b.ID).Scan(&orders); err != nil {
		t.Fatal(err)
	}
	if orders != 1 {
		t.Fatalf("%d orders for the customer, want 1", orders)
	}
	if got := quantityAt(t, s.ID, p); got != 8 {
		t.Fatalf("stock after the submits %d, want 8", got)
	}
}

// TestPlaceOrderStockBeforeMinimum: a stock shortfall is named before the minimum
// order is checked, and a line whose product has no stock row is out of stock.
func TestPlaceOrderStockBeforeMinimum(t *testing.T) {
	ctx := context.Background()
	t.Run("short line below the minimum", func(t *testing.T) {
		s := newShop(t)
		if _, err := testPool.Exec(ctx, "update stores set min_order_cents = 20000 where id = $1", s.ID); err != nil {
			t.Fatal(err)
		}
		p := cartProduct(t, s.ID, stockName(t), 5000)
		stockTo(t, s.ID, p, 5)
		b := newBuyer(t, s.Pincode)
		setLine(t, b.Token, s.ID, p, 2) // subtotal 10000, below the minimum of 20000
		stockTo(t, s.ID, p, 1)          // now short of the 2 in the cart

		status, body := place(t, b)
		expectError(t, "short and below the minimum", status, body, http.StatusConflict, "out_of_stock", "", "some products are out of stock")
		if ids := decodeError(t, body).Error.ProductIDs; !slices.Equal(ids, []string{p}) {
			t.Fatalf("productIds %v, want [%s]", ids, p)
		}
		requireUnchanged(t, b, s.ID, map[string]int32{p: 2}, map[string]int32{p: 1})
	})
	t.Run("line with no stock row", func(t *testing.T) {
		s := newShop(t)
		p := cartProduct(t, s.ID, stockName(t), 5000)
		b := newBuyer(t, s.Pincode)
		setLine(t, b.Token, s.ID, p, 1)
		if _, err := testPool.Exec(ctx, "delete from store_stock where store_id = $1 and product_id = $2", s.ID, p); err != nil {
			t.Fatal(err)
		}

		status, body := place(t, b)
		expectError(t, "no stock row", status, body, http.StatusConflict, "out_of_stock", "", "some products are out of stock")
		if ids := decodeError(t, body).Error.ProductIDs; !slices.Equal(ids, []string{p}) {
			t.Fatalf("productIds %v, want [%s]", ids, p)
		}
		requireUnchanged(t, b, s.ID, map[string]int32{p: 1}, map[string]int32{p: 0})
	})
}

func TestDeleteStoreWithOrder(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 1)
	mustPlace(t, b)
	token := adminToken(t)
	status, body := call(t, http.MethodDelete, adminStoresPath+"/"+s.ID, token, nil)
	expectError(t, "delete a store with an order", status, body, http.StatusConflict, "conflict", "", "")
	if status, body := call(t, http.MethodGet, adminStoresPath+"/"+s.ID, token, nil); status != http.StatusOK {
		t.Fatalf("GET store after the refused delete: got %d %s, want 200", status, body)
	}
}

func TestDeleteOrderedProduct(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 1)
	mustPlace(t, b)
	token := adminToken(t)
	status, body := call(t, http.MethodDelete, productsPath+"/"+p, token, nil)
	expectError(t, "delete an ordered product", status, body, http.StatusConflict, "conflict", "", "product was ordered; set isActive to false instead")
	if status, body := call(t, http.MethodGet, productsPath+"/"+p, token, nil); status != http.StatusOK {
		t.Fatalf("GET product after the refused delete: got %d %s, want 200", status, body)
	}
}

// orderListView is one page of GET /orders.
type orderListView struct {
	Items    []orderView `json:"items"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
	Total    int64       `json:"total"`
}

// readOrder GETs path with token and returns the order; it fails unless the answer is 200.
func readOrder(t *testing.T, path, token string) orderView {
	t.Helper()
	status, body := call(t, http.MethodGet, path, token, nil)
	var o orderView
	if status != http.StatusOK || json.Unmarshal(body, &o) != nil {
		t.Fatalf("GET %s: got %d %s, want 200", path, status, body)
	}
	return o
}

// TestOrdersNewestFirst: the customer's list is newest first, paged, with the items and events of each order.
func TestOrdersNewestFirst(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 10)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 1)
	first := mustPlace(t, b)
	setLine(t, b.Token, s.ID, p, 1)
	second := mustPlace(t, b)
	other := newBuyer(t, s.Pincode)
	setLine(t, other.Token, s.ID, p, 1)
	otherOrder := mustPlace(t, other)

	status, body := call(t, http.MethodGet, ordersPath, b.Token, nil)
	var l orderListView
	if status != http.StatusOK || json.Unmarshal(body, &l) != nil {
		t.Fatalf("GET /orders: got %d %s, want 200", status, body)
	}
	if l.Total != 2 || l.Page != 1 || l.PageSize != 24 || len(l.Items) != 2 {
		t.Fatalf("list %+v, want total 2, page 1, pageSize 24, two items", l)
	}
	if l.Items[0].ID != second.ID || l.Items[1].ID != first.ID {
		t.Fatalf("order ids %s, %s; want the second placement first", l.Items[0].ID, l.Items[1].ID)
	}
	for _, o := range l.Items {
		if len(o.Items) != 1 || len(o.Events) != 1 {
			t.Fatalf("order %s has %d items and %d events, want 1 and 1", o.ID, len(o.Items), len(o.Events))
		}
	}

	status, body = call(t, http.MethodGet, ordersPath+"?pageSize=1&page=2", b.Token, nil)
	l = orderListView{}
	if status != http.StatusOK || json.Unmarshal(body, &l) != nil {
		t.Fatalf("GET /orders page 2: got %d %s, want 200", status, body)
	}
	if l.Total != 2 || len(l.Items) != 1 || l.Items[0].ID != first.ID || len(l.Items[0].Items) != 1 {
		t.Fatalf("page 2 %+v, want total 2 and the first order with one item", l)
	}

	// Each customer's list holds only their own orders.
	status, body = call(t, http.MethodGet, ordersPath, other.Token, nil)
	l = orderListView{}
	if status != http.StatusOK || json.Unmarshal(body, &l) != nil {
		t.Fatalf("GET /orders for the other customer: got %d %s, want 200", status, body)
	}
	if l.Total != 1 || len(l.Items) != 1 || l.Items[0].ID != otherOrder.ID {
		t.Fatalf("other customer's list %+v, want total 1 and only order %s", l, otherOrder.ID)
	}
	status, body = call(t, http.MethodGet, ordersPath, b.Token, nil)
	l = orderListView{}
	if status != http.StatusOK || json.Unmarshal(body, &l) != nil {
		t.Fatalf("GET /orders: got %d %s, want 200", status, body)
	}
	if l.Total != 2 || len(l.Items) != 2 || l.Items[0].ID != second.ID || l.Items[1].ID != first.ID {
		t.Fatalf("first customer's list %+v, want total 2 and exactly orders %s, %s", l, second.ID, first.ID)
	}
}

// TestOrdersPageBeyondEnd: a page past the last one is 200 with an empty items array, and names the page and total.
func TestOrdersPageBeyondEnd(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 1)
	mustPlace(t, b)

	status, body := call(t, http.MethodGet, ordersPath+"?page=3", b.Token, nil)
	if status != http.StatusOK || !strings.Contains(string(body), `"items":[]`) {
		t.Fatalf("GET /orders?page=3: got %d %s, want 200 with \"items\":[]", status, body)
	}
	var l orderListView
	if err := json.Unmarshal(body, &l); err != nil || l.Page != 3 || l.Total != 1 || len(l.Items) != 0 {
		t.Fatalf("GET /orders?page=3: %+v (%v), want page 3, total 1, no items", l, err)
	}
}

// TestOrdersEmptyList: a customer with no orders gets an empty array, not null.
func TestOrdersEmptyList(t *testing.T) {
	b := newBuyer(t, nextPincode())
	status, body := call(t, http.MethodGet, ordersPath, b.Token, nil)
	if status != http.StatusOK || !strings.Contains(string(body), `"items":[]`) {
		t.Fatalf("GET /orders: got %d %s, want 200 with \"items\":[]", status, body)
	}
	var l orderListView
	if err := json.Unmarshal(body, &l); err != nil || l.Total != 0 {
		t.Fatalf("GET /orders: total %d (%v), want 0", l.Total, err)
	}
}

// TestOrdersBadPage: a page size outside 1 to 100 names pageSize.
func TestOrdersBadPage(t *testing.T) {
	b := newBuyer(t, nextPincode())
	status, body := call(t, http.MethodGet, ordersPath+"?pageSize=0", b.Token, nil)
	expectError(t, "pageSize 0", status, body, http.StatusBadRequest, "validation", "pageSize", "must be from 1 to 100")
}

// TestOrderOtherCustomer404: another customer's order, and a malformed id, are 404; the owner reads it.
func TestOrderOtherCustomer404(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	a := newBuyer(t, s.Pincode)
	setLine(t, a.Token, s.ID, p, 1)
	placed := mustPlace(t, a)
	other := newBuyer(t, s.Pincode)

	status, body := call(t, http.MethodGet, ordersPath+"/"+placed.ID, other.Token, nil)
	expectError(t, "another customer's order", status, body, http.StatusNotFound, "not_found", "", "not found")
	status, body = call(t, http.MethodGet, ordersPath+"/abc", a.Token, nil)
	expectError(t, "malformed id", status, body, http.StatusNotFound, "not_found", "", "not found")
	got := readOrder(t, ordersPath+"/"+placed.ID, a.Token)
	if got.ID != placed.ID || got.Number != placed.Number {
		t.Fatalf("owner read %s %s, want %s %s", got.ID, got.Number, placed.ID, placed.Number)
	}
}

// TestOrderSnapshotsSurviveProductChange: the order keeps what it said at placement.
func TestOrderSnapshotsSurviveProductChange(t *testing.T) {
	s := newShop(t)
	name := stockName(t)
	p := cartProduct(t, s.ID, name, 5000)
	stockTo(t, s.ID, p, 5)
	if _, err := testPool.Exec(context.Background(), "update products set image_key = 'products/old.png' where id = $1", p); err != nil {
		t.Fatal(err)
	}
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 1)
	placed := mustPlace(t, b)

	status, body := call(t, http.MethodPatch, productsPath+"/"+p, adminToken(t), map[string]any{"name": "Renamed " + name, "mrpCents": 6000, "priceCents": 6000, "isActive": false})
	var changed productView
	if status != http.StatusOK || json.Unmarshal(body, &changed) != nil || changed.Name != "Renamed "+name || changed.PriceCents != 6000 || changed.MrpCents != 6000 || changed.IsActive {
		t.Fatalf("PATCH product: got %d %s, want 200 renamed, 6000, 6000, inactive", status, body)
	}
	// The image has no PATCH member (it changes by upload), so the test moves the key directly.
	if _, err := testPool.Exec(context.Background(), "update products set image_key = 'products/new.png' where id = $1", p); err != nil {
		t.Fatal(err)
	}
	if status, body := call(t, http.MethodPatch, "/api/core/v1/me", b.Token, map[string]string{"phone": "+919800000002"}); status != http.StatusOK {
		t.Fatalf("change phone: got %d %s, want 200", status, body)
	}
	if status, body := call(t, http.MethodDelete, addressesPath+"/"+b.AddressID, b.Token, nil); status != http.StatusNoContent {
		t.Fatalf("delete address: got %d %s, want 204", status, body)
	}

	// checkItem fails unless the order's one item is the placement-time snapshot.
	checkItem := func(where string, o orderView) {
		t.Helper()
		if len(o.Items) != 1 {
			t.Fatalf("%s: items %+v, want one", where, o.Items)
		}
		if it := o.Items[0]; it.PriceCents != 5000 || it.MrpCents != 5000 || it.Name != name || it.ImageURL != "/api/core/v1/files/products/old.png" {
			t.Fatalf("%s: item %+v, want 5000, 5000, the name %q and the image products/old.png", where, it, name)
		}
	}

	got := readOrder(t, ordersPath+"/"+placed.ID, b.Token)
	checkItem("GET /orders/{id}", got)
	status, body = call(t, http.MethodGet, ordersPath, b.Token, nil)
	var l orderListView
	if status != http.StatusOK || json.Unmarshal(body, &l) != nil || len(l.Items) != 1 {
		t.Fatalf("GET /orders: got %d %s, want 200 with one order", status, body)
	}
	checkItem("GET /orders first item", l.Items[0])
	if got.CustomerPhone != "+919800000001" {
		t.Fatalf("customer phone %s, want +919800000001", got.CustomerPhone)
	}
	if got.Address.Label != "Home" || got.Address.Line1 != "12 Test Rd" || got.Address.Pincode != s.Pincode {
		t.Fatalf("address %+v, want Home, 12 Test Rd, %s", got.Address, s.Pincode)
	}
}

// TestOrdersStaffToken401: a staff token is not a customer's; both order reads refuse it.
func TestOrdersStaffToken401(t *testing.T) {
	token := adminToken(t)
	status, body := call(t, http.MethodGet, ordersPath, token, nil)
	expectError(t, "staff on the list", status, body, http.StatusUnauthorized, "unauthorized", "", "")
	status, body = call(t, http.MethodGet, ordersPath+"/"+missingOrderID, token, nil)
	expectError(t, "staff on one order", status, body, http.StatusUnauthorized, "unauthorized", "", "")
}
