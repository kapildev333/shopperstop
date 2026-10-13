package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
)

// missingStoreID names no store and no product in any test.
const missingStoreID = "00000000-0000-4000-8000-0000000007ff"

// stockSeq numbers the names and slugs the stock tests insert.
var stockSeq atomic.Int64

// stockStaffOnce creates the store-staff user of testStoreID, once per package.
var stockStaffOnce sync.Once

// stockStaffEmail is the store-staff user of testStoreID that the stock tests sign in.
const stockStaffEmail = "stock.staff@example.com"

// stockName is a name no other test uses: the test's name in lower case, numbered.
func stockName(t *testing.T) string {
	return fmt.Sprintf("%s%d", strings.ToLower(t.Name()), stockSeq.Add(1))
}

// insertProduct inserts a product named name, active or not, in its own
// category, and returns its id. The slug is numbered, so names may repeat.
func insertProduct(t *testing.T, name string, active bool) string {
	t.Helper()
	ctx := context.Background()
	n := stockSeq.Add(1)
	slug := fmt.Sprintf("%s-%d", strings.ReplaceAll(strings.ToLower(name), " ", "-"), n)
	var category string
	if err := testPool.QueryRow(ctx, "insert into categories (name, slug) values ($1, $2) returning id",
		fmt.Sprintf("Cat %d", n), fmt.Sprintf("cat-%d", n)).Scan(&category); err != nil {
		t.Fatal(err)
	}
	var id string
	if err := testPool.QueryRow(ctx, `insert into products (category_id, name, slug, unit_label, mrp_cents, price_cents, is_active)
		values ($1, $2, $3, '1 unit', 1000, 1000, $4) returning id`, category, name, slug, active).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

// storeStaffToken signs in the store-staff user of testStoreID, created with auth.CreateStaff once per package.
func storeStaffToken(t *testing.T) string {
	t.Helper()
	stockStaffOnce.Do(func() {
		if _, err := auth.CreateStaff(context.Background(), testPool, auth.NewStaff{
			Email: stockStaffEmail, Password: testPassword, Name: "Stock Staff", Role: "store_staff", StoreID: testStoreID,
		}); err != nil {
			panic(err)
		}
	})
	return staffSignIn(t, stockStaffEmail)
}

// stockRow and stockListView are the stock list as the admin page reads it.
type stockRow struct {
	ProductID  string `json:"productId"`
	Name       string `json:"name"`
	Brand      string `json:"brand"`
	UnitLabel  string `json:"unitLabel"`
	PriceCents int64  `json:"priceCents"`
	Quantity   int32  `json:"quantity"`
}

type stockListView struct {
	Items    []stockRow `json:"items"`
	Page     int        `json:"page"`
	PageSize int        `json:"pageSize"`
	Total    int64      `json:"total"`
}

func stockPath(storeID string) string {
	return "/api/core/v1/admin/stores/" + storeID + "/stock"
}

// stockList reads the stock of storeID with query and returns the 200 list.
func stockList(t *testing.T, token, storeID string, query url.Values) stockListView {
	t.Helper()
	status, body := call(t, http.MethodGet, stockPath(storeID)+"?"+query.Encode(), token, nil)
	var list stockListView
	if status != http.StatusOK || json.Unmarshal(body, &list) != nil {
		t.Fatalf("GET stock %v: got %d %s, want 200", query, status, body)
	}
	return list
}

// stockByProduct maps a stock list by product id.
func stockByProduct(list stockListView) map[string]stockRow {
	out := make(map[string]stockRow, len(list.Items))
	for _, r := range list.Items {
		out[r.ProductID] = r
	}
	return out
}

// quantityAt reads the stored quantity of a product at a store with plain SQL; no row is 0.
func quantityAt(t *testing.T, storeID, productID string) int32 {
	t.Helper()
	var q int32
	if err := testPool.QueryRow(context.Background(),
		"select coalesce((select quantity from store_stock where store_id = $1 and product_id = $2), 0)",
		storeID, productID).Scan(&q); err != nil {
		t.Fatal(err)
	}
	return q
}

// stockRows builds n rows of quantity 1 for made-up, distinct product ids.
func stockRows(n int) []map[string]any {
	rows := make([]map[string]any, 0, n)
	for i := 1; i <= n; i++ {
		rows = append(rows, map[string]any{"productId": fmt.Sprintf("00000000-0000-4000-8000-%012x", i), "quantity": 1})
	}
	return rows
}

func TestStockListNoRowIsZero(t *testing.T) {
	name := stockName(t)
	p := insertProduct(t, name, true)
	list := stockList(t, adminToken(t), testStoreID, url.Values{"q": {name}})
	row, ok := stockByProduct(list)[p]
	if !ok || row.Quantity != 0 || row.Name != name {
		t.Fatalf("product with no stock row: %+v listed %v, want listed with quantity 0", row, ok)
	}
}

// TestStockListOwnStoreFilters: other tests in this package add milk products
// that have no stock here, and those are low too, so the test checks its own three.
func TestStockListOwnStoreFilters(t *testing.T) {
	amul := insertProduct(t, "Amul Milk", true)
	bread := insertProduct(t, "Milk Bread", true)
	curd := insertProduct(t, "Curd", true)
	setStock(t, testStoreID, amul, 3)
	setStock(t, testStoreID, bread, 40)
	setStock(t, testStoreID, curd, 0)
	list := stockList(t, storeStaffToken(t), testStoreID, url.Values{"lowStock": {"true"}, "q": {"milk"}, "pageSize": {"100"}})
	rows := stockByProduct(list)
	if got, ok := rows[amul]; !ok || got.Name != "Amul Milk" || got.Quantity != 3 {
		t.Fatalf("Amul Milk: %+v listed %v, want listed with quantity 3", got, ok)
	}
	if _, ok := rows[bread]; ok {
		t.Fatal("Milk Bread (quantity 40) listed as low stock")
	}
	if _, ok := rows[curd]; ok {
		t.Fatal("Curd listed for q=milk")
	}
}

func TestStockListHidesInactive(t *testing.T) {
	name := stockName(t)
	p := insertProduct(t, name, false)
	setStock(t, testStoreID, p, 4)
	list := stockList(t, adminToken(t), testStoreID, url.Values{"q": {name}})
	if _, ok := stockByProduct(list)[p]; ok {
		t.Fatal("inactive product listed in the stock list")
	}
}

// TestStockListSearchEscapes: % in q matches a literal %, not any run of characters.
func TestStockListSearchEscapes(t *testing.T) {
	name := stockName(t)
	percent := insertProduct(t, name+" 50% off", true)
	plain := insertProduct(t, name+" 500 off", true)
	list := stockList(t, adminToken(t), testStoreID, url.Values{"q": {name + " 50%"}})
	rows := stockByProduct(list)
	if _, ok := rows[percent]; !ok {
		t.Fatal("product with a literal 50% not listed for q ending in 50%")
	}
	if _, ok := rows[plain]; ok {
		t.Fatal("% in q matched a product without a literal %")
	}
}

func TestStockListBadLowStock(t *testing.T) {
	status, body := call(t, http.MethodGet, stockPath(testStoreID)+"?lowStock=yes", adminToken(t), nil)
	e := decodeError(t, body)
	if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "lowStock" {
		t.Fatalf("lowStock=yes: got %d %s, want 400 validation field lowStock", status, body)
	}
}

func TestStockOtherStoreStaff404(t *testing.T) {
	other := insertStore(t, true)
	p := insertProduct(t, stockName(t), true)
	setStock(t, other, p, 5)
	token := storeStaffToken(t)
	status, body := call(t, http.MethodGet, stockPath(other), token, nil)
	if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
		t.Fatalf("GET another store's stock by store staff: got %d %s, want 404 not_found", status, body)
	}
	status, body = call(t, http.MethodPut, stockPath(other), token, map[string]any{"rows": []map[string]any{{"productId": p, "quantity": 9}}})
	if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
		t.Fatalf("PUT another store's stock by store staff: got %d %s, want 404 not_found", status, body)
	}
	if got := quantityAt(t, other, p); got != 5 {
		t.Fatalf("other store's quantity after refused PUT: %d, want 5", got)
	}
}

func TestStockUnknownStore404(t *testing.T) {
	token := adminToken(t)
	p := insertProduct(t, stockName(t), true)
	status, body := call(t, http.MethodGet, stockPath(missingStoreID), token, nil)
	if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
		t.Fatalf("GET unknown store: got %d %s, want 404 not_found", status, body)
	}
	status, body = call(t, http.MethodPut, stockPath(missingStoreID), token, map[string]any{"rows": []map[string]any{{"productId": p, "quantity": 9}}})
	if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
		t.Fatalf("PUT unknown store: got %d %s, want 404 not_found", status, body)
	}
}

func TestStockCustomerToken401(t *testing.T) {
	token := newCustomer(t).Token
	status, body := call(t, http.MethodGet, stockPath(testStoreID), token, nil)
	if e := decodeError(t, body); status != http.StatusUnauthorized || e.Error.Code != "unauthorized" {
		t.Fatalf("GET with a customer token: got %d %s, want 401 unauthorized", status, body)
	}
	status, body = call(t, http.MethodPut, stockPath(testStoreID), token, map[string]any{"rows": []any{}})
	if e := decodeError(t, body); status != http.StatusUnauthorized || e.Error.Code != "unauthorized" {
		t.Fatalf("PUT with a customer token: got %d %s, want 401 unauthorized", status, body)
	}
}

// TestStockPutUpserts: a product with no row gets one, an existing row is set,
// and the other store is untouched.
func TestStockPutUpserts(t *testing.T) {
	name := stockName(t)
	p := insertProduct(t, name+" p", true)
	q := insertProduct(t, name+" q", true)
	other := insertStore(t, true)
	setStock(t, testStoreID, q, 7)
	status, body := call(t, http.MethodPut, stockPath(testStoreID), adminToken(t), map[string]any{"rows": []map[string]any{
		{"productId": p, "quantity": 12},
		{"productId": q, "quantity": 0},
	}})
	if status != http.StatusNoContent {
		t.Fatalf("PUT: got %d %s, want 204", status, body)
	}
	rows := stockByProduct(stockList(t, adminToken(t), testStoreID, url.Values{"q": {name}}))
	if rows[p].Quantity != 12 || rows[q].Quantity != 0 {
		t.Fatalf("after PUT: p %d q %d, want 12 and 0", rows[p].Quantity, rows[q].Quantity)
	}
	if got := quantityAt(t, other, p); got != 0 {
		t.Fatalf("other store's quantity for p: %d, want 0 (stock is per store)", got)
	}
}

// TestStockPutNegative: a quantity below 0 or above 100000 refuses the whole request.
func TestStockPutNegative(t *testing.T) {
	p := insertProduct(t, stockName(t), true)
	setStock(t, testStoreID, p, 7)
	for _, q := range []int{-1, 100001} {
		status, body := call(t, http.MethodPut, stockPath(testStoreID), adminToken(t), map[string]any{"rows": []map[string]any{{"productId": p, "quantity": q}}})
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "quantity" {
			t.Fatalf("quantity %d: got %d %s, want 400 validation field quantity", q, status, body)
		}
		if got := quantityAt(t, testStoreID, p); got != 7 {
			t.Fatalf("quantity %d: stored %d, want 7 unchanged", q, got)
		}
	}
}

func TestStockPutRowCount(t *testing.T) {
	token := adminToken(t)
	for name, rows := range map[string][]map[string]any{"no rows": {}, "501 rows": stockRows(501)} {
		status, body := call(t, http.MethodPut, stockPath(testStoreID), token, map[string]any{"rows": rows})
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "rows" {
			t.Fatalf("%s: got %d %s, want 400 validation field rows", name, status, body)
		}
	}
}

// TestStockPutDuplicateOrUnknown: a product listed twice, or one that does not
// exist, refuses the whole request and changes nothing.
func TestStockPutDuplicateOrUnknown(t *testing.T) {
	p := insertProduct(t, stockName(t), true)
	setStock(t, testStoreID, p, 4)
	token := adminToken(t)
	cases := map[string][]map[string]any{
		"listed twice": {{"productId": p, "quantity": 1}, {"productId": p, "quantity": 2}},
		"unknown":      {{"productId": p, "quantity": 1}, {"productId": missingProductID, "quantity": 1}},
	}
	for name, rows := range cases {
		status, body := call(t, http.MethodPut, stockPath(testStoreID), token, map[string]any{"rows": rows})
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "rows" {
			t.Fatalf("%s: got %d %s, want 400 validation field rows", name, status, body)
		}
		if got := quantityAt(t, testStoreID, p); got != 4 {
			t.Fatalf("%s: stored %d, want 4 unchanged", name, got)
		}
	}
}

func TestStockPutBadProductID(t *testing.T) {
	status, body := call(t, http.MethodPut, stockPath(testStoreID), adminToken(t), map[string]any{"rows": []map[string]any{{"productId": "abc", "quantity": 1}}})
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "productId" {
		t.Fatalf("productId abc: got %d %s, want 400 validation field productId", status, body)
	}
}

// TestStockListNULInQ: a NUL byte in q is a validation error, not a 500 from Postgres.
func TestStockListNULInQ(t *testing.T) {
	status, body := call(t, http.MethodGet, stockPath(testStoreID)+"?q=a%00b", adminToken(t), nil)
	expectError(t, "q=a%00b", status, body, http.StatusBadRequest, "validation", "q", "")
}
