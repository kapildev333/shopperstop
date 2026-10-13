# Design

## Context
Builds on core-P2-L1 `core-accounts-auth` (migration 0002, `sqlc.yaml`, `internal/pg` `Map`/`IsUnique`, `testdb.Migrated`, `httpx` `ReadPatch`/`Page`/`NewList`/`PathID`, `auth` `RequireCustomer`/`RequireStaff`/`CurrentStaff`/`CustomerID`, `seed.Reset`/`Load`, `app.New(pool, origins, a)`, the contract and security tests, Decision 22's fixed-id blocks), core-P2-L2 `core-stores-serviceability` (migration 0003 `stores`, `internal/store`) and core-P2-L3 `core-catalog` (migration 0004 `categories`, `products`, `internal/catalog`). This branch is rebased onto all three before task 1 starts. Behaviour comes from this change's deltas (`stock`, `cart`, `catalog`, and one MODIFIED requirement in `admin-catalog`, Decision 18). Constraints: chi, pgx v5, sqlc v1.31.1 output, stdlib; tests on the real `shopperstop_core_test` database through `testdb.Migrated`, no mocks; PLAN.md D7 (display cap 10), D19 and D23 (regenerate `core.d.ts` and the Postman collection in the same PR), D20 (bearer `security`, `/admin/` prefix, fixed demo ids in examples), D22 (seed grows per lane).

A spike on 2026-10-12 (copy of the module with L1's 0002, L2's spiked 0003, L3's 0004 and `queries/catalog.sql` with its handover queries, sqlc v1.31.1, the real test database) confirmed the migration, both query files and the `sqlc.yaml` entries below verbatim: they generate and compile; 20 rounds of two transactions racing for the last unit gave exactly one success each and quantity 0; 20 rounds of opposite-order reservations never deadlocked; an unknown product in the upsert is `23503` `store_stock_product_id_fkey`; a negative quantity is `23514` `store_stock_quantity_check`; the same product twice in one upsert is `21000`; quantity 21 in a cart line is `23514` `cart_items_quantity_check`; deleting a product with stock rows cascades; the seed statement gives 150 products 10 zeros and 10 low counts per store; `StoreCategories` hides a child whose products are all at 0 and a parent whose only stocked product is inactive; `StoreProductsByID` returns inactive products with their quantity; the stock search escapes `%` literally. Workers copy these; they do not redesign them.

### Assumptions about L2 and L3 (from their change folders and lane logs, 2026-10-12)
- `stores` and `internal/store`, confirmed by core-P2-L2's lane log (2026-10-12): `store.Get(ctx, q db.DBTX, id) (store.Store, error)` answering 404 `not_found` when absent, `Store` with `DeliveryFeeCents`, `FreeDeliveryAboveCents`, `MinOrderCents int64` and `IsOpen`; demo stores Koramangala `00000000-0000-4000-8000-000000000401` and Indiranagar `...0402`, both fee 2500, free above 19900, minimum 9900 (the cart scenarios use the same numbers). L2 recommends `on delete cascade` on `store_stock.store_id` and `carts.store_id`, as below.
- `categories`, `products` and `internal/catalog` (core-P2-L3, PLAN.md D24): this change owns the three customer-facing catalog routes end to end (`GET /stores/{id}/categories`, `/stores/{id}/products`, `/stores/{id}/products/{slug}`); L3 ships no store-facing handler, requirement or customer product type, and there is no interim stockless version. This design relies on L3 only for what its admin routes need anyway: the 0004 tables (`categories`, `products` as spiked there), the Go types `catalog.Category` / `catalog.CategoryNode` and their tree assembly (`tree` in L3's names), the unexported helpers `pattern` (escaped `ilike` pattern) and `imageURL`, the `CategoryTree` schema in `openapi.json`, and `app.New(pool, origins, a, files)`. Everything else for the customer-facing routes is this change's: `internal/catalog/store.go` (new file, task 2), `catalog.StoreProduct`, the five queries below, the schemas `StoreProduct` and `StoreProductList`. If L3's amended lane log names a helper differently, the worker uses that name; if a helper is absent, the worker writes it in `store.go`. Demo catalog (L3): 148 products `...0601` to `...0694`, `...0601` `Banana Robusta` slug `banana-robusta`, `...0694` inactive.
- Fixed demo ids (D20, L1 Decision 22 blocks): stores `...0401`, `...0402` (L2), products `...0601` to `...0694` (L3). Examples in `openapi.json` use store `...0401`, product `...0601`, slug `banana-robusta`.
- If L2 or L3 change these names before the rebase, workers use the landed names and note it in the lane log; the behaviour in the deltas does not change.

## Goals / Non-Goals
**Goals:** every scenario in the four deltas has a Go test; web gets the store-facing catalog and the cart, admin the Stock page; core-P2-L5 gets `stock.Reserve`, `stock.Release`, `stock.LowCount`, `cart.Lines`, `cart.Clear` and can place, cancel and count without SQL on `store_stock` or `carts`.

**Non-Goals:** order placement and its HTTP error envelope for `out_of_stock` (L5), stock history, holding stock for a cart, guest carts on the server, a configurable low-stock threshold, image fields on stock rows (the admin Stock table shows product, unit, price, quantity, Spec 2 §8).

## Files (all in `services/core/` unless noted)
```
migrations/0005_stock_cart.sql            schema below, verbatim
sqlc.yaml                                 two entries appended (stock, cart)
queries/stock.sql, queries/cart.sql       verbatim below
queries/catalog.sql                       five customer-facing queries appended (tasks 2, 3)
internal/stock/db/*, internal/cart/db/*   sqlc output, never hand-edited; internal/catalog/db regenerated
internal/stock/stock.go                   Line, OutOfStockError, Reserve, Release, Quantity, LowCount
internal/stock/handlers.go                Row, List, Put, canSee
internal/stock/stock_test.go              Go API against the database
internal/catalog/store.go                 new: StoreProduct, ProductsByID, StoreCategories, StoreProducts, StoreProductBySlug handlers (tasks 2, 3)
internal/catalog/store_test.go            ProductsByID against the database
internal/cart/cart.go                     Cart, Line, Update, view, Lines, Clear
internal/cart/handlers.go                 Get, PutItem, Delete
internal/cart/cart_test.go                Lines, Clear
internal/seed/seed.go, seed_test.go       truncate list and demo stock
internal/app/app.go                       eight routes
internal/app/stock_test.go, catalog_store_test.go, cart_test.go, accounts_test.go (TestAuthGates rows)
openapi.json
packages/ui/src/api/core.d.ts                          make gen (D19)
docs/postman/shopperstop-core.postman_collection.json  make postman (D23)
```

## Schema: `migrations/0005_stock_cart.sql` (verbatim)
```sql
-- Stock per store and product; one open cart per customer with its lines.
create table store_stock (
    id         uuid primary key default gen_random_uuid(),
    store_id   uuid not null references stores (id) on delete cascade,
    product_id uuid not null references products (id) on delete cascade,
    quantity   integer not null check (quantity >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (store_id, product_id)
);
create trigger store_stock_updated_at before update on store_stock for each row execute function set_updated_at();

create table carts (
    id          uuid primary key default gen_random_uuid(),
    customer_id uuid not null unique references customers (id) on delete cascade,
    store_id    uuid not null references stores (id) on delete cascade,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create trigger carts_updated_at before update on carts for each row execute function set_updated_at();

create table cart_items (
    id         uuid primary key default gen_random_uuid(),
    cart_id    uuid not null references carts (id) on delete cascade,
    product_id uuid not null references products (id) on delete cascade,
    quantity   integer not null check (quantity between 1 and 20),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (cart_id, product_id)
);
create trigger cart_items_updated_at before update on cart_items for each row execute function set_updated_at();
```
Cascades: deleting a store drops its stock and carts (L2 allows store delete only with no orders); deleting a product drops its stock rows and cart lines (L3 allows product delete only when never ordered; `order_items` restricts, L5). No extra index: `unique (store_id, product_id)` serves every stock lookup and `unique (cart_id, product_id)` every line lookup.

## sqlc: two entries appended to `sqlc.yaml` (verbatim)
```yaml
  - engine: postgresql
    schema: migrations
    queries: queries/stock.sql
    gen:
      go:
        package: db
        out: internal/stock/db
        sql_package: pgx/v5
        emit_pointers_for_null_types: true
        overrides:
          - db_type: uuid
            go_type: string
          - db_type: uuid
            nullable: true
            go_type:
              type: string
              pointer: true
  - engine: postgresql
    schema: migrations
    queries: queries/cart.sql
    gen:
      go:
        package: db
        out: internal/cart/db
        sql_package: pgx/v5
        emit_pointers_for_null_types: true
        overrides:
          - db_type: uuid
            go_type: string
          - db_type: uuid
            nullable: true
            go_type:
              type: string
              pointer: true
```

### `queries/stock.sql` (verbatim)
```sql
-- name: ListStock :many
-- Every active product with its quantity at the store (0 without a row).
-- Reads products (catalog's table) read-only: design Decision 1.
select p.id as product_id, p.name, p.brand, p.unit_label, p.price_cents,
       coalesce(s.quantity, 0)::integer as quantity
from products p
left join store_stock s on s.product_id = p.id and s.store_id = @store_id
where p.is_active
  and (@pattern::text = '' or p.name ilike @pattern or p.brand ilike @pattern)
  and (not @low_stock::boolean or coalesce(s.quantity, 0) < 5)
order by p.name, p.id
limit @lim offset @off;

-- name: CountStock :one
select count(*)
from products p
left join store_stock s on s.product_id = p.id and s.store_id = @store_id
where p.is_active
  and (@pattern::text = '' or p.name ilike @pattern or p.brand ilike @pattern)
  and (not @low_stock::boolean or coalesce(s.quantity, 0) < 5);

-- name: UpsertStock :exec
insert into store_stock (store_id, product_id, quantity)
select @store_id::uuid, unnest(@product_ids::uuid[]), unnest(@quantities::integer[])
on conflict (store_id, product_id) do update set quantity = excluded.quantity;

-- name: Quantity :one
select quantity from store_stock where store_id = $1 and product_id = $2;

-- name: LockStock :many
-- Locks the store's stock rows for these products in product id order (deadlock-free).
select s.product_id, s.quantity, p.is_active
from store_stock s join products p on p.id = s.product_id
where s.store_id = @store_id and s.product_id = any(@product_ids::uuid[])
order by s.product_id
for update of s;

-- name: AddStock :exec
-- Adds each delta (negative to take) to the locked rows.
update store_stock s set quantity = s.quantity + d.delta
from (select unnest(@product_ids::uuid[]) as product_id, unnest(@deltas::integer[]) as delta) d
where s.store_id = @store_id and s.product_id = d.product_id;
```
(sqlc rejects `from unnest(a, b) as r(x, y)`; two `unnest` calls in one select list zip arrays of equal length, which the Go callers guarantee.) Generated: `ListStockParams{StoreID, Pattern string; LowStock bool; Off, Lim int32}`, `QuantityParams{StoreID, ProductID string}`, `ListStockRow{ProductID, Name, Brand, UnitLabel string; PriceCents int64; Quantity int32}`, `UpsertStockParams{StoreID string; ProductIds []string; Quantities []int32}`, `LockStockRow{ProductID string; Quantity int32; IsActive bool}`, `AddStockParams{StoreID string; ProductIds []string; Deltas []int32}`.

### `queries/cart.sql` (verbatim)
```sql
-- name: CartByCustomer :one
select id, store_id from carts where customer_id = $1;

-- name: EnsureCart :exec
insert into carts (customer_id, store_id) values ($1, $2)
on conflict (customer_id) do nothing;

-- name: LockCart :one
select id, store_id from carts where customer_id = $1 for update;

-- name: ClearCart :exec
delete from cart_items where cart_id = $1;

-- name: MoveCart :exec
update carts set store_id = $2 where id = $1;

-- name: CartItems :many
select product_id, quantity from cart_items where cart_id = $1 order by created_at, product_id;

-- name: SetCartItem :exec
insert into cart_items (cart_id, product_id, quantity) values ($1, $2, $3)
on conflict (cart_id, product_id) do update set quantity = excluded.quantity;

-- name: DeleteCartItem :exec
delete from cart_items where cart_id = $1 and product_id = $2;

-- name: DeleteEmptyCart :exec
delete from carts c where c.id = $1 and not exists (select 1 from cart_items i where i.cart_id = c.id);

-- name: DeleteCart :exec
delete from carts where customer_id = $1;
```

### Appended to `queries/catalog.sql` (tasks 2 and 3, verbatim; first drafted by L3, spiked here against 0005)
```sql
-- name: StoreCategories :many
select c.* from categories c
where exists (
    select 1 from products p join store_stock s on s.product_id = p.id
    where s.store_id = @store_id and s.quantity > 0 and p.is_active
      and (p.category_id = c.id or p.category_id in (select k.id from categories k where k.parent_id = c.id)))
order by c.sort_order, c.name, c.id;

-- name: StoreProducts :many
select p.id, p.name, p.slug, p.description, p.brand, p.unit_label, p.mrp_cents, p.price_cents,
       p.category_id, p.image_key, coalesce(s.quantity, 0)::integer as quantity
from products p
left join store_stock s on s.product_id = p.id and s.store_id = @store_id
where p.is_active
  and (sqlc.narg(pattern)::text is null or p.name ilike sqlc.narg(pattern) or p.brand ilike sqlc.narg(pattern))
  and (sqlc.narg(category_id)::uuid is null
       or p.category_id = sqlc.narg(category_id)
       or p.category_id in (select c.id from categories c where c.parent_id = sqlc.narg(category_id)))
order by p.name, p.id
limit @page_size offset @page_offset;

-- name: CountStoreProducts :one
select count(*) from products p
where p.is_active
  and (sqlc.narg(pattern)::text is null or p.name ilike sqlc.narg(pattern) or p.brand ilike sqlc.narg(pattern))
  and (sqlc.narg(category_id)::uuid is null
       or p.category_id = sqlc.narg(category_id)
       or p.category_id in (select c.id from categories c where c.parent_id = sqlc.narg(category_id)));

-- name: StoreProductBySlug :one
select p.id, p.name, p.slug, p.description, p.brand, p.unit_label, p.mrp_cents, p.price_cents,
       p.category_id, p.image_key, coalesce(s.quantity, 0)::integer as quantity
from products p
left join store_stock s on s.product_id = p.id and s.store_id = @store_id
where p.slug = @slug and p.is_active;

-- name: StoreProductsByID :many
-- Active and inactive products by id with their quantity at the store, for the cart.
select p.id, p.name, p.slug, p.description, p.brand, p.unit_label, p.mrp_cents, p.price_cents,
       p.category_id, p.image_key, p.is_active, coalesce(s.quantity, 0)::integer as quantity
from products p
left join store_stock s on s.product_id = p.id and s.store_id = @store_id
where p.id = any(@ids::uuid[]);
```
Generated: `StoreProductsRow`, `StoreProductBySlugRow` carry the product columns plus `Quantity int32`; `StoreProductsByIDRow` also `IsActive bool`; `StoreCategories` returns `db.Category`.

## Interfaces
```go
// internal/stock
type Line struct {
    ProductID string
    Quantity  int32 // at least 1
}
type OutOfStockError struct{ ProductIDs []string } // ascending
func (e *OutOfStockError) Error() string           // "out of stock"
// Reserve locks the store's rows for lines' products (LockStock, product id order), and either
// takes every quantity (AddStock with negative deltas) or returns *OutOfStockError naming every
// product that is inactive, has no row, or has less than asked, taking nothing. Lines naming the
// same product are summed first (as landed, t1 review); a Quantity below 1 is a caller bug and
// comes back as a plain error before any query; empty lines is a no-op. Other errors come back unchanged.
func Reserve(ctx context.Context, tx pgx.Tx, storeID string, lines []Line) error
// Release adds lines' quantities back (AddStock with positive deltas). Missing rows are skipped;
// duplicate lines are summed and a Quantity below 1 is refused, as in Reserve.
func Release(ctx context.Context, tx pgx.Tx, storeID string, lines []Line) error
// Quantity answers the stored quantity of one product at the store; no row is 0. For the cart's clamp.
func Quantity(ctx context.Context, d db.DBTX, storeID, productID string) (int32, error)
// LowCount answers how many active products have quantity below 5 at the store (no row counts). For L5's dashboard.
func LowCount(ctx context.Context, d db.DBTX, storeID string) (int64, error)
func List(pool *pgxpool.Pool) http.HandlerFunc // GET /admin/stores/{id}/stock
func Put(pool *pgxpool.Pool) http.HandlerFunc  // PUT /admin/stores/{id}/stock
type Row struct {
    ProductID  string `json:"productId"`
    Name       string `json:"name"`
    Brand      string `json:"brand,omitempty"`
    UnitLabel  string `json:"unitLabel"`
    PriceCents int64  `json:"priceCents"`
    Quantity   int32  `json:"quantity"`
}

// internal/catalog/store.go (tasks 2 and 3; new file owned by this change)
type StoreProduct struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Slug        string `json:"slug"`
    Description string `json:"description,omitempty"`
    Brand       string `json:"brand,omitempty"`
    UnitLabel   string `json:"unitLabel"`
    MrpCents    int64  `json:"mrpCents"`
    PriceCents  int64  `json:"priceCents"`
    CategoryID  string `json:"categoryId"`
    ImageURL    string `json:"imageUrl,omitempty"` // imageURL(image_key)
    InStock     bool   `json:"inStock"`            // active and stored quantity above 0
    Quantity    int32  `json:"quantity"`           // min(stored, 10); 0 when inactive
    Active      bool   `json:"-"`                  // for the cart's validation
}
// ProductsByID answers active and inactive products by id with their stock at the store (StoreProductsByID);
// unknown ids are absent. For the cart.
func ProductsByID(ctx context.Context, d db.DBTX, storeID string, ids []string) (map[string]StoreProduct, error)
// handlers, plain functions like stock's (no dependency on L3's *Catalog):
func StoreProducts(pool *pgxpool.Pool) http.HandlerFunc       // GET /stores/{id}/products
func StoreProductBySlug(pool *pgxpool.Pool) http.HandlerFunc  // GET /stores/{id}/products/{slug}
func StoreCategories(pool *pgxpool.Pool) http.HandlerFunc     // GET /stores/{id}/categories

// internal/cart
type Line struct {
    Product  catalog.StoreProduct `json:"product"`
    Quantity int32                `json:"quantity"`
}
type Cart struct {
    StoreID          string `json:"storeId,omitempty"`
    Items            []Line `json:"items"` // never nil
    SubtotalCents    int64  `json:"subtotalCents"`
    DeliveryFeeCents int64  `json:"deliveryFeeCents"`
    TotalCents       int64  `json:"totalCents"`
    MinOrderCents    int64  `json:"minOrderCents"`
    ShortfallCents   int64  `json:"shortfallCents"`
}
type Update struct {
    Cart
    Replaced bool `json:"replaced"`
    Clamped  bool `json:"clamped"`
}
// Lines locks the customer's cart (LockCart) inside the placement transaction and answers its
// store and lines; no cart answers "", nil, nil. For L5.
func Lines(ctx context.Context, tx pgx.Tx, customerID string) (storeID string, lines []stock.Line, err error)
// Clear deletes the customer's cart and lines (DeleteCart); no cart is not an error. For L5 and DELETE /me/cart.
func Clear(ctx context.Context, d db.DBTX, customerID string) error
func Get(pool *pgxpool.Pool) http.HandlerFunc     // GET /me/cart
func PutItem(pool *pgxpool.Pool) http.HandlerFunc // PUT /me/cart/items
func Delete(pool *pgxpool.Pool) http.HandlerFunc  // DELETE /me/cart
```
`db.DBTX` is each package's sqlc interface; `*pgxpool.Pool` and `pgx.Tx` satisfy all of them, so callers pass either.

Imports (no cycles): `cart` → `catalog`, `store`, `stock`, `auth`, `httpx`, `pg`; `catalog` → `store` (tasks 2, 3); `stock` → `store`, `auth`, `httpx`, `pg`. `catalog` and `stock` do not import each other; `store` imports none of these.

## Routes (`internal/app.New`, flat full paths under `/api/core/v1`)
| Method and path | Middleware | Handler | Tag | Answers |
|---|---|---|---|---|
| GET /stores/{id}/categories | none | `catalog.StoreCategories(pool)` | catalog | 200 CategoryTree, 404 |
| GET /stores/{id}/products | none | `catalog.StoreProducts(pool)` | catalog | 200 StoreProductList, 400, 404 |
| GET /stores/{id}/products/{slug} | none | `catalog.StoreProductBySlug(pool)` | catalog | 200 StoreProduct, 404 |
| GET /admin/stores/{id}/stock | RequireStaff | `stock.List(pool)` | stock | 200 StockList, 400, 401, 404 |
| PUT /admin/stores/{id}/stock | RequireStaff | `stock.Put(pool)` | stock | 204, 400, 401, 404 |
| GET /me/cart | RequireCustomer | `cart.Get(pool)` | cart | 200 Cart, 401 |
| PUT /me/cart/items | RequireCustomer | `cart.PutItem(pool)` | cart | 200 CartUpdate, 400, 401 |
| DELETE /me/cart | RequireCustomer | `cart.Delete(pool)` | cart | 204, 401 |

Messages: other store or unknown store 404 "not found"; store-facing `q` over 100 runes 400 field `q`, `categoryId` not a uuid 400 field `categoryId` (the same rules and messages as L3's admin product list); `q` on the stock list over 100 runes 400 field `q` "must be at most 100 characters"; `lowStock` 400 field `lowStock` "must be true or false"; rows count 400 field `rows` "1 to 500 rows"; duplicate 400 field `rows` "product listed twice"; unknown product 400 field `rows` "unknown product"; bad product id in a row 400 field `productId` "must be a uuid"; quantity out of range 400 field `quantity` "0 to 100000" (stock) or "0 to 20" (cart); missing `quantity` in a stock row 400 field `quantity` "quantity is required"; `storeId` or `productId` not a uuid in the cart body 400 naming the field "must be a uuid"; unknown store in the cart 400 field `storeId` "unknown store"; inactive or unknown product in the cart 400 field `productId` "product not available"; missing `quantity` in the cart body 400 field `quantity` "required"; a NUL byte in `q` on any of the three search routes 400 field `q` "must not contain a NUL byte" (Decision 18).

## Decisions
1. **Read-only joins between `catalog` and `stock` tables; writes never cross (accepted once for L3 and L4, PLAN.md D24).** The customer-facing catalog queries in `internal/catalog` join `store_stock` read-only; `stock` joins `products` read-only in `ListStock`, `CountStock` (the list must filter by quantity and page in SQL) and `LockStock` (`is_active` must be checked under the lock, Spec 2 §4). `cart` runs SQL only on `carts` and `cart_items` and calls `catalog.ProductsByID`, `store.Get` and `stock.Quantity`. Ceiling: a product column rename breaks `make gen` (caught at generate time); if stock becomes its own service, the joins become calls.
2. **Reservation locks in product id order, then decides, then writes once.** `LockStock` is `order by s.product_id for update of s` (the lock node sits above the sort, so rows lock in id order; spike: opposite-order reservations never deadlock). Rows missing, inactive or short are all collected before returning, so the error names every offending product (Spec 2 §4); nothing is written unless all pass; then one `AddStock` with negative deltas. In READ COMMITTED a blocked transaction re-reads the row after the winner commits, so it sees the new quantity (spike: exactly one of two wins the last unit). Ids are sorted in Go before the call so the error's ids are ascending. Ceiling: one round trip for the lock, one for the update; fine for carts of 20 lines.
3. **`OutOfStockError` is a Go error, not an `httpx.Error`.** The envelope's `productIds[]` (Spec 2 §6) is written by L5's placement handler, which owns the `out_of_stock` response; `httpx.Error` has no `productIds` today (request to L5).
4. **A cart holds no stock.** Clamping reads `stock.Quantity` without a lock; placement re-checks under lock and may still answer `out_of_stock`. Ceiling: two customers can both hold the last unit in their carts; the first to place gets it (Spec 2 §4 intends this).
5. **`PUT /me/cart/items` in one transaction (`pgx.BeginFunc`)**, after validation outside it: (a) decode with `httpx.ReadJSON` into `{StoreID, ProductID string; Quantity *int}`; validate `storeId` and `productId` as canonical uuids with `httpx.IsUUID` (400 naming the field), `quantity` present and 0..20; (b) `store.Get` on every PUT, quantity 0 included (not found → 400 `storeId`): the spec's validation requirement names no quantity condition, so a removal for an unknown store is refused too (accepted in the task 5 review; cost: one query on a removal); when `quantity > 0` also `catalog.ProductsByID` (absent or `!Active` → 400 `productId`); (c) in the transaction (`cart.set`), in this order:
    1. when `quantity > 0`: `available := stock.Quantity(ctx, tx, storeId, productId)`; `clamped = quantity > available`; `quantity = min(quantity, available)`. The stock at the requested store is read first, before the cart is created, locked, cleared or moved, and from here on a line clamped to 0 is handled exactly like a request for 0.
    2. when `quantity > 0`: `EnsureCart(customer, storeId)`.
    3. `LockCart`; while it finds no row and `quantity > 0`: `EnsureCart` and `LockCart` again (the re-creation loop, below). No row and `quantity == 0` → return `replaced` false and `clamped` as step 1 left it: nothing to remove, no cart is created for a line that clamped to nothing.
    4. the cart's store differs: `quantity == 0` → return with the cart untouched, `replaced` false and `clamped` as step 1 left it (false for a requested 0, true for a line the other store has no stock for); else `ClearCart` + `MoveCart`, `replaced = true`.
    5. `quantity == 0` → `DeleteCartItem`, else `SetCartItem`; then `DeleteEmptyCart`.

    (d) after commit answer `Update{view(ctx, pool, customer), replaced, clamped}`. Concurrent first adds are safe: `EnsureCart` is `on conflict do nothing` and `LockCart` serialises the rest.
    - **Out of stock at another store keeps the cart (manager decision, 2026-10-13, D13).** Tasks 5 and 6 cleared and moved the cart before reading the stock, so a line for store B that B has none of emptied the cart at A, clamped the line away and deleted the empty cart: the customer lost everything and got `replaced: true, clamped: true`. Step 1 before step 4 fixes it with no new branch: the request becomes a request for 0, which step 4 already leaves alone. A partial clamp (stock 3, asked 5) still has `quantity > 0` at step 4 and replaces: `replaced: true, clamped: true`, one line of 3. Ceiling: the stock is read without a lock (Decision 4) and now before the cart lock, so it can be older by the time the cart is written by as long as the lock wait; placement re-checks under lock.
    - **The re-creation loop in step 3 (task 5 review, fixed in t7).** `EnsureCart` does nothing when a cart row is there; `LockCart` then waits on that row while a concurrent request that removes the cart's last line holds it, and finds no row once that request commits its `DeleteEmptyCart`. Without a second ensure the positive set was dropped and answered 200 with an empty cart (`TestCartSetSurvivesConcurrentRemoval`). It is a loop and not one retry because the second `EnsureCart` can meet the same thing again (another request re-creates the cart and empties it before this one gets the lock); only a locked cart row ends it, so no pass can write into a missing cart. Ceiling: it could spin under sustained add-and-remove churn on one customer's cart, which only that customer's own parallel requests can cause.
6. **One empty shape.** A cart whose last line goes is deleted (`DeleteEmptyCart`), so "no cart" and "empty cart" are the same row state and the same JSON: no `storeId`, `items: []`, all amounts 0. Ceiling: an emptied cart forgets its store; the web app keeps the store choice in `localStorage` anyway (Spec 2 §7).
7. **Totals in Go from current data.** `view`: `CartByCustomer` (no rows → empty), `store.Get`, `CartItems`, `catalog.ProductsByID(storeID, ids)`; lines in `CartItems` order (insertion, then product id); `subtotal = Σ price × quantity` over every line, inactive products included at their current price (placement rejects them as `out_of_stock`, and the checkout page offers to remove them, Spec 2 §7); `fee = 0 if subtotal >= freeDeliveryAbove else deliveryFee`; `total = subtotal + fee`; `minOrder = store.MinOrderCents`; `shortfall = max(0, freeDeliveryAbove − subtotal)`. A threshold of 0 therefore means always free (Spec 2 §4 read literally).
8. **`shortfallCents` is the gap to free delivery**, not to the minimum order: Spec 2 §7 names it the "free-delivery nudge" and shows the minimum order as its own notice, which the client derives from `minOrderCents` and `subtotalCents`.
9. **Store replacement only on a positive quantity after the clamp.** Removing a line (0) for another store cannot mean "start over at that store"; it leaves the cart alone and answers it with `replaced: false`. A line the other store has no stock for is the same case with `clamped: true` (Decision 5, step 1): the customer would otherwise trade a full cart for an empty one.
10. **Deactivated products stay in the cart.** `ProductsByID` returns inactive products with `InStock` false, `Quantity` 0 and the Go-only `Active` false (`json:"-"`; a `StoreProduct` has no `isActive` in JSON, so the client tells a deactivated line by `inStock` false), so the line is visible and removable; only adding (quantity above 0) requires an active product.
11. **Stock routes: who and in which order.** `PathID` (malformed 404) → `auth.CurrentStaff(ctx)`: role `store_staff` with `StoreID != id` → 404 before any query → `store.Get` (unknown → 404, covers admins) → handler body. A small unexported `canSee(staff, storeID)` in `stock`; L5 writes its own for orders. Ceiling: none.
12. **Stock list.** `httpx.Page` for paging (default 24, max 100), `q` trimmed, at most 100 runes, turned into an `ilike` pattern with `\`, `%`, `_` escaped exactly like L3's `pattern` (a local `strings.NewReplacer`, since `stock` does not import `catalog`; `""` means no filter); `lowStock` `""`/`false`/`true` only; `ListStock` + `CountStock`, answered as `httpx.NewList`. The low-stock threshold 5 is a literal in the SQL (Spec 2 §6 dashboard rule); `LowCount` reuses `CountStock` with `Pattern: ""`, `LowStock: true`. Ceiling: offset paging (keyset past 10 000 products).
13. **Stock upsert.** `httpx.ReadJSON` into `{Rows []struct{ProductID string; Quantity *int}}`; checks in order, first failure wins: 1..500 rows (`rows`), each `productId` a uuid (`productId`), each quantity present and 0..100000 (`quantity`), no product twice (`rows`); then one `UpsertStock` in `pgx.BeginFunc`; `23503` (the store was checked, so it is the product) → 400 `rows` "unknown product", mapped in `stock.Put` itself with `errors.As` on `*pgconn.PgError`, because `pg.Map` answers 409 for every foreign key (task 4 review); 204 with no body. The 100000 ceiling keeps `integer` far from overflow when L5 adds back cancelled quantities. Ceiling: the error does not say which row is unknown; the admin page sends only products it listed.
14. **Customer-facing catalog, owned here (D24; tasks 2 and 3).** Plain handler functions in the new `internal/catalog/store.go`, so nothing depends on L3 shipping store-facing code. Each: `PathID(r, "id")` → `store.Get(ctx, pool, id)` (404 as is) → query. `StoreProducts`: `httpx.Page`; `q` trimmed, at most 100 runes (400 `q`), `pattern(q)` when non-empty else NULL; `categoryId` canonical uuid (400 `categoryId`) else NULL; `StoreProducts` + `CountStoreProducts`; rows → `StoreProduct{..., ImageURL: imageURL(key), InStock: q > 0, Quantity: min(q, 10), Active: true}`; `httpx.NewList`. `StoreProductBySlug`: the slug as is (no format check) → `StoreProductBySlug` → no rows 404. `StoreCategories`: `StoreCategories(storeID)` returns exactly the qualifying categories (a parent through a stocked child, a child only by itself), assembled with L3's tree function into `{items: CategoryNode[]}`. `ProductsByID`: `StoreProductsByID`, map by id, `InStock = IsActive && q > 0`, `Quantity = 0` when inactive else `min(q, 10)`, `Active = IsActive`. Ceiling: two round trips (store, then catalog); sequential `ilike` scan as L3's.
15. **Seed (D22).** `seed.Reset`'s single `truncate` gains `store_stock, cart_items, carts` (they reference `customers`, `stores` and `products`, which are truncated in the same statement; truncating those without these fails). `Load` ends with one statement, after L2's stores and L3's products:
    ```sql
    insert into store_stock (store_id, product_id, quantity)
    select s.id, p.id,
           case (p.n + 3 * s.k) % 15
               when 0 then 0
               when 7 then 1 + p.n % 4
               else 10 + (7 * p.n + 5 * s.k) % 40
           end
    from (select id, row_number() over (order by id) - 1 as k from stores) s
    cross join (select id, row_number() over (order by id) as n from products) p;
    ```
    Fixed ids order the rows, so quantities are the same on every reset: per store one zero every 15 products and one low count (1 to 4) every 15, the rest 10 to 49; the first product (`...0601`, the Postman `productId`) has 17 at the first store and 22 at the second, so the Postman run's add-to-cart succeeds. Stock rows get generated ids (nothing references them). Ceiling: needs at least 15 demo products for a zero and a low count per store; L3 seeds 148. Stock rows also go to the inactive `...0694` (harmless: it is hidden everywhere customers look). No demo cart.
16. **Response codes.** `PUT` stock and `DELETE /me/cart` answer 204 with no body (the admin page refetches the list; the cart drawer reads the next `GET`). 500 `internal` is not documented per operation (L1 Decision 24's rule).
17. **`openapi.json` shapes.** Tags appended `stock`, `cart`. Schemas: `StockRow`, `StockList {items, page, pageSize, total}`, `StockUpdate {rows: [{productId, quantity}]}` (`maxItems` 500, quantity 0..100000), `Cart`, `CartLine {product: StoreProduct, quantity}`, `CartItemSet {storeId, productId, quantity}` (quantity 0..20), `CartUpdate` (`allOf` `Cart` plus required `replaced`, `clamped`), `StoreProduct` (its own object: the fields of the Go struct above, `inStock` boolean and `quantity` integer 0..10 required), `StoreProductList` (paged); `CartLine.product` is a `StoreProduct`; the store categories answer L3's `CategoryTree`. Whatever product schemas L3 keeps for its admin routes are not touched. Query parameters `q`, `lowStock` (boolean), `page`, `pageSize` on the stock list and `q`, `categoryId`, `page`, `pageSize` on the store product list; path `slug` example `banana-robusta`; the three store-facing operations are public (no `security`, tag `catalog`) and document 404 (and 400 on the list) with examples; path `id` example `00000000-0000-4000-8000-000000000401`. Every stock and cart operation has `security: [{"bearer": []}]`, a 401 with an example, and an example on every response with content; request bodies carry examples (Postman's raw body): stock update `{"rows":[{"productId":"00000000-0000-4000-8000-000000000601","quantity":25}]}`, cart line `{"storeId":"00000000-0000-4000-8000-000000000401","productId":"00000000-0000-4000-8000-000000000601","quantity":2}`. Tag order puts `stock` before `cart`, so the Postman run restocks before it adds to the cart.
18. **A NUL byte in `q` is 400 field `q` on all three search routes (task 4 review, fixed in t7).** Postgres refuses `0x00` in text (SQLSTATE 22021), so `q=%00` answered 500 `internal`. `stock.List`, `catalog.storeFilters` (`GET /stores/{id}/products`) and `catalog.productFilters` (L3's `GET /admin/products`, same module, same bug) each check `strings.ContainsRune(q, 0)` after the 100-rune check and answer 400 `validation` field `q` "must not contain a NUL byte"; no shared helper (`stock` does not import `catalog`, three lines per site). Tests: `TestStockListNULInQ`, `TestStoreProductsNULInQ`, `TestListProductsNULInQ`. The `stock` and `catalog` deltas of this change carry the rule as a scenario each. The admin product list's requirement lives in the living `admin-catalog` spec (core-catalog, archived), so this change carries a MODIFIED delta for "Admins list and search products" with the sentence and the scenario "NUL byte in q" (manager ruling, 2026-10-13). `openapi.json` does not list the 400 cases of `q` one by one and is unchanged. Ceiling: none; `httpx.ReadJSON` already refuses NUL in bodies (`platform` spec), path ids are uuids, and `q` is the only free-text query parameter these routes pass to SQL.

## Test strategy
`make test-core`. Packages and schemas: `stock` → `testdb.Migrated("stock")`, `cart` → `Migrated("cart")`, `catalog` keeps L3's `Migrated("catalog")`, `app` and `seed` keep L1's. Fixtures insert stores, categories and products with plain `pool.Exec` (column lists from 0003 and 0004) and unique names per test; route tests reuse L1's `call` helper and its customer, admin and store-staff fixtures, adding a store-staff user of a second store through `auth.CreateStaff` and `POST /admin/auth/sign-in` once per package (`sync.Once`). Each route test checks status, `code`, `field` and the body through the real router (`srv`). `TestAuthGates` gains five rows: stock routes anonymous 401, customer 401, own-store staff allowed, admin allowed (other-store staff 404 is its own test); cart routes anonymous 401, customer allowed, store staff 401, admin 401. The race tests start both goroutines on a closed channel and run `pgx.BeginFunc` each; they assert exactly one `nil` and one `*OutOfStockError`, then the stored quantity. `go test -race` covers the goroutines.

## Risks / Trade-offs
- [L2 and L3 change shape before this branch rebases] → the assumptions above are the only coupling; task 1's migration needs only `stores.id`, `products.id`, `customers.id` and `set_updated_at()`; the team lead re-reads L2's and L3's landed design and lane logs and refreshes briefs 2 to 6 after the rebase.
- [web-P2-L1's browsing pages wait for this lane] → task order (D24) puts the store products and categories (tasks 2, 3) right after the schema.
- [`out_of_stock` envelope needs `productIds`] → L5 adds `ProductIDs []string \`json:"productIds,omitempty"\`` to `httpx.Error` (request in the lane log).
- [Postman run order] → tags put `stock` before `cart`, so the run restocks before it adds to the cart; on a fresh seed `...0601` has stock at both stores anyway. L3's collection deletes `...0601` unless an order references it (L3's request to L5/L6); a later cart request then fails with 400 `productId` until `seed-demo --reset`.
