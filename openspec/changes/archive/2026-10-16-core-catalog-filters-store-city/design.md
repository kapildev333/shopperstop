## Context

`GET /stores/{id}/products` is `catalog.StoreProducts` (`internal/catalog/store.go`): `storeFilters` reads `q` and `categoryId`, then two sqlc queries in `queries/catalog.sql`, `StoreProducts` (left join `store_stock` at the store, `order by p.name, p.id`, limit/offset) and `CountStoreProducts` (no stock join today). The staff stock list (`internal/stock/handlers.go`) already validates a boolean filter the way this change needs: `lowStock` accepts `true`, `false` and empty, anything else is 400 field `lowStock`, and its SQL uses `(not @low_stock::boolean or ...)`.

A store is one `stores` row (0003) read with `select *` through `queries/store.sql`. `store.Store` (public view, `internal/store/store.go`) is the JSON of `GET /serviceability` and `GET /stores/{id}`; `store.AdminStore` embeds it plus `addressLine` and `pincode` for every admin store route. Other packages use `store.Get`/`ForPincode`/`All` only for the id, name, money and open state (cart, order placement, dashboard, stock, catalog); none serialises `Store` elsewhere. Create and change share `fields` and `check`; `httpx.ReadPatch` already refuses `null` on any member with 400 naming it. The rider service reads no store JSON from core (only `/admin/stores/{id}/orders` and the order routes, `services/rider/internal/core/core.go`) and decodes without `DisallowUnknownFields`.

The whole design was spiked on a copy of `services/core` at eadd7da (outside the worktree): `go vet` clean, every package green under `-race -count=1` (the seed package's `TestSummaryMatchesSeed` needs `docs/postman/`, so it passes only in the repository), the five new tests pass and the edited ones stay green. The `openapi.json` scripts and `core.d.ts` regeneration were spiked in the worktree and reverted; `apps/web`, `apps/rider`, `apps/mobile` and `packages/ui` typecheck against the new `core.d.ts`, `apps/admin` does not (see "Cross-area").

## Goals / Non-Goals

**Goals:** in-stock filter and price sort done in SQL with correct paging and `total`; a store city on every store read, settable by admins, seeded for the demo stores; nothing breaks for the apps or the rider service.

**Non-Goals:** the admin panel's city field; other sort keys; an index for the price sort; requiring `city`.

## Decisions

### 1. `inStock` follows `lowStock`: `true`, `false` or empty

`true` filters, `false` and empty do not, anything else (`yes`, `TRUE`, `1`) is 400 field `inStock` "must be true or false". This matches the staff `lowStock` parameter the request names as the model. (core-P3-L2's `active` refuses `false` instead; `inStock=false` read as "only out of stock" is possible, but the brief asked for `lowStock`'s rule and a client sending the checkbox state as `false` gets the natural answer.) Ceiling: no way to ask for only out-of-stock products; nobody needs it.

### 2. Both parameters are arguments of the existing two queries

`StoreProducts` gains `and (not @in_stock::boolean or coalesce(s.quantity, 0) > 0)` and
`order by case when @sort::text = 'price_asc' then p.price_cents end asc, case when @sort::text = 'price_desc' then p.price_cents end desc, p.name, p.id`. For a given `sort` one `case` is constant null, so it orders nothing; `p.name, p.id` is the tie-break and the default. `CountStoreProducts` gains the same left join on `store_stock` (so it now takes `store_id`) and the same `in_stock` clause. No dynamic SQL, no new query. sqlc adds `InStock bool`, `Sort string` and `StoreID string` to the param structs. Go validates `sort` before it reaches SQL, so the SQL only ever sees `''`, `price_asc` or `price_desc`. Ceiling: a price sort is a sort over the filtered rows with no index (about 150 demo products; a store with tens of thousands would want an index on `(price_cents, name, id)`).

### 3. Validation order and messages

`storeFilters` (q, categoryId) runs first, then the new `storeView` (inStock, then sort), so `q` errors keep their precedence. Messages: `inStock` "must be true or false", `sort` "must be price_asc or price_desc". Values are case-sensitive.

### 4. `city` is omitted when empty, not always present

The brief proposed `city` always present, possibly `""`. CLAUDE.md's JSON rule is "never null: optional = omitted", and every optional text in core follows it (`Product.description`, `Product.brand`, `imageUrl`, `Order.riderName`; core-P2-L1: `""` unsets optional text and the member is omitted). Omitting also keeps `city` optional in `core.d.ts`, so no response fixture in web, admin, rider or mobile (`Store`/`AdminStore` have `additionalProperties: false` and every listed member required) needs a change. So `store.Store.City` is `json:"city,omitempty"` and the schemas list `city` without `required`. The demo stores always have a city, so the mobile header gets one in every demo and e2e run. Ceiling: a client must treat a missing `city` as "no city" (`store.city ?? ''`). If the owner wants it required later, it is one `required` entry plus a fixture spread in each app.

### 5. Storage and validation

Migration 0009: `alter table stores add column city text not null default ''`; existing rows get `''`. `''` is "no city" (no null, no extra state). On create an absent `city` becomes `''` through `withDefaults`; on change an absent `city` is a nil pointer and `coalesce(sqlc.narg(city), city)` keeps it, while `""` clears it. `check` trims `city` and allows 0 to 100 runes (`name`'s rule without the lower bound), else 400 field `city` "city must be at most 100 characters". `null` is already 400 field `city` from `ReadPatch`. `city` sits on the public `Store`, after `name`, because the customer header needs it and `AdminStore` embeds `Store`.

### 6. Demo seed

`seed.go` writes `city` `Bengaluru` in the existing demo-store insert. `TestResetTwiceLeavesDemoStores` reads it back through `GET /serviceability` for both stores.

### 7. `openapi.json` is edited by script, `StoreCreate.city` has no `default`

Two Python scripts below, run once from `services/core`, never committed. `openapi.json` round-trips byte for byte through `json.dumps(d, indent=2, ensure_ascii=False) + '\n'` (checked). Do not give `StoreCreate.city` a `default`: openapi-typescript then makes the member required in `core.d.ts` (spiked: it broke the admin form's request body type).

### Cross-area: one admin line

`apps/admin/src/store-form.tsx:10` declares `type Field = keyof StoreCreate` and `Record<Field, string>` objects without `city`; once `StoreCreate` lists `city`, `tsc` fails with TS2741 at lines 16 and 28. The fix, which typechecks against main's `core.d.ts` and the new one and keeps `store-form.test.tsx` green (spiked both ways):

```ts
type Field = Exclude<keyof StoreCreate, 'city'>
```

It must be on main before Task 2's branch merges (request to admin through the orchestrator; the admin follow-up lane that adds the city input replaces it). Until then `make test-web` on this branch fails only with TS2741 in `apps/admin/src/store-form.tsx`.

## Risks / Trade-offs

- [Admin is paused] → the one-line admin change above blocks Task 2's merge, not its build; the manager or orchestrator lands it (or relays it to the admin manager). Task 1 has no cross-area effect and can merge alone.
- [Price sort without an index] → acceptable at demo size (Decision 2).
- [`inStock=false` means no filter] → matches `lowStock`; documented in `openapi.json`.

## Code (verbatim diffs from the spike; `git apply --check` clean on eadd7da)

Apply with `git apply` from the worktree root (save each block to a file in the scratchpad first), or edit by hand to the same result. After the SQL edits run `make gen` (sqlc, then `core.d.ts`).

## Task 1: in stock and price sort

### Test: `services/core/internal/app/catalog_store_test.go`

```diff
--- a/services/core/internal/app/catalog_store_test.go
+++ b/services/core/internal/app/catalog_store_test.go
@@ -364,3 +364,74 @@
 	status, body := call(t, http.MethodGet, "/api/core/v1/stores/"+storeID+"/products?q=a%00b", "", nil)
 	expectError(t, "q=a%00b", status, body, http.StatusBadRequest, "validation", "q", "")
 }
+
+// names lists the product names of a store product list in order.
+func names(list storeProductListView) []string {
+	out := make([]string, 0, len(list.Items))
+	for _, p := range list.Items {
+		out = append(out, p.Name)
+	}
+	return out
+}
+
+func TestStoreProductsInStockOnly(t *testing.T) {
+	token := adminToken(t)
+	storeID := insertStore(t, true)
+	cat := createCategory(t, token, map[string]any{"name": "Instock Dairy"})
+	for name, qty := range map[string]int{"Zinstock a": 3, "Zinstock b": 0, "Zinstock c": 1} {
+		setStock(t, storeID, createProduct(t, token, productBody(cat.ID, name)).ID, qty)
+	}
+	createProduct(t, token, productBody(cat.ID, "Zinstock d")) // no stock row at the store
+
+	first := storeProducts(t, storeID, url.Values{"q": {"Zinstock"}, "inStock": {"true"}, "pageSize": {"1"}})
+	second := storeProducts(t, storeID, url.Values{"q": {"Zinstock"}, "inStock": {"true"}, "pageSize": {"1"}, "page": {"2"}})
+	if first.Total != 2 || strings.Join(names(first), ",") != "Zinstock a" || strings.Join(names(second), ",") != "Zinstock c" {
+		t.Fatalf("inStock=true: got %+v then %+v, want total 2, a on page 1, c on page 2", first, second)
+	}
+	for _, v := range []string{"false", ""} {
+		if all := storeProducts(t, storeID, url.Values{"q": {"Zinstock"}, "inStock": {v}}); all.Total != 4 {
+			t.Fatalf("inStock=%q: got total %d, want 4 (no filter)", v, all.Total)
+		}
+	}
+}
+
+func TestStoreProductsSortByPrice(t *testing.T) {
+	token := adminToken(t)
+	storeID := insertStore(t, true)
+	cat := createCategory(t, token, map[string]any{"name": "Sort Dairy"})
+	for name, price := range map[string]int{"Zsort b": 3000, "Zsort a": 3000, "Zsort c": 1000, "Zsort d": 5000} {
+		body := productBody(cat.ID, name)
+		body["priceCents"] = price
+		setStock(t, storeID, createProduct(t, token, body).ID, 2)
+	}
+
+	for by, want := range map[string]string{
+		"price_asc":  "Zsort c,Zsort a,Zsort b,Zsort d",
+		"price_desc": "Zsort d,Zsort a,Zsort b,Zsort c",
+		"":           "Zsort a,Zsort b,Zsort c,Zsort d",
+	} {
+		if got := strings.Join(names(storeProducts(t, storeID, url.Values{"q": {"Zsort"}, "sort": {by}})), ","); got != want {
+			t.Errorf("sort=%q: got %s, want %s", by, got, want)
+		}
+	}
+	page2 := storeProducts(t, storeID, url.Values{"q": {"Zsort"}, "sort": {"price_desc"}, "pageSize": {"2"}, "page": {"2"}})
+	if page2.Total != 4 || strings.Join(names(page2), ",") != "Zsort b,Zsort c" {
+		t.Fatalf("sort=price_desc page 2 of 2: got %+v, want total 4 and b, c", page2)
+	}
+}
+
+func TestStoreProductsBadInStockOrSort(t *testing.T) {
+	storeID := insertStore(t, true)
+	for _, c := range []struct{ query, field string }{
+		{"inStock=yes", "inStock"},
+		{"inStock=TRUE", "inStock"},
+		{"sort=price", "sort"},
+		{"sort=PRICE_ASC", "sort"},
+		{"sort=name", "sort"},
+	} {
+		status, body := call(t, http.MethodGet, "/api/core/v1/stores/"+storeID+"/products?"+c.query, "", nil)
+		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != c.field {
+			t.Errorf("%s: got %d %s, want 400 validation field %s", c.query, status, body, c.field)
+		}
+	}
+}
```

### `services/core/queries/catalog.sql`

```diff
--- a/services/core/queries/catalog.sql
+++ b/services/core/queries/catalog.sql
@@ -73,6 +73,7 @@
 delete from products where id = $1;
 
 -- name: StoreProducts :many
+-- in_stock keeps quantity above 0 at the store; sort 'price_asc' or 'price_desc' orders by price first, anything else by name.
 select p.id, p.name, p.slug, p.description, p.brand, p.unit_label, p.mrp_cents, p.price_cents,
        p.category_id, p.image_key, coalesce(s.quantity, 0)::integer as quantity
 from products p
@@ -82,16 +83,21 @@
   and (sqlc.narg(category_id)::uuid is null
        or p.category_id = sqlc.narg(category_id)
        or p.category_id in (select c.id from categories c where c.parent_id = sqlc.narg(category_id)))
-order by p.name, p.id
+  and (not @in_stock::boolean or coalesce(s.quantity, 0) > 0)
+order by case when @sort::text = 'price_asc' then p.price_cents end asc,
+         case when @sort::text = 'price_desc' then p.price_cents end desc,
+         p.name, p.id
 limit @page_size offset @page_offset;
 
 -- name: CountStoreProducts :one
 select count(*) from products p
+left join store_stock s on s.product_id = p.id and s.store_id = @store_id
 where p.is_active
   and (sqlc.narg(pattern)::text is null or p.name ilike sqlc.narg(pattern) or p.brand ilike sqlc.narg(pattern))
   and (sqlc.narg(category_id)::uuid is null
        or p.category_id = sqlc.narg(category_id)
-       or p.category_id in (select c.id from categories c where c.parent_id = sqlc.narg(category_id)));
+       or p.category_id in (select c.id from categories c where c.parent_id = sqlc.narg(category_id)))
+  and (not @in_stock::boolean or coalesce(s.quantity, 0) > 0);
 
 -- name: StoreProductBySlug :one
 select p.id, p.name, p.slug, p.description, p.brand, p.unit_label, p.mrp_cents, p.price_cents,
```

### `services/core/internal/catalog/store.go`

```diff
--- a/services/core/internal/catalog/store.go
+++ b/services/core/internal/catalog/store.go
@@ -95,8 +95,28 @@
 	return pat, categoryID, nil
 }
 
+// storeView reads inStock (true filters, false or empty does not) and sort
+// (price_asc or price_desc; empty means by name). Anything else is 400 naming the parameter.
+func storeView(r *http.Request) (inStock bool, sort string, err error) {
+	query := r.URL.Query()
+	switch query.Get("inStock") {
+	case "", "false":
+	case "true":
+		inStock = true
+	default:
+		return false, "", invalid("inStock", "must be true or false")
+	}
+	switch sort = query.Get("sort"); sort {
+	case "", "price_asc", "price_desc":
+	default:
+		return false, "", invalid("sort", "must be price_asc or price_desc")
+	}
+	return inStock, sort, nil
+}
+
 // StoreProducts answers the paged active products the store sells, ordered by
-// name, filtered by q and categoryId (with its children). 404 for an unknown store.
+// name or by price (sort), filtered by q, categoryId (with its children) and
+// inStock, all in SQL so total counts every match. 404 for an unknown store.
 func StoreProducts(pool *pgxpool.Pool) http.HandlerFunc {
 	return func(w http.ResponseWriter, r *http.Request) {
 		storeID, err := httpx.PathID(r, "id")
@@ -118,16 +138,21 @@
 			httpx.WriteError(w, r, err)
 			return
 		}
+		inStock, sort, err := storeView(r)
+		if err != nil {
+			httpx.WriteError(w, r, err)
+			return
+		}
 		q := db.New(pool)
 		rows, err := q.StoreProducts(r.Context(), db.StoreProductsParams{
-			StoreID: storeID, Pattern: pat, CategoryID: categoryID,
+			StoreID: storeID, Pattern: pat, CategoryID: categoryID, InStock: inStock, Sort: sort,
 			PageOffset: int32((page - 1) * pageSize), PageSize: int32(pageSize),
 		})
 		if err != nil {
 			httpx.WriteError(w, r, err)
 			return
 		}
-		total, err := q.CountStoreProducts(r.Context(), db.CountStoreProductsParams{Pattern: pat, CategoryID: categoryID})
+		total, err := q.CountStoreProducts(r.Context(), db.CountStoreProductsParams{StoreID: storeID, Pattern: pat, CategoryID: categoryID, InStock: inStock})
 		if err != nil {
 			httpx.WriteError(w, r, err)
 			return
```

### `openapi.json` script (Task 1)

```python
# Task 1: inStock and sort on GET /stores/{id}/products. Run from services/core.
import json
d = json.load(open('openapi.json'))
op = d['paths']['/stores/{id}/products']['get']
op['description'] = ("Public, no session. The paged active products a store sells, filtered by q (name or brand) and categoryId "
    "(with its children) exactly as the admin list filters them, and by inStock. Ordered by name, or by price with sort "
    "(equal prices by name, then id). Inactive products are never listed. Each product carries inStock and quantity at "
    "this store; quantity is capped at 10 for display. total counts every match after every filter, not just this page. "
    "An unknown store answers 404 not_found; a bad q, categoryId, inStock or sort answers 400 naming the parameter.")
params = op['parameters']
at = next(i for i, p in enumerate(params) if p['name'] == 'page')
params[at:at] = [
    {"name": "inStock", "in": "query", "required": False,
     "description": "true lists only products whose quantity at this store is above 0. false, empty or absent means no filter. Any other value answers 400 naming inStock.",
     "schema": {"type": "boolean"}, "example": True},
    {"name": "sort", "in": "query", "required": False,
     "description": "price_asc: cheapest first; price_desc: dearest first; equal prices by name, then id. Empty or absent: by name, then id. Any other value answers 400 naming sort.",
     "schema": {"type": "string", "enum": ["price_asc", "price_desc"]}, "example": "price_asc"},
]
op['responses']['400']['description'] = "A q, categoryId, inStock or sort is invalid. The field names it."
open('openapi.json', 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
```

## Task 2: store city

### Test: `services/core/internal/app/admin_stores_test.go`

```diff
--- a/services/core/internal/app/admin_stores_test.go
+++ b/services/core/internal/app/admin_stores_test.go
@@ -3,6 +3,7 @@
 import (
 	"encoding/json"
 	"net/http"
+	"strings"
 	"testing"
 )
 
@@ -13,6 +14,7 @@
 type adminStore struct {
 	ID                     string `json:"id"`
 	Name                   string `json:"name"`
+	City                   string `json:"city"`
 	AddressLine            string `json:"addressLine"`
 	Pincode                string `json:"pincode"`
 	IsOpen                 bool   `json:"isOpen"`
@@ -98,6 +100,8 @@
 		{"promisedMinutes", missing},
 		{"promisedMinutes", with("promisedMinutes", 0)},
 		{"promisedMinutes", with("promisedMinutes", 241)},
+		{"city", with("city", strings.Repeat("x", 101))},
+		{"city", with("city", nil)},
 	}
 	var before int
 	if err := testPool.QueryRow(t.Context(), "select count(*) from stores").Scan(&before); err != nil {
@@ -260,5 +264,39 @@
 		if e := decodeError(t, raw); status != http.StatusForbidden || e.Error.Code != "forbidden" {
 			t.Fatalf("store staff GET %s: got %d %s, want 403 forbidden", id, status, raw)
 		}
+	}
+}
+
+func TestCreateStoreCity(t *testing.T) {
+	token := adminToken(t)
+	with := newStoreBody("City Layout", "561211")
+	with["city"] = "  Bengaluru "
+	if s := createStore(t, token, with); s.City != "Bengaluru" || getAdminStore(t, token, s.ID).City != "Bengaluru" {
+		t.Fatalf("create with city: got %q, want Bengaluru stored trimmed", s.City)
+	}
+	status, raw := call(t, http.MethodPost, adminStoresPath, token, newStoreBody("No City Layout", "561212"))
+	if status != http.StatusCreated || strings.Contains(string(raw), `"city"`) {
+		t.Fatalf("create without city: got %d %s, want 201 without a city member", status, raw)
+	}
+}
+
+func TestPatchStoreCity(t *testing.T) {
+	token := adminToken(t)
+	id := insertStore(t, true, "561213")
+	patch := func(body map[string]any) (int, []byte) {
+		return call(t, http.MethodPatch, adminStoresPath+"/"+id, token, body)
 	}
+	if status, raw := patch(map[string]any{"city": " Bengaluru "}); status != http.StatusOK || getAdminStore(t, token, id).City != "Bengaluru" {
+		t.Fatalf("set city: got %d %s, want 200 and city Bengaluru", status, raw)
+	}
+	if status, raw := patch(map[string]any{"name": "Renamed"}); status != http.StatusOK || getAdminStore(t, token, id).City != "Bengaluru" {
+		t.Fatalf("patch without city: got %d %s, want the city unchanged", status, raw)
+	}
+	status, raw := patch(map[string]any{"city": strings.Repeat("x", 101)})
+	if e := decodeError(t, raw); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "city" || getAdminStore(t, token, id).City != "Bengaluru" {
+		t.Fatalf("101-character city: got %d %s, want 400 validation field city and the city unchanged", status, raw)
+	}
+	if status, raw := patch(map[string]any{"city": ""}); status != http.StatusOK || strings.Contains(string(raw), `"city"`) {
+		t.Fatalf("clear city: got %d %s, want 200 without a city member", status, raw)
+	}
 }
```

### Test: `services/core/internal/app/stores_test.go`

```diff
--- a/services/core/internal/app/stores_test.go
+++ b/services/core/internal/app/stores_test.go
@@ -141,3 +141,29 @@
 	sort.Strings(out)
 	return out
 }
+
+func TestPublicStoreCity(t *testing.T) {
+	id := insertStore(t, true, "561104")
+	if _, err := testPool.Exec(context.Background(), "update stores set city = 'Bengaluru' where id = $1", id); err != nil {
+		t.Fatal(err)
+	}
+	want := strings.Join(sortedCopy(append([]string{"city"}, publicStoreKeys...)), ",")
+	for _, path := range []string{"/api/core/v1/stores/" + id, "/api/core/v1/serviceability?pincode=561104"} {
+		status, body := call(t, http.MethodGet, path, "", nil)
+		var wrapper struct {
+			Store json.RawMessage `json:"store"`
+		}
+		if status != http.StatusOK || json.Unmarshal(body, &wrapper) != nil {
+			t.Fatalf("GET %s: got %d %s, want 200", path, status, body)
+		}
+		if wrapper.Store != nil {
+			body = wrapper.Store
+		}
+		var s struct {
+			City string `json:"city"`
+		}
+		if got := strings.Join(keysOf(t, body), ","); got != want || json.Unmarshal(body, &s) != nil || s.City != "Bengaluru" {
+			t.Fatalf("GET %s: got %s, want keys %s and city Bengaluru", path, body, want)
+		}
+	}
+}
```

### Test: `services/core/internal/seed/seed_test.go`

```diff
--- a/services/core/internal/seed/seed_test.go
+++ b/services/core/internal/seed/seed_test.go
@@ -268,11 +268,12 @@
 		var s struct {
 			Store struct {
 				ID     string `json:"id"`
+				City   string `json:"city"`
 				IsOpen bool   `json:"isOpen"`
 			} `json:"store"`
 		}
-		if status != http.StatusOK || json.Unmarshal(body, &s) != nil || s.Store.ID != want || !s.Store.IsOpen {
-			t.Fatalf("serviceability %s: got %d %s, want 200 open store %s", pincode, status, body, want)
+		if status != http.StatusOK || json.Unmarshal(body, &s) != nil || s.Store.ID != want || !s.Store.IsOpen || s.Store.City != "Bengaluru" {
+			t.Fatalf("serviceability %s: got %d %s, want 200 open store %s in Bengaluru", pincode, status, body, want)
 		}
 	}
 	if status, body := getJSON(t, base+"/api/core/v1/serviceability?pincode=110001"); status != http.StatusNotFound {
```

### `services/core/migrations/0009_store_city.sql` (new)

```diff
--- /dev/null
+++ b/services/core/migrations/0009_store_city.sql
@@ -0,0 +1,3 @@
+-- The city a store is in, for the customer's header ("560034, Bengaluru"). '' means not set;
+-- existing stores get '' and an admin sets it later.
+alter table stores add column city text not null default '';
```

### `services/core/queries/store.sql`

```diff
--- a/services/core/queries/store.sql
+++ b/services/core/queries/store.sql
@@ -13,13 +13,14 @@
 select count(*) from stores;
 
 -- name: CreateStore :one
-insert into stores (name, address_line, pincode, is_open, delivery_fee_cents, free_delivery_above_cents, min_order_cents, promised_minutes)
-values ($1, $2, $3, $4, $5, $6, $7, $8)
+insert into stores (name, city, address_line, pincode, is_open, delivery_fee_cents, free_delivery_above_cents, min_order_cents, promised_minutes)
+values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
 returning *;
 
 -- name: UpdateStore :one
 update stores
 set name = coalesce(sqlc.narg(name), name),
+    city = coalesce(sqlc.narg(city), city),
     address_line = coalesce(sqlc.narg(address_line), address_line),
     pincode = coalesce(sqlc.narg(pincode), pincode),
     is_open = coalesce(sqlc.narg(is_open), is_open),
```

### `services/core/internal/store/store.go`

```diff
--- a/services/core/internal/store/store.go
+++ b/services/core/internal/store/store.go
@@ -20,6 +20,7 @@
 type Store struct {
 	ID                     string `json:"id"`
 	Name                   string `json:"name"`
+	City                   string `json:"city,omitempty"`
 	IsOpen                 bool   `json:"isOpen"`
 	DeliveryFeeCents       int64  `json:"deliveryFeeCents"`
 	FreeDeliveryAboveCents int64  `json:"freeDeliveryAboveCents"`
@@ -72,7 +73,7 @@
 
 func public(row db.Store) Store {
 	return Store{
-		ID: row.ID, Name: row.Name, IsOpen: row.IsOpen,
+		ID: row.ID, Name: row.Name, City: row.City, IsOpen: row.IsOpen,
 		DeliveryFeeCents: row.DeliveryFeeCents, FreeDeliveryAboveCents: row.FreeDeliveryAboveCents,
 		MinOrderCents: row.MinOrderCents, PromisedMinutes: row.PromisedMinutes,
 	}
@@ -90,6 +91,7 @@
 // stays unchanged; on create withDefaults fills every nil member first.
 type fields struct {
 	Name                   *string `json:"name"`
+	City                   *string `json:"city"`
 	AddressLine            *string `json:"addressLine"`
 	Pincode                *string `json:"pincode"`
 	IsOpen                 *bool   `json:"isOpen"`
@@ -103,6 +105,7 @@
 // with no fee and no minimum, and the blank text and zero minutes that check refuses.
 func (f *fields) withDefaults() {
 	f.Name = orZero(f.Name)
+	f.City = orZero(f.City)
 	f.AddressLine = orZero(f.AddressLine)
 	f.Pincode = orZero(f.Pincode)
 	f.IsOpen = orZero(f.IsOpen)
@@ -119,7 +122,7 @@
 	return p
 }
 
-// check trims Name and AddressLine in place, then checks each present member in
+// check trims Name, City and AddressLine in place, then checks each present member in
 // order; the first failure is the answer. Every failure is 400 validation
 // naming the field, and nothing is written.
 func check(f *fields) error {
@@ -129,6 +132,12 @@
 			return invalid("name", "name must be 1 to 100 characters")
 		}
 	}
+	if f.City != nil {
+		*f.City = strings.TrimSpace(*f.City)
+		if utf8.RuneCountInString(*f.City) > 100 {
+			return invalid("city", "city must be at most 100 characters")
+		}
+	}
 	if f.AddressLine != nil {
 		*f.AddressLine = strings.TrimSpace(*f.AddressLine)
 		if n := utf8.RuneCountInString(*f.AddressLine); n < 1 || n > 200 {
```

### `services/core/internal/store/handlers.go`

```diff
--- a/services/core/internal/store/handlers.go
+++ b/services/core/internal/store/handlers.go
@@ -101,7 +101,7 @@
 			return
 		}
 		row, err := db.New(pool).CreateStore(r.Context(), db.CreateStoreParams{
-			Name: *f.Name, AddressLine: *f.AddressLine, Pincode: *f.Pincode, IsOpen: *f.IsOpen,
+			Name: *f.Name, City: *f.City, AddressLine: *f.AddressLine, Pincode: *f.Pincode, IsOpen: *f.IsOpen,
 			DeliveryFeeCents: *f.DeliveryFeeCents, FreeDeliveryAboveCents: *f.FreeDeliveryAboveCents,
 			MinOrderCents: *f.MinOrderCents, PromisedMinutes: *f.PromisedMinutes,
 		})
@@ -149,7 +149,7 @@
 			return
 		}
 		row, err := db.New(pool).UpdateStore(r.Context(), db.UpdateStoreParams{
-			ID: id, Name: f.Name, AddressLine: f.AddressLine, Pincode: f.Pincode, IsOpen: f.IsOpen,
+			ID: id, Name: f.Name, City: f.City, AddressLine: f.AddressLine, Pincode: f.Pincode, IsOpen: f.IsOpen,
 			DeliveryFeeCents: f.DeliveryFeeCents, FreeDeliveryAboveCents: f.FreeDeliveryAboveCents,
 			MinOrderCents: f.MinOrderCents, PromisedMinutes: f.PromisedMinutes,
 		})
```

### `services/core/internal/seed/seed.go`

```diff
--- a/services/core/internal/seed/seed.go
+++ b/services/core/internal/seed/seed.go
@@ -120,9 +120,9 @@
 		homeID, workID, customerID); err != nil {
 		return fmt.Errorf("insert demo addresses: %w", err)
 	}
-	if _, err := tx.Exec(ctx, `insert into stores (id, name, address_line, pincode, is_open, delivery_fee_cents, free_delivery_above_cents, min_order_cents, promised_minutes) values
-		($1, 'Koramangala', '80 Feet Rd, Koramangala', '560034', true, 2500, 19900, 9900, 10),
-		($2, 'Indiranagar', '100 Feet Rd, Indiranagar', '560038', true, 2500, 19900, 9900, 12)`,
+	if _, err := tx.Exec(ctx, `insert into stores (id, name, city, address_line, pincode, is_open, delivery_fee_cents, free_delivery_above_cents, min_order_cents, promised_minutes) values
+		($1, 'Koramangala', 'Bengaluru', '80 Feet Rd, Koramangala', '560034', true, 2500, 19900, 9900, 10),
+		($2, 'Indiranagar', 'Bengaluru', '100 Feet Rd, Indiranagar', '560038', true, 2500, 19900, 9900, 12)`,
 		storeKoramangala, storeIndiranagar); err != nil {
 		return fmt.Errorf("insert demo stores: %w", err)
 	}
```

### `openapi.json` script (Task 2)

```python
# Task 2: Store.city. Run from services/core.
import json
d = json.load(open('openapi.json'))
s = d['components']['schemas']

def with_city(props, prop):
    # Insert city right after name, keeping the other members in order.
    out = {}
    for k, v in props.items():
        out[k] = v
        if k == 'name':
            out['city'] = prop
    return out

shown = {"type": "string", "maxLength": 100, "description": "The city the store is in, for the customer's header (\"560034, Bengaluru\"). Omitted when the store has none.", "example": "Bengaluru"}
s['Store']['properties'] = with_city(s['Store']['properties'], shown)
s['AdminStore']['properties'] = with_city(s['AdminStore']['properties'], shown)
s['StoreCreate']['properties'] = with_city(s['StoreCreate']['properties'], {"type": "string", "maxLength": 100, "description": "At most 100 characters after trimming. Absent or empty: no city."})
s['StorePatch']['properties'] = with_city(s['StorePatch']['properties'], {"type": "string", "maxLength": 100, "description": "At most 100 characters after trimming; empty clears the city."})

def add_city(example):
    if 'name' in example and 'promisedMinutes' in example:
        return with_city(example, 'Bengaluru')
    return example

p = d['paths']
for path, method, code in [('/serviceability', 'get', '200'), ('/stores/{id}', 'get', '200'), ('/admin/stores', 'get', '200'),
                           ('/admin/stores', 'post', '201'), ('/admin/stores/{id}', 'get', '200'), ('/admin/stores/{id}', 'patch', '200')]:
    c = p[path][method]['responses'][code]['content']['application/json']
    ex = c['example']
    if 'store' in ex:
        ex['store'] = add_city(ex['store'])
    elif 'items' in ex:
        ex['items'] = [add_city(i) for i in ex['items']]
    else:
        c['example'] = add_city(ex)
req = p['/admin/stores']['post']['requestBody']['content']['application/json']
req['example'] = with_city(req['example'], 'Bengaluru')
p['/admin/stores']['post']['description'] = p['/admin/stores']['post']['description'].replace(
    "plus any of isOpen,", "plus any of city, isOpen,").replace(
    "Name and addressLine are trimmed;", "An absent city means none. Name, city and addressLine are trimmed;")
p['/admin/stores/{id}']['patch']['description'] = p['/admin/stores/{id}']['patch']['description'].replace(
    "Changes only the fields present: name,", "Changes only the fields present: name, city (empty clears it),")
open('openapi.json', 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
```
