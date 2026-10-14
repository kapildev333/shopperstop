# Design

Only the decisions this lane makes. The seed, the stock list, the order routes and the product PATCH are the landed designs of core-P2-L1 to L5 (archived changes) and are not restated.

Every block marked "verbatim" was spiked on 2026-10-13 on this branch at 4871da1 against a per-run schema of `shopperstop_core_test` (D26; nothing touched `shopperstop_core` or `shopperstop_core_e2e`): sqlc v1.31.1 generated, `GOFLAGS=-count=1 make test-core` exit 0 with all of it in place, and the tree was restored afterwards. Workers type the blocks in; they do not design them.

## Audit: Spec 2 §11 against the landed seed

| §11 item | Landed where | Pinned by | Gap |
|---|---|---|---|
| `seed-demo --reset`, idempotent | `seed.Reset` (one transaction: truncate, load), `cmd/core-admin` | `TestResetTwice*`, `TestResetLoads*`, `TestSeedDemoExitCodes` | none |
| "for local databases only" | not enforced: the command seeds whatever `SHOPPERSTOP_CORE_DATABASE_URL` names | nothing | documentation only; a guard is deferred (Ceilings), escalated to the manager |
| two stores, both open | `seed.go` stores insert, `...0401` Koramangala, `...0402` Indiranagar | `TestResetTwiceLeavesDemoStores` | test asserts neither the names nor `is_open` on the rows: closed in task 3 (assertion only) |
| pincodes 560034, 560095 / 560038, 560008 | `store_service_areas` insert | same test: 560095 and 560008 through `GET /serviceability`, row count 4 | 560034 and 560038 not asserted: closed in task 3 (assertion only) |
| 12 parents with 2 to 4 children | `catalog.go` `demoCatalog` (12 parents, 37 children) | `TestResetLoadsDemoCatalog` | none |
| about 150 products | 148, ids `...0601` to `...0694` (hex), `...0694` inactive | same test | none: 148 is the recorded number (living `catalog` spec "Demo catalog") |
| committed placeholder images | 12 PNGs, one per parent, embedded from `internal/seed/images/`, written to the files dir by `seed.Files` | `TestDemoImagesServed` | none: 12 shared images and the embed directory (not `data/seed-images/`) are core-P2-L3 decisions accepted by web |
| stock at both stores, zeros and low counts | `seed.go` stock insert (per store a 0 and a 1 to 4 every 15 products) | `TestResetLoadsDemoStock` | none |
| admin `admin@shopperstop.local` / `admin12345` | `...0101` | `TestResetTwiceLeavesDemoAccounts` (sign-in 200) | none |
| store staff `koramangala@`, `indiranagar@` / `staff12345` | `...0102`, `...0103` | `TestResetLeavesDemoStoreStaff` | none |
| customer `demo@shopperstop.local` / `demo12345` | `...0201` | `TestResetTwiceLeavesDemoAccounts` | none |
| two addresses | `...0301` Home 560034 default, `...0302` Work 560038 | same test | none |
| three past orders in different states | `...0701` delivered, `...0702` cancelled, `...0703` placed | `TestResetLoadsDemoOrders`, `TestDemoOrdersThroughTheRouter` | the Home address snapshot is not asserted: closed in task 3 (assertion only) |
| "The README lists these" | `README.md` lists the four sign-ins but still calls the seed a Phase 1 stub and lists no ids | platform spec "README lists the demo sign-ins" | platform's file: request to platform (lane log) |
| D20: fixed ids documented | ids are constants and SQL literals in `seed.go` and `catalog.go`; the command prints "demo accounts loaded" and two accounts | nothing ties the Postman environment to the seed | closed in task 2 (Decision 2) |

Result: no seed row is added or changed, and no migration is needed.

## Decision 1: no seed data changes

The audit finds every §11 row on `main`. The three under-asserted points are closed by assertions that pass on first run (task 3).

## Decision 2: the fixed ids are documented in `seed.Summary`, printed by `seed-demo`

One exported constant in `internal/seed` is the documentation: a developer sees it at the end of every `make dev` and `make seed`, and reads it in the source next to the inserts. `core-admin seed-demo` prints it after a successful load. A test parses it, so a line that drifts from the seeded rows or from the Postman environment fails the suite.

New file `services/core/internal/seed/summary.go`, verbatim (two spaces between columns; the file ends with the closing backquote and a newline):

```go
package seed

// Summary is what `core-admin seed-demo` prints after a load: the demo
// sign-ins of Spec 2 §11 and the fixed ids of PLAN.md D20. It is the one place
// they are documented. docs/postman/local.postman_environment.json carries the
// four ids marked "Postman"; TestSummaryMatchesSeed fails when a line here, a
// seeded row or that file drifts from the others.
const Summary = `seed-demo: demo data loaded (local databases only)

sign-ins (email, password, role)
  admin@shopperstop.local        admin12345  admin
  koramangala@shopperstop.local  staff12345  store_staff
  indiranagar@shopperstop.local  staff12345  store_staff
  demo@shopperstop.local         demo12345   customer

fixed ids (id, table, what)
  00000000-0000-4000-8000-000000000101  staff_users  admin
  00000000-0000-4000-8000-000000000102  staff_users  Koramangala store staff
  00000000-0000-4000-8000-000000000103  staff_users  Indiranagar store staff
  00000000-0000-4000-8000-000000000201  customers    demo customer
  00000000-0000-4000-8000-000000000301  addresses    Home, 560034, default (Postman addressId)
  00000000-0000-4000-8000-000000000302  addresses    Work, 560038
  00000000-0000-4000-8000-000000000401  stores       Koramangala, serves 560034 and 560095 (Postman storeId)
  00000000-0000-4000-8000-000000000402  stores       Indiranagar, serves 560038 and 560008
  00000000-0000-4000-8000-000000000601  products     Banana Robusta, first of 148: ...0601 to ...0694, hex (Postman productId)
  00000000-0000-4000-8000-000000000701  orders       SS-DEMOAAAB, delivered
  00000000-0000-4000-8000-000000000702  orders       SS-DEMOAAAC, cancelled
  00000000-0000-4000-8000-000000000703  orders       SS-DEMOAAAD, placed (Postman orderId)
`
```

`services/core/internal/seed/seed.go`: replace the first three comment lines (the package comment's first paragraph) with, verbatim:

```go
// Package seed loads the demo data of Spec 2 §11 for `core-admin seed-demo`:
// accounts, stores, catalog, stock and orders, all with fixed ids (PLAN.md D20,
// D22). Summary documents the sign-ins and the ids. It is the one package
// allowed to write other packages' tables.
```

Nothing else in `seed.go` changes.

`services/core/cmd/core-admin/main.go`, in `seedDemoCmd`: the comment above the function becomes `// seedDemoCmd loads the demo data, clearing it first when reset is set, and prints seed.Summary.`, and the three `fmt.Fprintln(stdout, ...)` lines before `return 0` become one line:

```go
	fmt.Fprint(stdout, seed.Summary)
```

`services/core/cmd/core-admin/main_test.go`, `TestSeedDemoExitCodes`: add the import `"github.com/kapildev333/shopperstop/services/core/internal/seed"` (before the `testdb` import), replace the `strings.Contains(stdout.String(), "seed-demo: demo accounts loaded")` check with the first block, and add the second block right after the `code != 1` check of the second run:

```go
	if stdout.String() != seed.Summary {
		t.Fatalf("seed-demo --reset stdout %q, want seed.Summary", stdout.String())
	}
```

```go
	if stdout.String() != "" {
		t.Fatalf("second seed-demo stdout %q, want nothing", stdout.String())
	}
```

`services/core/internal/seed/seed_test.go`: add `"regexp"` to the imports (after `"path/filepath"`) and append, verbatim:

```go
var (
	summaryID      = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	summaryPostman = regexp.MustCompile(`\(Postman (\w+)\)$`)
)

// TestSummaryMatchesSeed: every sign-in seed.Summary prints works, every id it
// prints is one row of the table printed beside it, and the four ids marked
// Postman are the values of docs/postman/local.postman_environment.json.
func TestSummaryMatchesSeed(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	base := server(t)
	tables := map[string]bool{"staff_users": true, "customers": true, "addresses": true, "stores": true, "products": true, "orders": true}
	postman := map[string]string{}
	signIns, ids := 0, 0
	for _, line := range strings.Split(seed.Summary, "\n") {
		f := strings.Fields(line)
		switch {
		case len(f) == 3 && strings.Contains(f[0], "@"):
			signIns++
			path := "/api/core/v1/admin/auth/sign-in"
			if f[2] == "customer" {
				path = "/api/core/v1/auth/sign-in"
			}
			status, body := postJSON(t, base+path, map[string]string{"email": f[0], "password": f[1]})
			var s struct {
				Staff struct {
					Role string `json:"role"`
				} `json:"staff"`
			}
			if status != http.StatusOK || json.Unmarshal(body, &s) != nil || (f[2] != "customer" && s.Staff.Role != f[2]) {
				t.Errorf("sign-in %q: got %d %s, want 200 as %s", line, status, body, f[2])
			}
		case len(f) >= 2 && summaryID.MatchString(f[0]):
			ids++
			if !tables[f[1]] {
				t.Errorf("line %q names table %q, want one of %v", line, f[1], tables)
				continue
			}
			var n int
			if err := testPool.QueryRow(ctx, "select count(*) from "+f[1]+" where id = $1", f[0]).Scan(&n); err != nil {
				t.Fatal(err)
			}
			if n != 1 {
				t.Errorf("line %q: %d rows in %s with that id, want 1", line, n, f[1])
			}
			if m := summaryPostman.FindStringSubmatch(line); m != nil {
				postman[m[1]] = f[0]
			}
		}
	}
	if signIns != 4 || ids != 12 {
		t.Fatalf("summary holds %d sign-ins and %d ids, want 4 and 12", signIns, ids)
	}

	raw, err := os.ReadFile("../../../../docs/postman/local.postman_environment.json")
	if err != nil {
		t.Fatal(err)
	}
	var env struct {
		Values []struct{ Key, Value string } `json:"values"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		t.Fatal(err)
	}
	seen := 0
	for _, v := range env.Values {
		switch v.Key {
		case "storeId", "productId", "addressId", "orderId":
			seen++
			if postman[v.Key] != v.Value {
				t.Errorf("Postman %s is %q, the summary marks %q", v.Key, v.Value, postman[v.Key])
			}
		}
	}
	if seen != 4 || len(postman) != 4 {
		t.Fatalf("Postman environment holds %d of the four id variables and the summary marks %d, want 4 and 4", seen, len(postman))
	}
}
```

The table name from the summary is checked against a fixed set before it is put into SQL. The test reads the Postman file and never writes it.

## Decision 3: `StockRow.imageUrl`

The list query also selects the product's `image_key`; the handler turns it into the URL with catalog's existing rule, exported, so the value cannot differ from `StoreProduct.imageUrl`. `omitempty` leaves the member out when there is no image.

`services/core/queries/stock.sql`, `ListStock`: the select list becomes, verbatim (one column added, nothing else in the file changes):

```sql
select p.id as product_id, p.name, p.brand, p.unit_label, p.price_cents, p.image_key,
       coalesce(s.quantity, 0)::integer as quantity
```

`make gen` (sqlc v1.31.1) then rewrites only `services/core/internal/stock/db/stock.sql.go`: `ListStockRow` gains `ImageKey string` between `PriceCents` and `Quantity`.

`services/core/internal/catalog/catalog.go`: rename the function `imageURL` to `ImageURL` at its definition and its two callers in this file (`toProduct`, `toCategory`); its comment starts `// ImageURL is the path ...`. No other file calls it.

`services/core/internal/stock/handlers.go`: add the import `"github.com/kapildev333/shopperstop/services/core/internal/catalog"` (after the `auth` import); `Row` gains one field between `PriceCents` and `Quantity`; `List` fills it:

```go
	ImageURL   string `json:"imageUrl,omitempty"`
```

```go
				PriceCents: row.PriceCents, ImageURL: catalog.ImageURL(row.ImageKey), Quantity: row.Quantity,
```

`services/core/openapi.json`, three edits:

1. `components.schemas.StockRow.properties`, a new member after `priceCents` (not added to `required`):

```json
          "imageUrl": {
            "type": "string",
            "description": "Path of the product image, the same value as StoreProduct.imageUrl. Omitted when the product has no image."
          },
```

2. Operation `getStock`, the 200 example's one item, a new line after `"priceCents": 7000,`:

```json
                      "imageUrl": "/api/core/v1/files/products/seed-fruits-vegetables.png",
```

3. Operation `getStock`, `description`: after the sentence `A product with no stock row at the store is listed with quantity 0.` insert the sentence `A row carries imageUrl when the product has an image.`

The test, appended to `services/core/internal/app/stock_test.go`, verbatim (the `stockRow` view in that file first gains ``ImageURL   string `json:"imageUrl"` `` between `PriceCents` and `Quantity`). Before the code it fails at the first check, because the URL is empty:

```go
// TestStockListImageURL: a product with an image is listed with the imageUrl the
// store's product page shows; a product without one has no imageUrl member.
func TestStockListImageURL(t *testing.T) {
	name := stockName(t)
	with := insertProduct(t, name+" with", true)
	without := insertProduct(t, name+" without", true)
	var slug string
	if err := testPool.QueryRow(context.Background(),
		"update products set image_key = 'products/stock-image.png' where id = $1 returning slug", with).Scan(&slug); err != nil {
		t.Fatal(err)
	}
	setStock(t, testStoreID, with, 3)

	rows := stockByProduct(stockList(t, storeStaffToken(t), testStoreID, url.Values{"q": {name}}))
	const want = "/api/core/v1/files/products/stock-image.png"
	if got, ok := rows[with]; !ok || got.ImageURL != want {
		t.Fatalf("product with an image: %+v listed %v, want imageUrl %s", got, ok, want)
	}
	status, body := call(t, http.MethodGet, "/api/core/v1/stores/"+testStoreID+"/products/"+slug, "", nil)
	var shown struct {
		ImageURL string `json:"imageUrl"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &shown) != nil || shown.ImageURL != want {
		t.Fatalf("GET store product: got %d %s, want 200 with imageUrl %s", status, body, want)
	}

	status, body = call(t, http.MethodGet, stockPath(testStoreID)+"?"+url.Values{"q": {name + " without"}}.Encode(), adminToken(t), nil)
	var raw struct {
		Items []map[string]any `json:"items"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &raw) != nil || len(raw.Items) != 1 || raw.Items[0]["productId"] != without {
		t.Fatalf("GET stock of the product without an image: got %d %s, want 200 with that one row", status, body)
	}
	if _, ok := raw.Items[0]["imageUrl"]; ok {
		t.Fatalf("product without an image: row %v has an imageUrl member, want none", raw.Items[0])
	}
}
```

`make gen postman` then rewrites `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json`; both are committed with the code (D19, D23) and never edited by hand.

## Decision 4: three tests assert what their scenarios say

Test-only; the behaviour is on `main`, so each change passes on first run.

`internal/app/orders_test.go`, `TestOrderSnapshotsSurviveProductChange`: the SQL `update products set price_cents = 6000, ...` statement (the second `testPool.Exec` of the test, with its error check) is replaced by, verbatim:

```go
	status, body := call(t, http.MethodPatch, productsPath+"/"+p, adminToken(t), map[string]any{"name": "Renamed " + name, "mrpCents": 6000, "priceCents": 6000, "isActive": false})
	var changed productView
	if status != http.StatusOK || json.Unmarshal(body, &changed) != nil || changed.Name != "Renamed "+name || changed.PriceCents != 6000 || changed.MrpCents != 6000 || changed.IsActive {
		t.Fatalf("PATCH product: got %d %s, want 200 renamed, 6000, 6000, inactive", status, body)
	}
	// The image has no PATCH member (it changes by upload), so the test moves the key directly.
	if _, err := testPool.Exec(context.Background(), "update products set image_key = 'products/new.png' where id = $1", p); err != nil {
		t.Fatal(err)
	}
```

and, because `status` and `body` are now declared there, the later line `status, body := call(t, http.MethodGet, ordersPath, b.Token, nil)` becomes `status, body = call(t, http.MethodGet, ordersPath, b.Token, nil)`. The first SQL statement of the test (`image_key = 'products/old.png'`, before placement) stays.

`internal/app/orders_staff_test.go`, `TestStoreStaffOwnOrder`: the first `call` to `adminOrderPath(id)` with its `status != http.StatusOK` check is replaced by the block below, and the next line `status, body = call(t, http.MethodGet, storeOrdersPath(a.ID), staff, nil)` becomes `status, body := call(...)`. The values are those of the `orderIn` fixture.

```go
	got := readOrder(t, adminOrderPath(id), staff)
	if got.ID != id || got.StoreID != a.ID || got.Status != "placed" || got.CustomerName != "Asha" || got.CustomerPhone != "+919800000001" ||
		got.Address.Label != "Home" || got.Address.Line1 != "12 Test Rd" || got.Address.Pincode != "570000" ||
		got.SubtotalCents != 2000 || got.DeliveryFeeCents != 0 || got.TotalCents != 2000 {
		t.Fatalf("own order: %+v, want the placed fixture order of store %s for Asha, +919800000001, Home, 12 Test Rd, 570000, 2000 + 0 = 2000", got, a.ID)
	}
	if len(got.Items) != 1 || got.Items[0].ProductID != p || got.Items[0].Name != "Fixture" || got.Items[0].PriceCents != 1000 || got.Items[0].Quantity != 2 {
		t.Fatalf("own order items: %+v, want one line of 2 Fixture at 1000", got.Items)
	}
	if len(got.Events) != 1 || got.Events[0].ToStatus != "placed" || got.Events[0].ActorType != "customer" {
		t.Fatalf("own order events: %+v, want one placed event by the customer", got.Events)
	}
```

`internal/seed/seed_test.go`, `TestResetLoadsDemoOrders`: one line added before the `"cancelled orders with a reason and a time"` assertion:

```go
	assertSQL(t, "orders to the demo Home address", "select count(*) from orders o join addresses a on a.id = '00000000-0000-4000-8000-000000000301' where o.address_label = 'Home' and o.address_label = a.label and o.address_line1 = a.line1 and o.address_pincode = a.pincode", 3)
```

`internal/seed/seed_test.go`, `TestResetTwiceLeavesDemoStores`: one assertion added after `assertCount(t, "store_service_areas", 4)` (audit gaps: names, all four pincodes, `is_open`):

```go
	assertSQL(t, "open demo stores with their names and pincodes", `select count(*) from stores s join store_service_areas a on a.store_id = s.id
		where s.is_open and (s.id::text, s.name, a.pincode) in (
			('00000000-0000-4000-8000-000000000401', 'Koramangala', '560034'), ('00000000-0000-4000-8000-000000000401', 'Koramangala', '560095'),
			('00000000-0000-4000-8000-000000000402', 'Indiranagar', '560038'), ('00000000-0000-4000-8000-000000000402', 'Indiranagar', '560008'))`, 4)
```

## Ceilings and simplifications

- `Summary` is hand-written text, not built from the constants and SQL literals the inserts use. The test is what keeps the two equal. Upgrade when the demo set grows past what one screen shows: generate it from a table the inserts also read.
- `Summary` lists the first product and the product id range, not all 148, and no category ids (D20 names stores, products, addresses and orders only).
- "Local databases only" is a line of text. `seed-demo --reset` truncates whatever database the URL names. A host guard is deferred to the first deploy off a laptop (Spec 2 §14 has the same trigger for S3); it needs a decision on what "local" means under `make prod-local`.
- `stock` now imports `catalog` for one function. No cycle (`catalog` imports `store`, `httpx`, `pg`, `blob`). A later split into services turns it into a field the catalog service returns, as D24 already says of the join.
- The snapshot test still moves `image_key` by SQL: `PATCH /admin/products/{id}` has no image member, and the scenario names the price and the name only.
- `TestSummaryMatchesSeed` reads `docs/postman/local.postman_environment.json` by a relative path (four directories up from `internal/seed`). It breaks if the module or the file moves, which is the point.

## Files the change touches (all in `services/core/`, plus the two generated files of D19 and D23)

`queries/stock.sql`, `internal/stock/db/stock.sql.go` (generated), `internal/stock/handlers.go`, `internal/catalog/catalog.go`, `internal/app/stock_test.go`, `openapi.json`, `internal/seed/summary.go` (new), `internal/seed/seed.go` (comment), `internal/seed/seed_test.go`, `cmd/core-admin/main.go`, `cmd/core-admin/main_test.go`, `internal/app/orders_test.go`, `internal/app/orders_staff_test.go`; generated `packages/ui/src/api/core.d.ts`, `docs/postman/shopperstop-core.postman_collection.json`.
