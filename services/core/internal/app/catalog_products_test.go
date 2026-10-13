package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

const productsPath = "/api/core/v1/admin/products"

// missingProductID is a canonical uuid no product has.
const missingProductID = "00000000-0000-4000-8000-0000000006ff"

// productView is a product as the admin routes show it.
type productView struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Brand       string `json:"brand"`
	UnitLabel   string `json:"unitLabel"`
	MrpCents    int64  `json:"mrpCents"`
	PriceCents  int64  `json:"priceCents"`
	CategoryID  string `json:"categoryId"`
	IsActive    bool   `json:"isActive"`
	ImageURL    string `json:"imageUrl"`
}

type productListView struct {
	Items    []productView `json:"items"`
	Page     int           `json:"page"`
	PageSize int           `json:"pageSize"`
	Total    int64         `json:"total"`
}

// productBody is a valid create body in category, named name: ₹55 against an MRP of ₹60.
func productBody(category, name string) map[string]any {
	return map[string]any{"name": name, "categoryId": category, "unitLabel": "1 L", "mrpCents": 6000, "priceCents": 5500}
}

// createProduct posts body as the admin and returns the 201 product.
func createProduct(t *testing.T, token string, body map[string]any) productView {
	t.Helper()
	status, resp := call(t, http.MethodPost, productsPath, token, body)
	if status != http.StatusCreated {
		t.Fatalf("create %v: got %d %s, want 201", body, status, resp)
	}
	var p productView
	if err := json.Unmarshal(resp, &p); err != nil {
		t.Fatal(err)
	}
	return p
}

// getProduct reads GET /admin/products/{id} and returns the raw body.
func getProduct(t *testing.T, token, id string) (int, []byte) {
	t.Helper()
	return call(t, http.MethodGet, productsPath+"/"+id, token, nil)
}

// listProducts reads GET /admin/products with query and returns the 200 list.
func listProducts(t *testing.T, token, query string) productListView {
	t.Helper()
	status, body := call(t, http.MethodGet, productsPath+"?"+query, token, nil)
	var list productListView
	if status != http.StatusOK || json.Unmarshal(body, &list) != nil {
		t.Fatalf("GET products?%s: got %d %s, want 200", query, status, body)
	}
	return list
}

func TestCreateProduct(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Create Product Category"})
	status, created := call(t, http.MethodPost, productsPath, token, productBody(cat.ID, "Create Toned Milk"))
	if status != http.StatusCreated {
		t.Fatalf("create: got %d %s, want 201", status, created)
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(created, &raw); err != nil {
		t.Fatal(err)
	}
	var p productView
	if err := json.Unmarshal(created, &p); err != nil {
		t.Fatal(err)
	}
	if !p.IsActive || p.Slug != "create-toned-milk" || p.CategoryID != cat.ID {
		t.Fatalf("created: got %+v, want active, slug create-toned-milk, categoryId %s", p, cat.ID)
	}
	if _, ok := raw["imageUrl"]; ok {
		t.Fatalf("product without an image has imageUrl: %s", created)
	}
	status, read := getProduct(t, token, p.ID)
	if status != http.StatusOK || !bytes.Equal(read, created) {
		t.Fatalf("GET: got %d %s, want 200 with the body of the create", status, read)
	}
}

func TestCreateProductUnknownCategory(t *testing.T) {
	token := adminToken(t)
	for _, categoryID := range []string{missingCategoryID, "not-a-uuid", ""} {
		status, body := call(t, http.MethodPost, productsPath, token, productBody(categoryID, "Orphan Product"))
		expectError(t, "category "+categoryID, status, body, http.StatusBadRequest, "validation", "categoryId", "unknown category")
	}
}

func TestGetUnknownProduct(t *testing.T) {
	token := adminToken(t)
	for _, id := range []string{missingProductID, "not-a-uuid"} {
		status, body := getProduct(t, token, id)
		expectError(t, "get "+id, status, body, http.StatusNotFound, "not_found", "", "")
	}
}

func TestProductPriceAboveMrp(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Price Above Category"})
	body := productBody(cat.ID, "Price Above Mrp")
	body["priceCents"] = 6100
	status, resp := call(t, http.MethodPost, productsPath, token, body)
	expectError(t, "price above mrp", status, resp, http.StatusBadRequest, "validation", "priceCents", "must be between 1 and mrpCents")
}

func TestProductZeroPrice(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Zero Price Category"})
	body := productBody(cat.ID, "Zero Price")
	body["priceCents"] = 0
	status, resp := call(t, http.MethodPost, productsPath, token, body)
	expectError(t, "zero price", status, resp, http.StatusBadRequest, "validation", "priceCents", "must be between 1 and mrpCents")
}

func TestPatchMrpBelowPrice(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Mrp Below Category"})
	p := createProduct(t, token, productBody(cat.ID, "Mrp Below Price"))
	status, body := call(t, http.MethodPatch, productsPath+"/"+p.ID, token, map[string]any{"mrpCents": 5000})
	expectError(t, "mrp below price", status, body, http.StatusBadRequest, "validation", "priceCents", "must be between 1 and mrpCents")
	status, body = getProduct(t, token, p.ID)
	var got productView
	if status != http.StatusOK || json.Unmarshal(body, &got) != nil || got.MrpCents != 6000 || got.PriceCents != 5500 {
		t.Fatalf("after refused patch: got %d %s, want the product unchanged at mrp 6000 and price 5500", status, body)
	}
}

func TestProductSlugClash(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Slug Clash Category"})
	first := createProduct(t, token, productBody(cat.ID, "Product Slug Clash Toned Milk"))
	second := createProduct(t, token, productBody(cat.ID, "Product Slug Clash Toned Milk"))
	if first.Slug != "product-slug-clash-toned-milk" || !strings.HasPrefix(second.Slug, first.Slug+"-") || len(second.Slug) != len(first.Slug)+len("-")+6 {
		t.Fatalf("slugs %q and %q: want the first slug and the first with a -<6 hex> suffix", first.Slug, second.Slug)
	}
}

func TestProductRenameKeepsSlug(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Rename Product Category"})
	p := createProduct(t, token, productBody(cat.ID, "Rename Product Milk"))
	status, body := call(t, http.MethodPatch, productsPath+"/"+p.ID, token, map[string]any{"name": "Rename Product Fresh Milk"})
	var got productView
	if status != http.StatusOK || json.Unmarshal(body, &got) != nil {
		t.Fatalf("rename: got %d %s, want 200", status, body)
	}
	if got.Name != "Rename Product Fresh Milk" || got.Slug != p.Slug {
		t.Fatalf("rename: got name %q slug %q, want the new name and slug %q", got.Name, got.Slug, p.Slug)
	}
}

func TestDeactivateProduct(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Deactivate Category"})
	p := createProduct(t, token, productBody(cat.ID, "Deactivate Me"))
	status, body := call(t, http.MethodPatch, productsPath+"/"+p.ID, token, map[string]any{"isActive": false})
	var got productView
	if status != http.StatusOK || json.Unmarshal(body, &got) != nil {
		t.Fatalf("deactivate: got %d %s, want 200", status, body)
	}
	want := p
	want.IsActive = false
	if got != want {
		t.Fatalf("deactivate: got %+v, want %+v", got, want)
	}
}

func TestProductEmptyDescriptionClears(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Clear Description Category"})
	body := productBody(cat.ID, "Clear Description")
	body["description"] = "Has a description"
	p := createProduct(t, token, body)
	status, resp := call(t, http.MethodPatch, productsPath+"/"+p.ID, token, map[string]any{"description": ""})
	var raw map[string]json.RawMessage
	if status != http.StatusOK || json.Unmarshal(resp, &raw) != nil {
		t.Fatalf("clear: got %d %s, want 200", status, resp)
	}
	if _, ok := raw["description"]; ok {
		t.Fatalf("cleared description is still in the response: %s", resp)
	}
}

func TestListProductsSearch(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Search Products Category"})
	milk := createProduct(t, token, withBrand(productBody(cat.ID, "Search Daily Milk"), "Daily Farm"))
	createProduct(t, token, withBrand(productBody(cat.ID, "Search Paneer"), "Other Farm"))
	createProduct(t, token, productBody(cat.ID, "Search Curd"))

	list := listProducts(t, token, "categoryId="+cat.ID+"&q="+url.QueryEscape("daily farm"))
	if list.Total != 1 || len(list.Items) != 1 || list.Items[0].ID != milk.ID {
		t.Fatalf("brand search: got %+v, want only Search Daily Milk", list)
	}
	// q matches name or brand, and total counts every match past the page.
	list = listProducts(t, token, "categoryId="+cat.ID+"&q=search&pageSize=1")
	if list.Total != 3 || len(list.Items) != 1 || list.PageSize != 1 {
		t.Fatalf("paged search: got total %d with %d items, want 3 and 1", list.Total, len(list.Items))
	}
}

func TestListProductsCategoryIncludesChildren(t *testing.T) {
	token := adminToken(t)
	parent := createCategory(t, token, map[string]any{"name": "Kids Parent Category"})
	child := createCategory(t, token, map[string]any{"name": "Kids Child Category", "parentId": parent.ID})
	other := createCategory(t, token, map[string]any{"name": "Kids Other Category"})
	own := createProduct(t, token, productBody(parent.ID, "Kids Parent Item"))
	inChild := createProduct(t, token, productBody(child.ID, "Kids Child Item"))
	createProduct(t, token, productBody(other.ID, "Kids Other Item"))

	list := listProducts(t, token, "categoryId="+parent.ID)
	if list.Total != 2 || len(list.Items) != 2 {
		t.Fatalf("parent filter: got %+v, want the parent's own product and its child's", list)
	}
	ids := map[string]bool{list.Items[0].ID: true, list.Items[1].ID: true}
	if !ids[own.ID] || !ids[inChild.ID] {
		t.Fatalf("parent filter: got %+v, want %s and %s", list.Items, own.ID, inChild.ID)
	}
}

func TestListProductsInactiveOnly(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Inactive Filter Category"})
	active := createProduct(t, token, productBody(cat.ID, "Inactive Filter Active"))
	gone := createProduct(t, token, productBody(cat.ID, "Inactive Filter Gone"))
	if status, body := call(t, http.MethodPatch, productsPath+"/"+gone.ID, token, map[string]any{"isActive": false}); status != http.StatusOK {
		t.Fatalf("deactivate: got %d %s, want 200", status, body)
	}

	list := listProducts(t, token, "categoryId="+cat.ID+"&isActive=false")
	if list.Total != 1 || len(list.Items) != 1 || list.Items[0].ID != gone.ID || list.Items[0].IsActive {
		t.Fatalf("isActive=false: got %+v, want only the deactivated product", list)
	}
	list = listProducts(t, token, "categoryId="+cat.ID+"&isActive=true")
	if list.Total != 1 || list.Items[0].ID != active.ID {
		t.Fatalf("isActive=true: got %+v, want only the active product", list)
	}
}

func TestListProductsLiteralWildcards(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Wildcard Filter Category"})
	createProduct(t, token, productBody(cat.ID, "Wild Oats"))
	percent := createProduct(t, token, productBody(cat.ID, "Wild % Oats"))
	underscore := createProduct(t, token, productBody(cat.ID, "Wild_Rice"))

	list := listProducts(t, token, "categoryId="+cat.ID+"&q="+url.QueryEscape("%"))
	if list.Total != 1 || list.Items[0].ID != percent.ID {
		t.Fatalf("q=%%: got %+v, want only Wild %% Oats", list)
	}
	list = listProducts(t, token, "categoryId="+cat.ID+"&q="+url.QueryEscape("_"))
	if list.Total != 1 || list.Items[0].ID != underscore.ID {
		t.Fatalf("q=_: got %+v, want only Wild_Rice", list)
	}
}

func TestListProductsBadFilters(t *testing.T) {
	token := adminToken(t)
	cases := []struct{ query, field string }{
		{"isActive=yes", "isActive"},
		{"categoryId=abc", "categoryId"},
		{"q=" + url.QueryEscape(strings.Repeat("é", 101)), "q"},
	}
	for _, c := range cases {
		status, body := call(t, http.MethodGet, productsPath+"?"+c.query, token, nil)
		expectError(t, c.query, status, body, http.StatusBadRequest, "validation", c.field, "")
	}
}

// TestCreateProductFieldBounds posts one bad member at a time and expects 400
// naming that member.
func TestCreateProductFieldBounds(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Product Bounds Category"})
	cases := []struct {
		field string
		value any
	}{
		{"name", ""},
		{"name", strings.Repeat("n", 101)},
		{"brand", strings.Repeat("b", 61)},
		{"unitLabel", ""},
		{"unitLabel", strings.Repeat("u", 31)},
		{"description", strings.Repeat("d", 2001)},
		{"mrpCents", 0},
		{"mrpCents", 100_000_001},
	}
	for i, c := range cases {
		body := productBody(cat.ID, "Bounds Product")
		body[c.field] = c.value
		status, resp := call(t, http.MethodPost, productsPath, token, body)
		expectError(t, fmt.Sprintf("case %d %s", i, c.field), status, resp, http.StatusBadRequest, "validation", c.field, "")
	}
}

func TestDeleteNeverOrderedProduct(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Delete Product Category"})
	p := createProduct(t, token, productBody(cat.ID, "Delete Never Ordered"))
	if status, body := call(t, http.MethodDelete, productsPath+"/"+p.ID, token, nil); status != http.StatusNoContent {
		t.Fatalf("delete: got %d %s, want 204", status, body)
	}
	status, body := getProduct(t, token, p.ID)
	expectError(t, "read after delete", status, body, http.StatusNotFound, "not_found", "", "")
}

func TestDeleteOrderedProductRefused(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Ordered Product Category"})
	p := createProduct(t, token, productBody(cat.ID, "Delete Ordered Item"))
	// Until core-P2-L5 adds order_items, a probe table with the same foreign key
	// (on delete restrict) stands in for an order line.
	ctx := context.Background()
	if _, err := testPool.Exec(ctx, "create table if not exists order_items_probe (product_id uuid not null references products (id) on delete restrict)"); err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, "insert into order_items_probe (product_id) values ($1)", p.ID); err != nil {
		t.Fatal(err)
	}
	status, body := call(t, http.MethodDelete, productsPath+"/"+p.ID, token, nil)
	expectError(t, "delete ordered", status, body, http.StatusConflict, "conflict", "", "product was ordered; set isActive to false instead")
	if status, body := getProduct(t, token, p.ID); status != http.StatusOK {
		t.Fatalf("after refused delete: got %d %s, want the product kept", status, body)
	}
}

// withBrand sets the brand of a create body.
func withBrand(body map[string]any, brand string) map[string]any {
	body["brand"] = brand
	return body
}

// TestListProductsNULInQ: a NUL byte in q is a validation error, not a 500 from Postgres.
func TestListProductsNULInQ(t *testing.T) {
	status, body := call(t, http.MethodGet, productsPath+"?q=a%00b", adminToken(t), nil)
	expectError(t, "q=a%00b", status, body, http.StatusBadRequest, "validation", "q", "")
}
