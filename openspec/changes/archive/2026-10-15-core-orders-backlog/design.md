## Context

Orders are read through one function, `order.views` (`internal/order/order.go`), by every customer and staff route; `order.Place` (`internal/order/place.go`) already holds the store row (`store.ForPincode` returns `store.Store` with `Name` and `PromisedMinutes`) when it calls `db.CreateOrder`. The staff list `order.StoreList` (`internal/order/handlers.go`) filters by an optional `status` through `StoreOrders`/`CountStoreOrders` (`queries/order.sql`); since core-P3-L1 it is also open to the rider service's token (`?status=ready`). `staff.Dashboard` (`internal/staff/dashboard.go`) builds one `DashboardStore` per `store.Store`, which carries `IsOpen`. `stores.name` and `stores.promised_minutes` are NOT NULL (0003) and `orders.store_id` is a NOT NULL foreign key (0006), so every existing order can be backfilled.

Four places insert orders with raw SQL and must name the two new NOT NULL columns: `internal/seed/seed.go` (demo orders), `internal/seed/seed_test.go` (`SS-OTHERAAA`), `internal/order/schema_test.go` (`insertOrder`), `internal/app/orders_staff_test.go` (`orderIn`).

The whole design was spiked in the lane worktree on 061b010 (tree restored before the commit): `go vet` clean, the five new tests pass, every package suite green under `-race -count=1`; `make gen postman` writes `core.d.ts`, the Postman collection and the eight `models.go`; `make test-web` fails only on the three app fixtures named under "Cross-area" and passes once they carry the spread lines below (checked against both the old and the new `core.d.ts`).

## Goals / Non-Goals

**Goals:** a store's active orders in one call with `total`; the store's name and promise frozen on the order; the dashboard says whether each store is open; the rider service's access unchanged.

**Non-Goals:** staff names on staff events; the apps using the new fields; a page size above 100; an index for the active filter.

## Decisions

### 1. `active` accepts `true` only

Absent or empty: no filter (same as an empty `status=`, the L5 rule). `true`: the filter. Anything else (`false`, `TRUE`, `1`) is 400 field `active` "must be true"; `active=true` with a non-empty `status` is 400 field `active` "cannot be combined with status". `status` is parsed first, so `status=lost&active=true` is 400 field `status`. Why not `false` as "no filter": two spellings for one meaning, and `false` read as "only finished orders" is a plausible guess; refusing it keeps one meaning per value. Ceiling: a client wanting "finished orders" filters by `status` twice.

### 2. "One call" keeps the page-size cap

`httpx.Page` still caps `pageSize` at 100. The panel sends `active=true&pageSize=100`; a dark store has far fewer than 100 open orders at once. When `total` exceeds the items the panel can page (`page=2`), as on every list. Ceiling: more than 100 active orders at one store needs a second request.

### 3. The filter is a boolean parameter in the existing two queries

`and (not @active::boolean or status not in ('delivered', 'cancelled'))` on `StoreOrders` and `CountStoreOrders`; sqlc adds `Active bool` to both param structs. No new query, no new index: `orders_store_placed (store_id, placed_at desc, id desc)` already narrows to one store. The rider service's `?status=ready` passes `Active: false`, so its path is unchanged.

### 4. Store snapshot columns are NOT NULL, backfilled in the migration

Migration 0008 adds both columns nullable, fills them from `stores` with one `update ... from stores`, then sets both NOT NULL, in one file (the runner wraps each file in a transaction). Every order has a store (FK, NOT NULL) and both store columns are NOT NULL, so no row is left null. No default: an insert that forgets them fails instead of writing a wrong snapshot. The backfill fires `orders_updated_at`, so every existing order's `updated_at` moves to the migration time; nothing reads `orders.updated_at`. No check on `promised_minutes` (the store's own check already holds at copy time).

### 5. Placement copies from the store row it already has

`CreateOrder` gains `store_name` and `promised_minutes`; `Place` passes `s.Name` and `s.PromisedMinutes` from `store.ForPincode`, read in the same transaction. No extra query.

### 6. `storeName` and `promisedMinutes` are required in the contract; `isOpen` too

They are on every order and every dashboard entry, so `required` tells the apps they need no fallback. The demo seed writes `Koramangala`, 10 (the demo store's values) literally, as it already writes the customer and address snapshot literally.

### 7. The backfill test migrates a fresh schema to 0007, inserts, then to the latest

`TestBackfillStoreSnapshot` (`internal/order/schema_test.go`) opens its own schema with `testdb.Open("order_backfill")`, applies the embedded migrations below `0008` from a `fstest.MapFS`, inserts a customer, a store and an order with raw SQL, applies `migrations.FS`, and checks the values and `is_nullable`. It runs after the package's `TestMain` migrated, so `citext` already exists and the unlocked migration cannot race on `pg_extension`. Ceiling: the test re-proves 0008 only; a later migration that rewrites these columns needs its own.

### Cross-area: three app fixtures

`core.d.ts` makes the three members required, so object literals typed `Order` or `DashboardStore` without them fail `tsc`. Writing the members directly fails on main today (excess property TS2353), so each fix spreads them, which typechecks before and after this change (checked in the spike):

- `apps/web/src/test-data.ts`, in `order()`, after `storeId: '00000000-0000-4000-8000-000000000401',`: `...{ storeName: 'Koramangala', promisedMinutes: 10 },`
- `apps/admin/src/orders-fake.ts`, in `order()`, after `storeId: indiranagar.id,`: `...{ storeName: 'Indiranagar', promisedMinutes: 12 },`
- `apps/admin/src/dashboard.test.tsx` line 17 `atIndiranagar`: `...{ isOpen: true },` after `storeName: 'Indiranagar',`; `atKoramangala` (line 18 on): `...{ isOpen: true },` after `storeName: 'Koramangala',`

Each area may replace the spread with plain members once this change is on main.

## Code (verbatim, from the spike)

### `services/core/migrations/0008_order_store_snapshot.sql` (new)

```sql
-- Store snapshots on orders (D34): the store's name and promised minutes at placement.
-- Every order has a store, so existing rows are backfilled from it and both columns are NOT NULL.
alter table orders add column store_name text, add column promised_minutes integer;
update orders o set store_name = s.name, promised_minutes = s.promised_minutes from stores s where s.id = o.store_id;
alter table orders alter column store_name set not null, alter column promised_minutes set not null;
```

### `services/core/queries/order.sql`

`CreateOrder` becomes:

```sql
-- name: CreateOrder :one
insert into orders (number, customer_id, store_id, store_name, promised_minutes, customer_name, customer_phone,
                    address_label, address_line1, address_line2, address_pincode,
                    subtotal_cents, delivery_fee_cents, total_cents)
values (@number, @customer_id, @store_id, @store_name, @promised_minutes, @customer_name, @customer_phone,
        @address_label, @address_line1, @address_line2, @address_pincode,
        @subtotal_cents, @delivery_fee_cents, @total_cents)
returning id;
```

`StoreOrders` and `CountStoreOrders` become (Task 2):

```sql
-- name: StoreOrders :many
-- active keeps every order that is neither delivered nor cancelled.
select * from orders
where store_id = @store_id and (sqlc.narg(status)::order_status is null or status = sqlc.narg(status))
  and (not @active::boolean or status not in ('delivered', 'cancelled'))
order by placed_at desc, id desc
limit @lim offset @off;

-- name: CountStoreOrders :one
select count(*) from orders
where store_id = @store_id and (sqlc.narg(status)::order_status is null or status = sqlc.narg(status))
  and (not @active::boolean or status not in ('delivered', 'cancelled'));
```

Then `make gen` from the worktree root: sqlc rewrites every `internal/*/db/models.go` (shared schema; `db.Order` gains `StoreName string` and `PromisedMinutes int32`) and `internal/order/db/order.sql.go` (`CreateOrderParams.StoreName`, `.PromisedMinutes`; `StoreOrdersParams.Active`, `CountStoreOrdersParams.Active`). Commit all of them.

### `services/core/internal/order/order.go`

In `type Order`, after `StoreID`:

```go
	StoreName        string     `json:"storeName"`       // the store's name at placement
	PromisedMinutes  int32      `json:"promisedMinutes"` // the store's promise at placement
```

In `views`, the first line of the `Order{...}` literal becomes two:

```go
			ID: r.ID, Number: r.Number, StoreID: r.StoreID, StoreName: r.StoreName,
			PromisedMinutes: r.PromisedMinutes, Status: string(r.Status),
```

### `services/core/internal/order/place.go`

In `q.CreateOrder(ctx, db.CreateOrderParams{...})`:

```go
			Number: number, CustomerID: customerID, StoreID: storeID, StoreName: s.Name, PromisedMinutes: s.PromisedMinutes,
```

### `services/core/internal/order/handlers.go` (Task 2)

`StoreList`'s comment:

```go
// StoreList answers 200 with one page of a store's orders, newest first, optionally
// only those in one status, or with active=true only those neither delivered nor
// cancelled. Store staff of another store and an unknown store are 404.
```

After the `status` block and before `httpx.Page(r)`:

```go
		active, err := activeParam(r, status != nil)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
```

The two queries take `Active: active`:

```go
			StoreID: id, Status: status, Active: active, Off: int32((page - 1) * pageSize), Lim: int32(pageSize),
```

```go
		total, err := q.CountStoreOrders(ctx, db.CountStoreOrdersParams{StoreID: id, Status: status, Active: active})
```

New function, before `AdminGet`:

```go
// activeParam reads the store list's active filter: absent or empty is false,
// "true" is true, and any other value, or true with a status, is 400 field active.
func activeParam(r *http.Request, withStatus bool) (bool, error) {
	switch r.URL.Query().Get("active") {
	case "":
		return false, nil
	case "true":
		if withStatus {
			return false, invalid("active", "cannot be combined with status")
		}
		return true, nil
	default:
		return false, invalid("active", "must be true")
	}
}
```

### `services/core/internal/staff/dashboard.go` (Task 2)

```go
// DashboardStore is one store's line of the dashboard: whether it is open, today's
// orders by status, the low-stock count and today's delivered revenue.
type DashboardStore struct {
	StoreID           string           `json:"storeId"`
	StoreName         string           `json:"storeName"`
	IsOpen            bool             `json:"isOpen"`
	OrdersToday       map[string]int64 `json:"ordersToday"` // seven keys
	LowStockCount     int64            `json:"lowStockCount"`
	RevenueTodayCents int64            `json:"revenueTodayCents"`
}
```

and in `Dashboard`:

```go
				StoreID: st.ID, StoreName: st.Name, IsOpen: st.IsOpen, OrdersToday: byStatus,
```

### `services/core/internal/seed/seed.go`

Statement 1 of the demo orders names the two columns after `store_id` and gives each of the three rows `'Koramangala', 10` after `$2`:

```sql
insert into orders (id, number, customer_id, store_id, store_name, promised_minutes, status, customer_name, customer_phone,
                    address_label, address_line1, address_pincode,
                    subtotal_cents, delivery_fee_cents, total_cents, placed_at, delivered_at, cancelled_at, cancel_reason)
values
  ('00000000-0000-4000-8000-000000000701', 'SS-DEMOAAAB', $1, $2, 'Koramangala', 10, 'delivered', 'Demo Customer', '+919800000000',
   ...
  ('00000000-0000-4000-8000-000000000702', 'SS-DEMOAAAC', $1, $2, 'Koramangala', 10, 'cancelled', 'Demo Customer', '+919800000000',
   ...
  ('00000000-0000-4000-8000-000000000703', 'SS-DEMOAAAD', $1, $2, 'Koramangala', 10, 'placed', 'Demo Customer', '+919800000000',
   ...
```

(the `...` lines are unchanged).

## Tests (verbatim, from the spike)

### Fixture inserts (Task 1, in the `feat:` commit with the migration: before 0008 the columns do not exist)

- `internal/order/schema_test.go` `insertOrder`: columns `number, customer_id, store_id, store_name, promised_minutes, customer_name, ...`, values `($1, $2, $3, 'Test store', 10, 'Asha', ...`.
- `internal/app/orders_staff_test.go` `orderIn`: columns `number, customer_id, store_id, store_name, promised_minutes, status, ...`, values `($1, $2, $3, 'Test store', 10, $4::order_status, ...`.
- `internal/seed/seed_test.go` (`SS-OTHERAAA`): columns `number, customer_id, store_id, store_name, promised_minutes, customer_name, ...`, values `('SS-OTHERAAA', '00000000-0000-4000-8000-000000000999', $1, 'Koramangala', 10, 'Other', ...`.

### `internal/app/orders_test.go` (Task 1)

`orderView`, after `StoreID` (gofmt realigns the block):

```go
	// StoreName and PromisedMinutes are the store's values at placement.
	StoreName       string `json:"storeName"`
	PromisedMinutes int32  `json:"promisedMinutes"`
```

Appended:

```go
// TestOrderStoreSnapshot: an order keeps the store's name and promised minutes
// from placement, on the customer's and the staff's reads, after the store changes.
func TestOrderStoreSnapshot(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 5000)
	stockTo(t, s.ID, p, 5)
	b := newBuyer(t, s.Pincode)
	setLine(t, b.Token, s.ID, p, 1)
	placed := mustPlace(t, b)
	if placed.StoreName != "Test store" || placed.PromisedMinutes != 10 {
		t.Fatalf("placement: storeName %q, promisedMinutes %d; want Test store, 10", placed.StoreName, placed.PromisedMinutes)
	}

	token := adminToken(t)
	if status, body := call(t, http.MethodPatch, adminStoresPath+"/"+s.ID, token, map[string]any{"name": "Renamed store", "promisedMinutes": 25}); status != http.StatusOK {
		t.Fatalf("PATCH store: got %d %s, want 200", status, body)
	}

	for _, read := range []struct{ path, token string }{
		{ordersPath + "/" + placed.ID, b.Token},
		{adminOrderPath(placed.ID), token},
	} {
		if o := readOrder(t, read.path, read.token); o.StoreName != "Test store" || o.PromisedMinutes != 10 {
			t.Fatalf("GET %s: storeName %q, promisedMinutes %d; want Test store, 10", read.path, o.StoreName, o.PromisedMinutes)
		}
	}
	status, body := call(t, http.MethodGet, ordersPath, b.Token, nil)
	var l orderListView
	if status != http.StatusOK || json.Unmarshal(body, &l) != nil || len(l.Items) != 1 || l.Items[0].StoreName != "Test store" || l.Items[0].PromisedMinutes != 10 {
		t.Fatalf("GET /orders: got %d %s, want the one order with Test store, 10", status, body)
	}
}
```

### `internal/order/schema_test.go` (Task 1)

Imports gain `"io/fs"`, `"testing/fstest"`, `.../internal/migrate` and `.../migrations`. Appended:

```go
// TestBackfillStoreSnapshot: migration 0008 fills an existing order's store_name
// and promised_minutes from its store, and both columns are NOT NULL after it.
func TestBackfillStoreSnapshot(t *testing.T) {
	ctx := context.Background()
	pool, cleanup := testdb.Open("order_backfill")
	defer cleanup()

	before := fstest.MapFS{}
	entries, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if e.Name() >= "0008" {
			continue
		}
		b, err := fs.ReadFile(migrations.FS, e.Name())
		if err != nil {
			t.Fatal(err)
		}
		before[e.Name()] = &fstest.MapFile{Data: b}
	}
	if _, err := migrate.Apply(ctx, pool, before); err != nil {
		t.Fatalf("migrate to 0007: %v", err)
	}

	var customerID, storeID, orderID string
	if err := pool.QueryRow(ctx, `insert into customers (email, password_hash, name) values ('backfill@test.local', 'x', 'Asha') returning id`).Scan(&customerID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `insert into stores (name, address_line, pincode, promised_minutes) values ('Backfill store', '1 Test Rd', '570000', 17) returning id`).Scan(&storeID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx,
		`insert into orders (number, customer_id, store_id, customer_name, address_label, address_line1, address_pincode, subtotal_cents, delivery_fee_cents, total_cents)
		 values ('SS-BACKFILL', $1, $2, 'Asha', 'Home', '1 Test Rd', '570000', 1000, 0, 1000) returning id`,
		customerID, storeID).Scan(&orderID); err != nil {
		t.Fatal(err)
	}

	if _, err := migrate.Apply(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("migrate to the latest: %v", err)
	}
	var name string
	var minutes int32
	if err := pool.QueryRow(ctx, "select store_name, promised_minutes from orders where id = $1", orderID).Scan(&name, &minutes); err != nil {
		t.Fatal(err)
	}
	if name != "Backfill store" || minutes != 17 {
		t.Fatalf("backfilled %q, %d; want Backfill store, 17", name, minutes)
	}
	var nullable int
	if err := pool.QueryRow(ctx,
		`select count(*) from information_schema.columns
		 where table_schema = current_schema() and table_name = 'orders'
		   and column_name in ('store_name', 'promised_minutes') and is_nullable = 'YES'`).Scan(&nullable); err != nil {
		t.Fatal(err)
	}
	if nullable != 0 {
		t.Fatalf("%d of store_name and promised_minutes are nullable, want none", nullable)
	}
}
```

Before 0008 exists the second `Apply` applies nothing and the `select` fails on the missing column: that is the red.

### `internal/seed/seed_test.go` (Task 1)

Before `assertSQL(t, "cancelled orders with a reason and a time", ...)`:

```go
	assertSQL(t, "orders with the Koramangala snapshot", "select count(*) from orders where store_name = 'Koramangala' and promised_minutes = 10", 3)
```

### `internal/app/orders_staff_test.go` (Task 2)

Imports gain `"slices"`. Appended:

```go
// TestStoreOrdersActive: active=true lists every order that is neither delivered
// nor cancelled, newest first, with total counting all of them; it refuses any
// other value and a status beside it.
func TestStoreOrdersActive(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	var active []string // newest first
	for _, st := range []string{"placed", "delivered", "packing", "cancelled", "ready", "out_for_delivery"} {
		id := orderIn(t, s.ID, c.Customer.ID, p, st)
		if st != "delivered" && st != "cancelled" {
			active = append([]string{id}, active...)
		}
	}
	token := adminToken(t)
	list := func(query string) (int, []byte) {
		return call(t, http.MethodGet, storeOrdersPath(s.ID)+query, token, nil)
	}

	status, body := list("?active=true&pageSize=100")
	var board orderListView
	if status != http.StatusOK || json.Unmarshal(body, &board) != nil {
		t.Fatalf("active board: got %d %s, want 200", status, body)
	}
	got := make([]string, len(board.Items))
	for i, o := range board.Items {
		got[i] = o.ID
	}
	if board.Total != 4 || !slices.Equal(got, active) {
		t.Fatalf("active board: total %d, ids %v; want 4, %v", board.Total, got, active)
	}

	status, body = list("?active=true&pageSize=2")
	if status != http.StatusOK || json.Unmarshal(body, &board) != nil || board.Total != 4 || len(board.Items) != 2 {
		t.Fatalf("active board page of 2: got %d %s, want 200 with total 4 and two items", status, body)
	}

	status, body = list("?active=")
	if status != http.StatusOK || json.Unmarshal(body, &board) != nil || board.Total != 6 {
		t.Fatalf("empty active: got %d %s, want 200 with total 6", status, body)
	}

	for _, q := range []string{"?active=false", "?active=TRUE", "?active=1", "?active=true&status=placed"} {
		status, body = list(q)
		expectError(t, "list"+q, status, body, http.StatusBadRequest, "validation", "active", "")
	}
}
```

### `internal/app/dashboard_test.go` (Task 2)

`dashboardStoreView`, after `StoreName`:

```go
	IsOpen            bool             `json:"isOpen"`
```

Appended:

```go
// TestDashboardIsOpen: each entry carries the store's open switch.
func TestDashboardIsOpen(t *testing.T) {
	s := newShop(t)
	token := adminToken(t)
	if e := dashboardEntry(t, token, s.ID); !e.IsOpen {
		t.Fatalf("open store: isOpen false, want true")
	}
	if status, body := call(t, http.MethodPatch, adminStoresPath+"/"+s.ID, token, map[string]any{"isOpen": false}); status != http.StatusOK {
		t.Fatalf("close store: got %d %s, want 200", status, body)
	}
	if e := dashboardEntry(t, token, s.ID); e.IsOpen {
		t.Fatalf("closed store: isOpen true, want false")
	}
}
```

## `openapi.json` edits

`openapi.json` round-trips byte for byte through Python's `json` (`indent=2, ensure_ascii=False`, trailing newline), so the edits are two scripts run once from `services/core` with `python3 - <<'E' ... E` and never committed. Node's `JSON.stringify` reorders the numeric response keys: do not use it.

Task 1 (Order schema and every Order example):

```python
import json

def after(d, key, new):
    out = {}
    for k, v in d.items():
        out[k] = v
        if k == key:
            out.update(new)
    return out

def walk(x):
    if isinstance(x, dict):
        for k, v in list(x.items()):
            x[k] = walk(v)
        if 'placedAt' in x and 'number' in x:  # an Order example
            return after(x, 'storeId', {'storeName': 'Koramangala', 'promisedMinutes': 10})
        return x
    if isinstance(x, list):
        return [walk(v) for v in x]
    return x

d = json.load(open('openapi.json'))
d['paths'] = walk(d['paths'])
o = d['components']['schemas']['Order']
o['required'].insert(o['required'].index('storeId') + 1, 'storeName')
o['required'].insert(o['required'].index('storeName') + 1, 'promisedMinutes')
o['properties'] = after(o['properties'], 'storeId', {
    'storeName': {'type': 'string', 'description': "The store's name at placement."},
    'promisedMinutes': {'type': 'integer', 'minimum': 1, 'description': "The store's promised delivery minutes at placement."},
})
open('openapi.json', 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
```

It touches eight examples (all at store `...0401`, Koramangala, 10 minutes).

Task 2 (the `active` parameter, the 400 text, `DashboardStore.isOpen`):

```python
import json

def after(d, key, new):
    out = {}
    for k, v in d.items():
        out[k] = v
        if k == key:
            out.update(new)
    return out

def walk(x):
    if isinstance(x, dict):
        for k, v in list(x.items()):
            x[k] = walk(v)
        if 'revenueTodayCents' in x and 'storeName' in x:  # a DashboardStore example
            return after(x, 'storeName', {'isOpen': True})
        return x
    if isinstance(x, list):
        return [walk(v) for v in x]
    return x

d = json.load(open('openapi.json'))
d['paths'] = walk(d['paths'])
ds = d['components']['schemas']['DashboardStore']
ds['required'].insert(ds['required'].index('storeName') + 1, 'isOpen')
ds['properties'] = after(ds['properties'], 'storeName', {
    'isOpen': {'type': 'boolean', 'description': 'Whether the store takes orders now.'},
})
dash = d['paths']['/admin/dashboard']['get']
dash['description'] = dash['description'].replace(
    'lowStockCount counts', "isOpen is the store's open switch. lowStockCount counts")
op = d['paths']['/admin/stores/{id}/orders']['get']
op['description'] = op['description'].replace(
    'empty or absent keeps every status, and any other value answers 400 naming status.',
    'empty or absent keeps every status, and any other value answers 400 naming status. '
    'active=true keeps every order that is neither delivered nor cancelled, in one list with its total; '
    'any other active value, or active=true with a status, answers 400 naming active.')
params = op['parameters']
i = next(n for n, p in enumerate(params) if p['name'] == 'status')
params.insert(i + 1, {
    'name': 'active',
    'in': 'query',
    'required': False,
    'description': 'true keeps every order that is not delivered or cancelled. Only true is accepted; absent or empty keeps every status. Not with status.',
    'schema': {'type': 'string', 'enum': ['true']},
    'example': 'true',
})
op['responses']['400']['description'] = (
    'The 400 is for an unknown status value, an active value other than true, '
    'active=true with a status, or a page below 1 or a pageSize outside 1 to 100. The field names it.')
open('openapi.json', 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
```

After each script: `make gen postman` from the worktree root, and commit `openapi.json`, `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json` with the code.

## Risks / Trade-offs

- [Required members break typed app fixtures] → the three spread lines land in web and admin first; Task 1 and Task 2 note it and stop at `make test-web` if those files are still unchanged on main.
- [Backfill rewrites `updated_at` on every order] → no reader; accepted.
- [More than 100 active orders at one store] → second page; named ceiling.
- [The rider service decodes `Order`] → two new members; JSON decoders ignore unknown members by default in Go. Not on main yet.
