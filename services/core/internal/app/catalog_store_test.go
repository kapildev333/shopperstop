package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"testing"
)

// storeProductView is a product as a store shows it (catalog.StoreProduct).
type storeProductView struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Slug       string `json:"slug"`
	PriceCents int64  `json:"priceCents"`
	CategoryID string `json:"categoryId"`
	InStock    bool   `json:"inStock"`
	Quantity   int32  `json:"quantity"`
}

type storeProductListView struct {
	Items    []storeProductView `json:"items"`
	Page     int                `json:"page"`
	PageSize int                `json:"pageSize"`
	Total    int64              `json:"total"`
}

// setStock writes a stock row for product at store with plain SQL.
func setStock(t *testing.T, storeID, productID string, quantity int) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(),
		"insert into store_stock (store_id, product_id, quantity) values ($1, $2, $3)", storeID, productID, quantity); err != nil {
		t.Fatal(err)
	}
}

// storeProducts reads GET /stores/{store}/products with query and returns the 200 list.
func storeProducts(t *testing.T, storeID string, query url.Values) storeProductListView {
	t.Helper()
	status, body := call(t, http.MethodGet, "/api/core/v1/stores/"+storeID+"/products?"+query.Encode(), "", nil)
	var list storeProductListView
	if status != http.StatusOK || json.Unmarshal(body, &list) != nil {
		t.Fatalf("GET store products %v: got %d %s, want 200", query, status, body)
	}
	return list
}

// byName maps a store product list by product name.
func byName(list storeProductListView) map[string]storeProductView {
	out := map[string]storeProductView{}
	for _, p := range list.Items {
		out[p.Name] = p
	}
	return out
}

func TestStoreProductsCarryStock(t *testing.T) {
	token := adminToken(t)
	storeID := insertStore(t, true)
	cat := createCategory(t, token, map[string]any{"name": "Stockcarry Dairy"})
	plenty := createProduct(t, token, productBody(cat.ID, "Stockcarry plenty"))
	few := createProduct(t, token, productBody(cat.ID, "Stockcarry few"))
	createProduct(t, token, productBody(cat.ID, "Stockcarry none"))
	setStock(t, storeID, plenty.ID, 37)
	setStock(t, storeID, few.ID, 3)

	got := byName(storeProducts(t, storeID, url.Values{"q": {"Stockcarry"}}))
	if len(got) != 3 {
		t.Fatalf("listed %d products, want 3: %v", len(got), got)
	}
	if p := got["Stockcarry plenty"]; !p.InStock || p.Quantity != 10 {
		t.Errorf("plenty: got inStock %v quantity %d, want true 10", p.InStock, p.Quantity)
	}
	if p := got["Stockcarry few"]; !p.InStock || p.Quantity != 3 {
		t.Errorf("few: got inStock %v quantity %d, want true 3", p.InStock, p.Quantity)
	}
	if p := got["Stockcarry none"]; p.InStock || p.Quantity != 0 {
		t.Errorf("none: got inStock %v quantity %d, want false 0", p.InStock, p.Quantity)
	}
}

func TestStoreProductsFilter(t *testing.T) {
	token := adminToken(t)
	storeID := insertStore(t, true)
	parent := createCategory(t, token, map[string]any{"name": "Filter Dairy"})
	child := createCategory(t, token, map[string]any{"name": "Filter Curd Family", "parentId": parent.ID})
	other := createCategory(t, token, map[string]any{"name": "Filter Bakery"})
	inParent := createProduct(t, token, productBody(parent.ID, "Zfilt curd parent"))
	inChild := createProduct(t, token, productBody(child.ID, "Zfilt curd child"))
	milk := createProduct(t, token, productBody(parent.ID, "Zfilt milk parent"))
	elsewhere := createProduct(t, token, productBody(other.ID, "Zfilt curd elsewhere"))
	for _, p := range []string{inParent.ID, inChild.ID, milk.ID, elsewhere.ID} {
		setStock(t, storeID, p, 5)
	}

	list := storeProducts(t, storeID, url.Values{"q": {"Zfilt curd"}, "categoryId": {parent.ID}})
	got := byName(list)
	if len(list.Items) != 2 || got["Zfilt curd parent"].ID == "" || got["Zfilt curd child"].ID == "" {
		t.Fatalf("categoryId and q: got %v, want the parent's curd and the child's curd only", list.Items)
	}
}

func TestStoreProductsHideInactive(t *testing.T) {
	token := adminToken(t)
	storeID := insertStore(t, true)
	cat := createCategory(t, token, map[string]any{"name": "Hide Inactive Dairy"})
	active := createProduct(t, token, productBody(cat.ID, "Zhide active"))
	inactiveBody := productBody(cat.ID, "Zhide inactive")
	inactiveBody["isActive"] = false
	inactive := createProduct(t, token, inactiveBody)
	setStock(t, storeID, active.ID, 2)
	setStock(t, storeID, inactive.ID, 9)

	list := storeProducts(t, storeID, url.Values{"q": {"Zhide"}})
	if list.Total != 1 || len(list.Items) != 1 || list.Items[0].Name != "Zhide active" {
		t.Fatalf("got %+v, want only the active product", list)
	}
}

func TestStoreProductsPaging(t *testing.T) {
	token := adminToken(t)
	storeID := insertStore(t, true)
	cat := createCategory(t, token, map[string]any{"name": "Paging Dairy"})
	for _, n := range []string{"a", "b", "c"} {
		p := createProduct(t, token, productBody(cat.ID, "Zpage "+n))
		setStock(t, storeID, p.ID, 1)
	}

	first := storeProducts(t, storeID, url.Values{"q": {"Zpage"}, "pageSize": {"2"}})
	last := storeProducts(t, storeID, url.Values{"q": {"Zpage"}, "pageSize": {"2"}, "page": {"2"}})
	if first.Total != 3 || len(first.Items) != 2 || first.Page != 1 || first.PageSize != 2 {
		t.Fatalf("page 1: got %+v, want total 3 and 2 items", first)
	}
	if len(last.Items) != 1 || last.Items[0].Name != "Zpage c" || last.Page != 2 {
		t.Fatalf("page 2: got %+v, want the third product by name", last)
	}
}

func TestStoreProductsBadParams(t *testing.T) {
	storeID := insertStore(t, true)
	long := make([]byte, 101)
	for i := range long {
		long[i] = 'x'
	}
	for _, c := range []struct{ query, field string }{
		{"q=" + string(long), "q"},
		{"categoryId=not-a-uuid", "categoryId"},
	} {
		status, body := call(t, http.MethodGet, "/api/core/v1/stores/"+storeID+"/products?"+c.query, "", nil)
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Field != c.field {
			t.Errorf("%s: got %d %s, want 400 field %s", c.field, status, body, c.field)
		}
	}
}

func TestStoreProductsUnknownStore(t *testing.T) {
	status, body := call(t, http.MethodGet, "/api/core/v1/stores/"+missingProductID+"/products", "", nil)
	if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
		t.Fatalf("got %d %s, want 404 not_found", status, body)
	}
}

func TestStoreProductBySlug(t *testing.T) {
	token := adminToken(t)
	storeID := insertStore(t, true)
	cat := createCategory(t, token, map[string]any{"name": "Slug Dairy"})
	p := createProduct(t, token, productBody(cat.ID, "Zslug three"))
	setStock(t, storeID, p.ID, 3)

	status, body := call(t, http.MethodGet, "/api/core/v1/stores/"+storeID+"/products/"+p.Slug, "", nil)
	if status != http.StatusOK {
		t.Fatalf("got %d %s, want 200", status, body)
	}
	var got storeProductView
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != p.ID || !got.InStock || got.Quantity != 3 {
		t.Fatalf("got %+v, want the product with inStock true and quantity 3", got)
	}
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(body, &keys); err != nil {
		t.Fatal(err)
	}
	if _, ok := keys["isActive"]; ok {
		t.Fatalf("store product carries isActive: %s", body)
	}
}

func TestStoreProductBySlugInactiveOrUnknown(t *testing.T) {
	token := adminToken(t)
	storeID := insertStore(t, true)
	cat := createCategory(t, token, map[string]any{"name": "Slug Inactive Dairy"})
	body := productBody(cat.ID, "Zslug inactive")
	body["isActive"] = false
	inactive := createProduct(t, token, body)
	setStock(t, storeID, inactive.ID, 9)

	for _, slug := range []string{inactive.Slug, "zslug-no-such-product"} {
		status, resp := call(t, http.MethodGet, "/api/core/v1/stores/"+storeID+"/products/"+slug, "", nil)
		if e := decodeError(t, resp); status != http.StatusNotFound || e.Error.Code != "not_found" {
			t.Errorf("slug %s: got %d %s, want 404 not_found", slug, status, resp)
		}
	}
}
