# Design

## Context
Builds on, without redefining, what is on `main` at 503e1ba (this branch merged it at d266ceb): core-P2-L1 `core-accounts-auth` (migration 0002 with `order_status`, `set_updated_at()`, `customers`, `addresses`; `sqlc.yaml`; `pg.Map`/`IsUnique`; `testdb.Migrated`; `httpx` `ReadJSON`/`Page`/`NewList`/`PathID`/`IsUUID`/`WriteError`/`RequestID`; `auth` `RequireCustomer`/`RequireStaff`/`CustomerID`/`CurrentStaff`; `seed.Reset`/`Load`; the contract and security tests; the `app` test fixtures), core-P2-L2 `core-stores-serviceability` (0003 `stores`, `store_service_areas`; `store.Get`, `store.ForPincode`, `store.Store`; demo stores `...0401` Koramangala, `...0402` Indiranagar; store staff `...0102`, `...0103`), core-P2-L3 `core-catalog` (0004 `categories`, `products`; demo products `...0601` to `...0694`) and core-P2-L4 `core-stock-cart` (0005 `store_stock`, `carts`, `cart_items`; `stock.Reserve`/`Release`/`Quantity`/`LowCount`/`OutOfStockError`/`Line`, `cart.Lines`/`Clear`, `catalog.ProductsByID`/`StoreProduct`; demo stock). Behaviour comes from this change's deltas (`orders`, `admin-staff`, `admin-stores`, `platform`, and `stock` since the acceptance of 2026-10-13, Decision 17). PLAN.md D7 (customers cancel only while placed or accepted; store staff see the customer's phone), D19/D23 (commit regenerated `core.d.ts` and Postman collection), D20 (bearer `security`, `/admin/` prefix, fixed ids), D22 (seed grows per lane), D24 and D25 (no SQL on another package's tables; `internal/order` reads through small exported Go functions; plain-column snapshots; 409 at placement; "today" from midnight Asia/Kolkata), D26 (an unmerged migration is applied to `shopperstop_core_test` only).

Two spikes back the verbatim blocks below. 2026-10-12, against the predecessors' designs: the migration, the `sqlc.yaml` entry, `queries/order.sql` and `AddressByID` generate and vet; timestamps scan into `time.Time` / `*time.Time`; `OrderStatus.Valid()` and `AllOrderStatusValues()` are generated; a lowercase number is `23514` `orders_number_check`; a duplicate number `23505` `orders_number_key`; a wrong total `23514` `orders_total`; deleting an ordered product is `23503` `order_items_product_id_fkey`; the nullable scope filters hide another store's order; `CountsToday` and `RevenueToday` count today's rows and drop rows backdated two days. 2026-10-13, against the landed tree (scratch copy of `services/core` at d266ceb, sqlc v1.31.1, a per-run schema of `shopperstop_core_test`, nothing else touched): the same four blocks generate and `go build ./...` passes; `LockOrder` returns the number; `seed.Reset` twice with the truncate entry and the four demo-order statements of Decision 15 leaves three orders with totals 33900, 39900 and 103000 (fee 0 on each), five items with image URL `/api/core/v1/files/products/seed-fruits-vegetables.png`, nine events with no null actor; every existing core test passes with 0006 and the seeded orders in place. The same spike showed that 0006 without the truncate entry breaks `seed.Reset` (`0A000`, "cannot truncate a table referenced in a foreign key constraint"), so the entry lands with the migration in task 1. Workers copy the blocks; they do not redesign them.

### Landed interfaces this change calls (read in the code on 2026-10-13)
- `store.Get(ctx, q db.DBTX, id) (store.Store, error)`: unknown id is `*httpx.Error` 404 `not_found`. `store.ForPincode(ctx, q db.DBTX, pincode) (store.Store, error)`: no store serves it is `*httpx.Error` 404 `not_serviceable`. `store.Store` has `ID`, `Name`, `IsOpen`, `DeliveryFeeCents`, `FreeDeliveryAboveCents`, `MinOrderCents`, `PromisedMinutes`. The `ListStores` query is `select * from stores order by name, id limit $1 offset $2` (`db.ListStoresParams{Limit, Offset int32}`), and the unexported `public(row db.Store) Store` converts a row.
- `cart.Lines(ctx, tx pgx.Tx, customerID) (storeID string, lines []stock.Line, err error)` locks the cart row (`for update`) and answers the lines in insertion order, inactive products included; no cart is `"", nil, nil`. A cart never has zero lines (the cart row is deleted with its last line). `cart.Clear(ctx, d db.DBTX, customerID) error`.
- `stock.Line{ProductID string; Quantity int32}`. `stock.Reserve(ctx, tx pgx.Tx, storeID string, lines []stock.Line) error`: all or nothing; `*stock.OutOfStockError{ProductIDs []string}` (ascending) names every product that is inactive, has no row or has less than asked; lines naming the same product are summed; a quantity below 1 is a plain error (it cannot reach placement: cart quantities are 1 to 20 and a cart holds a product once). `stock.Release(ctx, tx, storeID, lines) error` adds back and skips a product with no stock row; since ac6507e (this lane) it first locks its rows in product id order with `LockStock`, as `Reserve` does. `stock.Quantity(ctx, d, storeID, productID) (int32, error)`. `stock.LowCount(ctx, d, storeID) (int64, error)`: active products below 5 at the store, a product with no row counting as 0.
- `catalog.ProductsByID(ctx, d db.DBTX, storeID string, ids []string) (map[string]catalog.StoreProduct, error)`: active and inactive products keyed by id, unknown ids absent; `StoreProduct` has `ID`, `Name`, `UnitLabel`, `ImageURL` (`/api/core/v1/files/<key>` or empty), `MrpCents`, `PriceCents`.
- `auth.CustomerID(ctx) string`; `auth.CurrentStaff(ctx) auth.Staff` with `ID`, `Role` (`admin` or `store_staff`) and `StoreID` (empty for an admin); `auth.Customer{ID, Email, Name, Phone}`; the generated `CustomerByID` query returns `id, email, name, phone`.
- `httpx.ReadJSON` answers 400 `validation` for a body over 1 MiB, a NUL byte and malformed JSON (an empty body is "invalid JSON"); `httpx.PathID` answers 404 for an id that is not a uuid; `httpx.Page(r) (page, pageSize int, err error)`; `httpx.NewList(items, page, pageSize, total)`; `pg.Map` turns no rows into 404 `not_found`, `23505` into 409 `conflict` "already exists" and `23503` into 409 `conflict` "still in use".
- `catalog`'s product delete answers any `23503` with 409 `conflict` "product was ordered; set isActive to false instead"; `store.Delete` answers `23503` through `pg.Map`. Neither needs a change.
- The cart never holds more than the stock at the time of the write, but it reads stock without a lock: placement is the authority and re-checks under `stock.Reserve`.

None of the three readers this change needs (`address.Get`, `auth.CustomerByID`, `store.All`) exists under any name; the core manager granted adding them (2026-10-13, D25).

## Goals / Non-Goals
**Goals:** every scenario in the five deltas has a Go test against the real database or through the real router; web gets checkout, order history, tracking and cancel; admin gets the order board, order detail, status changes and the dashboard; Postman's `orderId` is a fixed demo order.

**Non-Goals:** a status filter with several values, a free-text order search, keyset paging, store name or promised minutes inside the order (clients read `GET /stores/{id}`), the event's `actorId` in responses, a retry on order-number collision, an `actor_type` `system` caller (reserved for the rider service).

## Files (all in `services/core/` unless noted)
```
migrations/0006_orders.sql                 schema below, verbatim
sqlc.yaml                                  one entry appended (below)
queries/order.sql                          verbatim below
queries/address.sql                        AddressByID appended (below)
internal/order/db/*, internal/*/db/*      sqlc output, never hand-edited (every package's models.go gains the three tables; internal/address/db/address.sql.go gains AddressByID)
internal/order/order.go                    package comment (task 1); Order, Item, Event, Address, Actor, scope, views, newNumber (task 2)
internal/order/place.go                    Place
internal/order/status.go                   next, allowed, Transition, Today
internal/order/handlers.go                 Create, List, Get, Cancel, StoreList, AdminGet, SetStatus and their helpers
internal/order/schema_test.go, status_test.go   schema rules; the allowed table
internal/staff/dashboard.go                Dashboard handler (Spec 2 §9 names the package)
internal/address/address.go                Get (exported reader)
internal/auth/customer.go                  CustomerByID (exported reader over the existing query)
internal/store/store.go                    All (exported reader over the existing ListStores query)
internal/httpx/errors.go, json_test.go     Error.ProductIDs; TestWriteErrorProductIDs next to TestWriteErrorEnvelope
internal/seed/seed.go, seed_test.go        truncate entry (task 1), demo orders (task 7)
internal/stock/stock.go, stock_test.go     Release locks in product id order (review round, Decision 17)
queries/stock.sql, internal/stock/db/stock.sql.go   UpsertStock writes in product id order (review round, Decision 17)
internal/app/app.go                        eight routes
internal/app/app_test.go                   envelope gains ProductIDs
internal/app/orders_test.go, orders_cancel_test.go, orders_staff_test.go, dashboard_test.go
internal/app/accounts_test.go              TestAuthGates rows
openapi.json
packages/ui/src/api/core.d.ts                          make gen (D19)
docs/postman/shopperstop-core.postman_collection.json  make postman (D23)
```

## Schema: `migrations/0006_orders.sql` (verbatim)
```sql
-- Orders with snapshot lines and their status history.
create table orders (
    id                 uuid primary key default gen_random_uuid(),
    number             text not null unique check (number ~ '^SS-[A-Z2-7]{8}$'),
    customer_id        uuid not null references customers (id),
    store_id           uuid not null references stores (id),
    status             order_status not null default 'placed',
    customer_name      text not null,
    customer_phone     text not null default '',
    address_label      text not null,
    address_line1      text not null,
    address_line2      text not null default '',
    address_pincode    text not null,
    subtotal_cents     bigint not null check (subtotal_cents >= 0),
    delivery_fee_cents bigint not null check (delivery_fee_cents >= 0),
    total_cents        bigint not null,
    payment_method     text not null default 'cod' check (payment_method = 'cod'),
    placed_at          timestamptz not null default now(),
    delivered_at       timestamptz,
    cancelled_at       timestamptz,
    cancel_reason      text not null default '',
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    constraint orders_total check (total_cents = subtotal_cents + delivery_fee_cents)
);
create index orders_customer_placed on orders (customer_id, placed_at desc, id desc);
create index orders_store_placed on orders (store_id, placed_at desc, id desc);
create trigger orders_updated_at before update on orders for each row execute function set_updated_at();

create table order_items (
    id          uuid primary key default gen_random_uuid(),
    order_id    uuid not null references orders (id),
    product_id  uuid not null references products (id) on delete restrict,
    name        text not null,
    unit_label  text not null,
    image_url   text not null default '',
    price_cents bigint not null check (price_cents > 0),
    mrp_cents   bigint not null,
    quantity    integer not null check (quantity between 1 and 20),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (order_id, product_id)
);
create index order_items_product_id on order_items (product_id);
create trigger order_items_updated_at before update on order_items for each row execute function set_updated_at();

create table order_events (
    id          uuid primary key default gen_random_uuid(),
    order_id    uuid not null references orders (id),
    from_status order_status,
    to_status   order_status not null,
    actor_type  text not null check (actor_type in ('customer', 'staff', 'system')),
    actor_id    uuid,
    note        text not null default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index order_events_order_id on order_events (order_id, created_at);
create trigger order_events_updated_at before update on order_events for each row execute function set_updated_at();
```
`orders.store_id` and `orders.customer_id` carry no `on delete` (no action): a store with orders cannot be deleted (`store.Delete` answers 409 through `pg.Map` with no code change), and nothing deletes customers. `order_items.product_id ... on delete restrict` makes L3's "ordered product cannot be deleted" real with no code change in `catalog`. `order_items` and `order_events` reference `orders` without cascade: orders are never deleted, only truncated by the seed. No `addresses` foreign key: the address is a snapshot and the customer may delete the address later.

D26: this migration is applied only by the tests, to a per-run schema of `shopperstop_core_test` (`testdb.Migrated`). Nothing in this lane runs `core-admin migrate`, `core-admin seed-demo`, `make dev`, `make seed`, `make e2e` or `make prod-local`, and nothing connects to `shopperstop_core` or `shopperstop_core_e2e`.

## sqlc: entry appended to `sqlc.yaml` (verbatim)
```yaml
  - engine: postgresql
    schema: migrations
    queries: queries/order.sql
    gen:
      go:
        package: db
        out: internal/order/db
        sql_package: pgx/v5
        emit_pointers_for_null_types: true
        emit_enum_valid_method: true
        emit_all_enum_values: true
        overrides:
          - db_type: uuid
            go_type: string
          - db_type: uuid
            nullable: true
            go_type:
              type: string
              pointer: true
          - db_type: timestamptz
            go_type: time.Time
          - db_type: timestamptz
            nullable: true
            go_type:
              type: time.Time
              pointer: true
```
The two timestamp overrides and the two enum switches apply to this entry only; other packages keep `pgtype.Timestamptz`.

### `queries/order.sql` (verbatim)
```sql
-- name: CreateOrder :one
insert into orders (number, customer_id, store_id, customer_name, customer_phone,
                    address_label, address_line1, address_line2, address_pincode,
                    subtotal_cents, delivery_fee_cents, total_cents)
values (@number, @customer_id, @store_id, @customer_name, @customer_phone,
        @address_label, @address_line1, @address_line2, @address_pincode,
        @subtotal_cents, @delivery_fee_cents, @total_cents)
returning id;

-- name: AddItems :exec
-- Zips equal-length arrays, one row per order line.
insert into order_items (order_id, product_id, name, unit_label, image_url, price_cents, mrp_cents, quantity)
select @order_id::uuid, unnest(@product_ids::uuid[]), unnest(@names::text[]), unnest(@unit_labels::text[]),
       unnest(@image_urls::text[]), unnest(@price_cents::bigint[]), unnest(@mrp_cents::bigint[]), unnest(@quantities::integer[]);

-- name: AddEvent :exec
insert into order_events (order_id, from_status, to_status, actor_type, actor_id, note)
values (@order_id, sqlc.narg(from_status), @to_status, @actor_type, sqlc.narg(actor_id), @note);

-- name: GetOrder :one
-- A null customer_id or store_id does not filter: the caller's scope.
select * from orders
where id = @id
  and (sqlc.narg(customer_id)::uuid is null or customer_id = sqlc.narg(customer_id))
  and (sqlc.narg(store_id)::uuid is null or store_id = sqlc.narg(store_id));

-- name: LockOrder :one
select id, number, status, store_id from orders
where id = @id
  and (sqlc.narg(customer_id)::uuid is null or customer_id = sqlc.narg(customer_id))
  and (sqlc.narg(store_id)::uuid is null or store_id = sqlc.narg(store_id))
for update;

-- name: SetStatus :exec
update orders
set status        = @status,
    delivered_at  = case when @status = 'delivered'::order_status then now() else delivered_at end,
    cancelled_at  = case when @status = 'cancelled'::order_status then now() else cancelled_at end,
    cancel_reason = case when @status = 'cancelled'::order_status then @cancel_reason else cancel_reason end
where id = @id;

-- name: CustomerOrders :many
select * from orders where customer_id = @customer_id
order by placed_at desc, id desc
limit @lim offset @off;

-- name: CountCustomerOrders :one
select count(*) from orders where customer_id = $1;

-- name: StoreOrders :many
select * from orders
where store_id = @store_id and (sqlc.narg(status)::order_status is null or status = sqlc.narg(status))
order by placed_at desc, id desc
limit @lim offset @off;

-- name: CountStoreOrders :one
select count(*) from orders
where store_id = @store_id and (sqlc.narg(status)::order_status is null or status = sqlc.narg(status));

-- name: OrderItems :many
select order_id, product_id, name, unit_label, image_url, price_cents, mrp_cents, quantity
from order_items where order_id = any(@order_ids::uuid[])
order by order_id, name, product_id;

-- name: OrderEvents :many
select order_id, from_status, to_status, actor_type, note, created_at
from order_events where order_id = any(@order_ids::uuid[])
order by order_id, created_at, id;

-- name: CountsToday :many
-- Orders placed since midnight in Bengaluru, by current status.
select status, count(*) as orders from orders
where store_id = $1 and placed_at >= date_trunc('day', now(), 'Asia/Kolkata')
group by status;

-- name: RevenueToday :one
select coalesce(sum(total_cents), 0)::bigint from orders
where store_id = $1 and status = 'delivered' and delivered_at >= date_trunc('day', now(), 'Asia/Kolkata');
```
Generated: `db.Order` (every column; `Status OrderStatus`, `PlacedAt time.Time`, `DeliveredAt`, `CancelledAt *time.Time`), `CreateOrderParams{Number, CustomerID, StoreID, CustomerName, CustomerPhone, AddressLabel, AddressLine1, AddressLine2, AddressPincode string; SubtotalCents, DeliveryFeeCents, TotalCents int64}` returning the id, `AddItemsParams{OrderID string; ProductIds, Names, UnitLabels, ImageUrls []string; PriceCents, MrpCents []int64; Quantities []int32}`, `AddEventParams{OrderID string; FromStatus *OrderStatus; ToStatus OrderStatus; ActorType string; ActorID *string; Note string}`, `GetOrderParams` / `LockOrderParams{ID string; CustomerID, StoreID *string}`, `LockOrderRow{ID, Number string; Status OrderStatus; StoreID string}`, `SetStatusParams{Status OrderStatus; CancelReason, ID string}`, `CustomerOrdersParams{CustomerID string; Off, Lim int32}`, `StoreOrdersParams{StoreID string; Status *OrderStatus; Off, Lim int32}`, `CountStoreOrdersParams{StoreID string; Status *OrderStatus}`, `OrderItemsRow{OrderID, ProductID, Name, UnitLabel, ImageUrl string; PriceCents, MrpCents int64; Quantity int32}`, `OrderEventsRow{OrderID string; FromStatus *OrderStatus; ToStatus OrderStatus; ActorType, Note string; CreatedAt time.Time}`, `CountsTodayRow{Status OrderStatus; Orders int64}`, `RevenueToday` returns `int64`. (sqlc refuses one parameter used twice in an `insert ... values` arithmetic expression, so `total_cents` is passed; the `orders_total` check guards it.) `LockOrder` selects the number too (changed 2026-10-13): the log line of Decision 7 needs it and `Transition` reads the order nowhere else.

### Appended to `queries/address.sql` (verbatim)
```sql
-- name: AddressByID :one
select id, label, line1, line2, pincode, is_default from addresses where id = $1 and customer_id = $2;
```
Generated `AddressByIDParams{ID, CustomerID string}` and `AddressByIDRow{ID, Label, Line1, Line2, Pincode string; IsDefault bool}`, convertible with `Address(row)` like the other rows.

## Interfaces
```go
// internal/httpx/errors.go (one field; L4's request)
type Error struct {
    Status     int      `json:"-"`
    Code       string   `json:"code"`
    Message    string   `json:"message"`
    Field      string   `json:"field,omitempty"`
    ProductIDs []string `json:"productIds,omitempty"` // only with out_of_stock
}

// Exported readers in packages owned by earlier lanes (no new behaviour, D25). Each body is given in full.

// internal/address/address.go (needs no new import)
// Get answers the customer's address with this id; another customer's or an unknown id is 404 not_found.
func Get(ctx context.Context, d db.DBTX, customerID, id string) (Address, error) {
    row, err := db.New(d).AddressByID(ctx, db.AddressByIDParams{ID: id, CustomerID: customerID})
    if err != nil {
        return Address{}, pg.Map(err)
    }
    return Address(row), nil
}

// internal/auth/customer.go (add "context" to the imports)
// CustomerByID answers the customer with this id; an unknown id is 404 not_found.
func CustomerByID(ctx context.Context, d db.DBTX, id string) (Customer, error) {
    row, err := db.New(d).CustomerByID(ctx, id)
    if err != nil {
        return Customer{}, pg.Map(err)
    }
    return Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone}, nil
}

// internal/store/store.go (needs no new import)
// All answers every store by name, for the staff dashboard. Ceiling: the first 1000 stores.
func All(ctx context.Context, q db.DBTX) ([]Store, error) {
    rows, err := db.New(q).ListStores(ctx, db.ListStoresParams{Limit: 1000, Offset: 0})
    if err != nil {
        return nil, err
    }
    out := make([]Store, 0, len(rows))
    for _, row := range rows {
        out = append(out, public(row))
    }
    return out, nil
}

// internal/order/order.go
type Address struct {
    Label   string `json:"label"`
    Line1   string `json:"line1"`
    Line2   string `json:"line2,omitempty"`
    Pincode string `json:"pincode"`
}
type Item struct {
    ProductID  string `json:"productId"`
    Name       string `json:"name"`
    UnitLabel  string `json:"unitLabel"`
    ImageURL   string `json:"imageUrl,omitempty"`
    PriceCents int64  `json:"priceCents"`
    MrpCents   int64  `json:"mrpCents"`
    Quantity   int32  `json:"quantity"`
}
type Event struct {
    FromStatus string    `json:"fromStatus,omitempty"` // absent on the placement event
    ToStatus   string    `json:"toStatus"`
    ActorType  string    `json:"actorType"`            // customer | staff | system
    Note       string    `json:"note,omitempty"`
    CreatedAt  time.Time `json:"createdAt"`            // row.CreatedAt.UTC()
}
type Order struct {
    ID               string     `json:"id"`
    Number           string     `json:"number"`
    StoreID          string     `json:"storeId"`
    Status           string     `json:"status"`
    CustomerName     string     `json:"customerName"`
    CustomerPhone    string     `json:"customerPhone,omitempty"`
    Address          Address    `json:"address"`
    SubtotalCents    int64      `json:"subtotalCents"`
    DeliveryFeeCents int64      `json:"deliveryFeeCents"`
    TotalCents       int64      `json:"totalCents"`
    PaymentMethod    string     `json:"paymentMethod"`         // "cod"
    PlacedAt         time.Time  `json:"placedAt"`              // row.PlacedAt.UTC()
    DeliveredAt      *time.Time `json:"deliveredAt,omitempty"` // UTC when set
    CancelledAt      *time.Time `json:"cancelledAt,omitempty"` // UTC when set
    CancelReason     string     `json:"cancelReason,omitempty"`
    Items            []Item     `json:"items"`                 // never nil
    Events           []Event    `json:"events"`                // never nil, oldest first
}
type Actor struct{ Type, ID string }             // Type "customer" or "staff"
type scope struct{ customerID, storeID *string } // nil = no filter

// views turns rows into Orders, in the rows' order, with one OrderItems and one OrderEvents call for all of
// them (ids of the rows; both calls are skipped for no rows). Items and Events start as empty slices.
func views(ctx context.Context, q *db.Queries, rows []db.Order) ([]Order, error)
// newNumber is "SS-" + base32.StdEncoding.EncodeToString(b) for 5 bytes from crypto/rand: 8 characters, no padding.
func newNumber() (string, error)

// internal/order/place.go
func Place(ctx context.Context, pool *pgxpool.Pool, customerID, addressID string) (id string, err error) // Decision 2

// internal/order/status.go
var next = map[db.OrderStatus][]db.OrderStatus{ /* Decision 5 */ }
func allowed(from, to db.OrderStatus, actorType string) bool
func Transition(ctx context.Context, pool *pgxpool.Pool, id string, sc scope, to db.OrderStatus, actor Actor, note string) error // Decision 6
// Today answers the store's orders placed today by current status, with all seven statuses as keys, and
// the total of the orders delivered today.
func Today(ctx context.Context, d db.DBTX, storeID string) (byStatus map[string]int64, revenueCents int64, err error)

// internal/order/handlers.go: plain functions like stock's and cart's, each func(pool *pgxpool.Pool) http.HandlerFunc:
// Create (POST /orders), List (GET /orders), Get (GET /orders/{id}), Cancel (POST /orders/{id}/cancel),
// StoreList (GET /admin/stores/{id}/orders), AdminGet (GET /admin/orders/{id}), SetStatus (POST /admin/orders/{id}/status)
// Unexported helpers in the same file:
func invalid(field, message string) *httpx.Error  // 400 validation, like the other packages
func notFound() *httpx.Error                      // 404 not_found "not found"
func customerScope(ctx context.Context) scope     // {customerID: &auth.CustomerID(ctx)}
func staffScope(ctx context.Context) scope        // Role == "admin": scope{}; every other role: {storeID: &staff.StoreID} (fails closed, 525b3d7)
func text(field, v string) (string, error)        // strings.TrimSpace; over 500 runes: invalid(field, "at most 500 characters")
// respond reads the order back in the caller's scope (GetOrder, pg.Map, views) and writes it with status.
func respond(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, id string, sc scope, status int)

// internal/staff/dashboard.go
type DashboardStore struct {
    StoreID           string           `json:"storeId"`
    StoreName         string           `json:"storeName"`
    OrdersToday       map[string]int64 `json:"ordersToday"` // seven keys
    LowStockCount     int64            `json:"lowStockCount"`
    RevenueTodayCents int64            `json:"revenueTodayCents"`
}
type dashboard struct {
    Items []DashboardStore `json:"items"` // never nil
}
func Dashboard(pool *pgxpool.Pool) http.HandlerFunc // GET /admin/dashboard
```
Imports (no cycles, checked against the landed imports): `order` → `cart`, `stock`, `store`, `catalog`, `address`, `auth`, `httpx`, `pg`; `staff` → `order`, `stock`, `store`, `auth`, `httpx`. None of those import `order` or `staff` (`address` imports `auth`; `cart` imports `catalog`, `stock`, `store`; `stock` imports `auth`, `store`).

## Routes (`internal/app.New`, flat full paths under `/api/core/v1`, appended after the stock routes)
| Method and path | Middleware | Handler | Tag | operationId | Answers |
|---|---|---|---|---|---|
| POST /orders | `a.RequireCustomer` | `order.Create(pool)` | orders | `placeOrder` | 201 Order; 400; 401; 409 `not_serviceable`, `out_of_stock`, `conflict` |
| GET /orders | `a.RequireCustomer` | `order.List(pool)` | orders | `listOrders` | 200 OrderList; 400; 401 |
| GET /orders/{id} | `a.RequireCustomer` | `order.Get(pool)` | orders | `getOrder` | 200 Order; 401; 404 |
| POST /orders/{id}/cancel | `a.RequireCustomer` | `order.Cancel(pool)` | orders | `cancelOrder` | 200 Order; 400; 401; 404; 409 `conflict` |
| GET /admin/stores/{id}/orders | `a.RequireStaff` | `order.StoreList(pool)` | orders | `listStoreOrders` | 200 OrderList; 400; 401; 404 |
| GET /admin/orders/{id} | `a.RequireStaff` | `order.AdminGet(pool)` | orders | `getAdminOrder` | 200 Order; 401; 404 |
| POST /admin/orders/{id}/status | `a.RequireStaff` | `order.SetStatus(pool)` | orders | `setOrderStatus` | 200 Order; 400; 401; 404; 409 `conflict` |
| GET /admin/dashboard | `a.RequireStaff` | `staff.Dashboard(pool)` | admin-staff | `getDashboard` | 200 Dashboard; 401 |

Messages (handlers write exactly these): empty cart 400 "cart is empty" (no field); `addressId` absent or empty 400 field `addressId` "required", not a uuid "must be a uuid", not the customer's "unknown address"; below minimum 400 field `subtotal` "below the store's minimum order"; pincode not served by the cart's store 409 `not_serviceable` field `addressId` "the store does not deliver to this address"; store closed 409 `not_serviceable` "the store is closed" (no field); stock 409 `out_of_stock` "some products are out of stock" with `productIds`; forbidden transition 409 `conflict` "cannot move an order from <from> to <to>"; unknown, empty or missing `status` (body or query) 400 field `status` "must be one of placed, accepted, packing, ready, out_for_delivery, delivered, cancelled"; `reason` or `note` over 500 characters 400 field `reason`/`note` "at most 500 characters"; unknown order, other customer's or other store's order, unknown store 404 "not found"; an order-number collision 409 `conflict` "already exists" (`pg.Map`).

No order route takes a free-text filter. The one query filter, `status`, is checked against the seven enum values before any query runs, so a NUL byte in it is 400 field `status` and never reaches Postgres; `reason` and `note` arrive through `httpx.ReadJSON`, which refuses a NUL byte anywhere in the body with 400 (platform "Request body limits"). The NUL rule of L4's search routes therefore needs no requirement here.

## Decisions
1. **Ownership (D24, D25).** `internal/order` runs SQL only on `orders`, `order_items`, `order_events`; it reads carts, stock, stores, products, addresses and customers only through `cart`, `stock`, `store`, `catalog`, `address` and `auth`. Three of those readers do not exist in the landed code and are added here, each a few lines over an existing or one new query in its own package (`address.Get`, `auth.CustomerByID`, `store.All`; bodies in Interfaces). `internal/staff` runs no SQL at all. Ceiling: none.
2. **Placement is one `pgx.BeginFunc(ctx, pool, ...)`, in Spec 2 §4's order.** Inside the function, with `tx`:
    1. `storeID, lines, err := cart.Lines(ctx, tx, customerID)`; `len(lines) == 0` → `&httpx.Error{400, "validation", "cart is empty"}`. The cart row lock serialises two placements by the same customer, so a double submit finds the cart gone and answers 400.
    2. `addr, err := address.Get(ctx, tx, customerID, addressID)`; an `*httpx.Error` with `Code == "not_found"` → `invalid("addressId", "unknown address")`.
    3. `s, err := store.ForPincode(ctx, tx, addr.Pincode)`; an `*httpx.Error` with `Code == "not_serviceable"`, or `s.ID != storeID` → `&httpx.Error{Status: 409, Code: "not_serviceable", Field: "addressId", Message: "the store does not deliver to this address"}`; then `!s.IsOpen` → `&httpx.Error{Status: 409, Code: "not_serviceable", Message: "the store is closed"}`. `ForPincode` returned the cart's store with its fees, so there is no `store.Get`.
    4. `stock.Reserve(ctx, tx, storeID, lines)`; its error is returned as it is (mapped after the transaction, below).
    5. `products, err := catalog.ProductsByID(ctx, tx, storeID, ids)` (ids in line order); a line whose id is missing from the map → `fmt.Errorf("order: product %s vanished during placement", id)` (cannot happen: `Reserve` holds the stock row, which a product delete would have to remove; a 500 if it ever does). `subtotal = Σ PriceCents × Quantity`; `subtotal < s.MinOrderCents` → `invalid("subtotal", "below the store's minimum order")` (the reservation rolls back with the transaction); `fee = s.DeliveryFeeCents`, or 0 when `subtotal >= s.FreeDeliveryAboveCents` (the cart's own rule in `cart.view`).
    6. `c, err := auth.CustomerByID(ctx, tx, customerID)`; `number, err := newNumber()`; `CreateOrder` (snapshots from `c`, `addr`, the totals); `AddItems` with one array element per line in line order (snapshots from `products`); `AddEvent{OrderID: id, ToStatus: db.OrderStatusPlaced, ActorType: "customer", ActorID: &customerID}` (no `FromStatus`, empty `Note`); `cart.Clear(ctx, tx, customerID)`.

    After `BeginFunc` returns: `errors.As(err, *stock.OutOfStockError)` → `&httpx.Error{Status: 409, Code: "out_of_stock", Message: "some products are out of stock", ProductIDs: e.ProductIDs}`; `pg.IsUnique(err)` → `pg.Map(err)` (number collision, Decision 10); any other error unchanged; on success the log line (Decision 7, added in task 5) and the id. Any error rolls everything back, so nothing is partly placed. A stock problem is found before a subtotal below the minimum (step 4 before 5), so a cart with both answers 409. Ceiling: about ten round trips in one transaction; fine for carts of at most 20 lines.
3. **409 for `not_serviceable` and `out_of_stock` at placement (D25).** The request is well formed; the store's state refuses it. `GET /serviceability` keeps L2's 404 (a lookup that found nothing). Ceiling: none.
4. **Snapshots (D25).** Address (label, line1, line2, pincode), customer name and phone, and per item name, unit label, image URL, price and MRP are copied at placement into plain columns. The customer's name is a snapshot too (Spec 2 §3 lists only the phone) so staff views need no read of `customers`. The item keeps `image_url` (the served path from `catalog.StoreProduct.ImageURL`), not Spec 2 §3's `image_key`: `catalog` exposes the URL, and the key is not needed to show the order. Ceiling: an image replaced under the same key changes old orders' pictures; when images move to S3 (Spec 2 §14), old rows keep the old path and need a one-off rewrite.
5. **Transitions are one table plus one rule.** `next` holds Spec 2 §4's table, seven pairs: `placed` → `accepted`, `cancelled`; `accepted` → `packing`, `cancelled`; `packing` → `ready`; `ready` → `out_for_delivery`; `out_for_delivery` → `delivered`. `allowed(from, to, actor)` is `slices.Contains(next[from], to) && (actor == "staff" || to == db.OrderStatusCancelled)`. Customers may therefore only cancel, and only from `placed` or `accepted` (D7). Admins and store staff are the same actor. Moving to the same status is forbidden (not in the table). When the rider service owns `out_for_delivery` → `delivered`, the rule gains one clause. Said plainly, because the admin app's Orders board needs it: the table has seven pairs and only two of them cancel, so nobody, staff and admins included, can cancel an order once it is `packing` or later; the status route answers 409 `conflict` "cannot move an order from packing to cancelled" (accepted by the manager, D13; `TestStatusTransitionMatrix` pins all 49 pairs for staff, `TestAllowed` for both actors). A board offers Cancel only on `placed` and `accepted` orders. Ceiling: none. (The 2026-10-12 text said nine pairs; the table has seven.)
6. **`Transition` in one `pgx.BeginFunc`.** `row, err := q.LockOrder(ctx, {ID: id, CustomerID: sc.customerID, StoreID: sc.storeID})` (`for update`; `pg.Map(err)`: no rows is 404, which is also the isolation answer for another customer's or another store's order) → `!allowed(row.Status, to, actor.Type)` → `&httpx.Error{Status: 409, Code: "conflict", Message: "cannot move an order from " + from + " to " + to}` → `SetStatus{Status: to, CancelReason: note, ID: id}` (the SQL writes `cancel_reason` only when `to` is `cancelled`, and sets `delivered_at` / `cancelled_at` from the database clock) → when `to` is `cancelled`: `OrderItems([id])`, one `stock.Line` per item, `stock.Release(ctx, tx, row.StoreID, lines)` → `AddEvent{OrderID: id, FromStatus: &row.Status, ToStatus: to, ActorType: actor.Type, ActorID: &actor.ID, Note: note}`. So the note is the event's note and, on a cancel by anyone, the order's `cancelReason` (the customer route passes `reason` as the note). Concurrent changes to one order serialise on the row lock, so a cancel racing an accept gives one 200 and one 409. After `BeginFunc` succeeds: the log line (Decision 7, added in task 5). Fixed in review (was an open ceiling in the 2026-10-13 refresh): `stock.Release` used to update its rows without locking them first, so a cancel of a multi-line order racing a placement on two of the same products could deadlock (`40P01`, a 500 with nothing written). Since ac6507e `Release` calls `LockStock` before `AddStock`, the same product id order `Reserve` locks in; `TestReleaseAndReserveDoNotDeadlock` (`internal/stock/stock_test.go`, 50 rounds, red in 8 of 10 runs before the fix) pins it, and `TestCancelConcurrent` shows five cancels at once return the stock once. Ceiling: none known (Decision 17 covers the bulk upsert).
7. **One log line per transition, after commit.** `slog.InfoContext(ctx, "order transition", "orderId", id, "number", number, "from", from, "to", to, "actorType", a.Type, "actorId", a.ID, "requestId", httpx.RequestID(ctx))`; placement omits the `"from"` pair (`to` `placed`, `actorType` `customer`, `actorId` the customer id). Written by `Transition` and `Place` themselves, only after their transaction committed, so a rolled-back transition never logs and each transition logs once. Ceiling: a crash between commit and log loses one line; the `order_events` row is the record.
8. **Scope filters in SQL.** `GetOrder` and `LockOrder` take nullable `customer_id` and `store_id`: customer routes pass `customerScope`, staff routes `staffScope`. Staff scope fails closed (525b3d7, manager's ruling): only role `admin` is unscoped; every other role, `store_staff` today and any role added later, is held to its own `StoreID`. A row outside the scope is "no rows" → 404, so existence never leaks (Spec 2 §5). `StoreList` checks in this order, before any order query: `httpx.PathID(r, "id")` → a scoped staff user (`staffScope(ctx).storeID != nil`, so any role but `admin`) whose `StoreID` is not the path id → `notFound()` → `store.Get(ctx, pool, id)` (404 for an unknown store, for admins too) → `status` → `httpx.Page` → `StoreOrders` + `CountStoreOrders` → `views` → `httpx.NewList`. `status`: `r.URL.Query().Get("status")`; empty or absent means no filter (`nil`), like `q` on the search routes; otherwise `db.OrderStatus(v).Valid()` or 400 field `status`. Ceiling: a non-admin staff row with an empty store id would send `''` to a uuid column (a 500, not "no rows"); the `staff_users_admin_has_no_store` check makes that row impossible today.
9. **Lists.** Both lists use `httpx.Page` (default 24, max 100) with `Lim: int32(pageSize), Off: int32((page-1)*pageSize)`, newest first by `placed_at desc, id desc`, and `views` loads items and events for the whole page in two queries (`= any(ids)`), so a page costs four queries. `items` and `events` are never nil. Times are written in UTC (`.UTC()` in `views`; the pool returns them in the machine's zone). Ceiling: offset paging (keyset past 10 000 orders per customer or store, L1 Decision 14); a single `status` filter (the admin board asks once per column or reads all).
10. **Order number.** `"SS-" + base32.StdEncoding.EncodeToString(5 random bytes)` from `crypto/rand`: exactly 8 characters of `A-Z2-7`, about 10^12 values. The `unique` constraint catches a collision, which fails the placement with 409 `conflict` "already exists" (`pg.Map`) and no retry on the server (accepted by the manager, D13); the client may retry. Ceiling: at a million orders a collision is about one in a million placements; add a retry loop if that ever shows up in the logs.
11. **Bodies.** Three unexported request structs with string members and these JSON tags: `POST /orders` one member `AddressID` tagged `addressId`; `POST /orders/{id}/cancel` one member `Reason` tagged `reason`, a JSON object (`{}` allowed; an empty body is 400 "invalid JSON" like every JSON route); `POST /admin/orders/{id}/status` members `Status` tagged `status` and `Note` tagged `note`. All read with `httpx.ReadJSON`. Order of checks in each handler: `PathID` (where there is one) → `ReadJSON` → field checks (`addressId`: empty "required", `!httpx.IsUUID` "must be a uuid"; `status`: `db.OrderStatus(v).Valid()`; `reason`/`note` through `text`) → the transaction. Validation therefore runs before the transaction, and a malformed order id answers 404 before the body is read. Accepted looseness (manager, D13): `encoding/json` leaves a string untouched on `null`, so a cancel body of `null` or `{"reason":null}` is treated as no reason (200) and `{"status":"accepted","note":null}` as no note; no test pins it and clients send `{}`.
12. **Dashboard.** `staff.Dashboard`: `s := auth.CurrentStaff(ctx)`; `s.Role == "admin"` → `store.All(ctx, pool)`; every other role → `store.Get(ctx, pool, s.StoreID)` alone (the same fail-closed rule as Decision 8, 525b3d7; the 2026-10-13 refresh had it the other way round). Per store, in order: `order.Today(ctx, pool, id)` and `stock.LowCount(ctx, pool, id)`. `Today` runs `CountsToday` (grouped by current status), starts the map with a 0 for each of `db.AllOrderStatusValues()` and fills the rows in, then `RevenueToday`. "Today" is `date_trunc('day', now(), 'Asia/Kolkata')` in SQL (D25): Bengaluru has no daylight saving and the database clock is the only clock (L1 Decision 5). `ordersToday` counts the orders placed today (`placed_at`) by their current status; `revenueTodayCents` sums `total_cents` of the orders in status `delivered` whose `delivered_at` is today, whenever they were placed. So an order placed yesterday and delivered today is in the revenue and in no count, and `ordersToday.delivered` times an average order is not the revenue. `TestDashboardMidnightKolkata` pins the boundary and that split with three orders around IST midnight (it skips itself in the two minutes after midnight IST, where its "a minute after midnight" order would be in the future). Any error is written with `httpx.WriteError`. Ceiling (accepted by the manager, D13): 1 + 3N queries for an admin with N stores (`ListStores`, then `CountsToday`, `RevenueToday` and `LowCount` per store), 4 for store staff; fine for a handful of stores, one grouped query per measure when N grows; `store.All` stops at 1000 stores.
13. **Status codes.** Placement 201, every other success 200 with the order; 500 `internal` is not documented per operation (L1 Decision 24).
14. **`httpx.Error.ProductIDs`.** One optional field, written only by placement's `out_of_stock`; every other error omits it. L2's `PincodeConflict` keeps its own handler-written members (L2 Decision 8). `openapi.json`'s `Error` schema gains optional `productIds` (array of `format: uuid` strings) next to `field`.
15. **Seed (D22).** `truncateTables` in `seed.go` gains `"order_events", "order_items", "orders"` under a comment `// orders (core-P2-L5)`, in task 1: they reference `customers`, `stores` and `products`, and Postgres refuses to truncate a referenced table unless the referencing ones are in the same statement, empty or not (spiked, `0A000`). `load` ends, after L4's stock insert, with four `tx.Exec` calls in this order (task 7), each wrapped like the others (`fmt.Errorf("insert demo orders: %w", err)`, `"insert demo order items: %w"`, `"set demo order totals: %w"`, `"insert demo order events: %w"`); statement 1 takes `customerID, storeKoramangala`, statement 4 takes `staffKoramangala` (constants already in `seed.go`), statements 2 and 3 take no arguments:
    ```sql
    -- 1. orders ($1 customer ...0201, $2 store ...0401); totals filled by statement 3
    insert into orders (id, number, customer_id, store_id, status, customer_name, customer_phone,
                        address_label, address_line1, address_pincode,
                        subtotal_cents, delivery_fee_cents, total_cents, placed_at, delivered_at, cancelled_at, cancel_reason)
    values
      ('00000000-0000-4000-8000-000000000701', 'SS-DEMOAAAB', $1, $2, 'delivered', 'Demo Customer', '+919800000000',
       'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '2 days', now() - interval '2 days' + interval '11 minutes', null, ''),
      ('00000000-0000-4000-8000-000000000702', 'SS-DEMOAAAC', $1, $2, 'cancelled', 'Demo Customer', '+919800000000',
       'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '1 day', null, now() - interval '1 day' + interval '2 minutes', 'Ordered by mistake'),
      ('00000000-0000-4000-8000-000000000703', 'SS-DEMOAAAD', $1, $2, 'placed', 'Demo Customer', '+919800000000',
       'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '10 minutes', null, null, '');

    -- 2. items, snapshots from the demo products
    insert into order_items (order_id, product_id, name, unit_label, image_url, price_cents, mrp_cents, quantity)
    select l.order_id::uuid, p.id, p.name, p.unit_label,
           case when p.image_key = '' then '' else '/api/core/v1/files/' || p.image_key end,
           p.price_cents, p.mrp_cents, l.quantity
    from (values
      ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000601', 2),
      ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000602', 1),
      ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000603', 1),
      ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000601', 1),
      ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000604', 3)
    ) as l (order_id, product_id, quantity)
    join products p on p.id = l.product_id::uuid;

    -- 3. totals from the items and the store's fee rule
    update orders o
    set subtotal_cents = t.subtotal,
        delivery_fee_cents = case when t.subtotal >= s.free_delivery_above_cents then 0 else s.delivery_fee_cents end,
        total_cents = t.subtotal + case when t.subtotal >= s.free_delivery_above_cents then 0 else s.delivery_fee_cents end
    from (select order_id, sum(price_cents * quantity)::bigint as subtotal from order_items group by order_id) t, stores s
    where t.order_id = o.id and s.id = o.store_id and o.number like 'SS-DEMO%';

    -- 4. events ($1 the Koramangala store staff ...0102 as the staff actor)
    insert into order_events (order_id, from_status, to_status, actor_type, actor_id, note, created_at)
    select o.id, e.from_status::order_status, e.to_status::order_status, e.actor_type,
           case e.actor_type when 'customer' then o.customer_id when 'staff' then $1::uuid end,
           e.note, o.placed_at + e.after
    from (values
      ('00000000-0000-4000-8000-000000000701', null, 'placed', 'customer', '', interval '0'),
      ('00000000-0000-4000-8000-000000000701', 'placed', 'accepted', 'staff', '', interval '1 minute'),
      ('00000000-0000-4000-8000-000000000701', 'accepted', 'packing', 'staff', '', interval '2 minutes'),
      ('00000000-0000-4000-8000-000000000701', 'packing', 'ready', 'staff', '', interval '5 minutes'),
      ('00000000-0000-4000-8000-000000000701', 'ready', 'out_for_delivery', 'staff', '', interval '6 minutes'),
      ('00000000-0000-4000-8000-000000000701', 'out_for_delivery', 'delivered', 'staff', '', interval '11 minutes'),
      ('00000000-0000-4000-8000-000000000702', null, 'placed', 'customer', '', interval '0'),
      ('00000000-0000-4000-8000-000000000702', 'placed', 'cancelled', 'customer', 'Ordered by mistake', interval '2 minutes'),
      ('00000000-0000-4000-8000-000000000703', null, 'placed', 'customer', '', interval '0')
    ) as e (order_id, from_status, to_status, actor_type, note, after)
    join orders o on o.id = e.order_id::uuid;
    ```
    Fixed rows, as spiked on the landed seed: `...0701` `SS-DEMOAAAB` delivered two days ago (2 × `...0601` Banana Robusta at 7000, 1 × `...0602` Shimla Apple at 19900: subtotal 33900, fee 0, total 33900), `...0702` `SS-DEMOAAAC` cancelled yesterday by the customer with reason "Ordered by mistake" (1 × `...0603` Alphonso Mango at 39900: 39900, 0, 39900), `...0703` `SS-DEMOAAAD` placed ten minutes before the reset (1 × `...0601`, 3 × `...0604` Pomegranate Bhagwa at 32000: 103000, 0, 103000); all for the demo customer to Home (560034) at Koramangala (fee 2500, free above 19900, minimum 9900). Items and events take generated ids. The seeded orders do not take stock (the demo stock stays L4's); Postman's cancel of `...0703` adds 1 and 3 back, harmless until the next reset. Postman `orderId` is `00000000-0000-4000-8000-000000000703` (already in `docs/postman/local.postman_environment.json`). Ceiling: the snapshot values come from L3's demo products at seed time, so the totals change if those prices change; the seed tests read them back, never hard-code them.
16. **`openapi.json` shapes.** Tag `orders` appended after `cart` ("Placing, reading, cancelling and moving orders: the customer's own orders and each store's orders for its staff."); the dashboard operation under `admin-staff`. Every operation: `operationId` from the Routes table, `summary`, `description` (who may call it, what it does, each error and when), `security: [{"bearer": []}]`, the path and query parameters with `description` and `example` in the style of `getStock`, and one `example` per response with content. Schemas: `OrderAddress`, `OrderItem`, `OrderEvent` (`fromStatus` and `note` optional), `Order` (required: every member except `customerPhone`, `deliveredAt`, `cancelledAt`, `cancelReason`; `status` and the event statuses an enum of the seven values; `actorType` an enum of `customer`, `staff`, `system`; `paymentMethod` an enum of `cod`; times `format: date-time`; ids `format: uuid`), `OrderList {items, page, pageSize, total}` shaped like `StockList`, `OrderCreate {addressId}` (required), `OrderCancel {reason?}` (`maxLength` 500), `OrderStatusChange {status, note?}` (`status` required, the enum; `note` `maxLength` 500), `DashboardStore`, `Dashboard {items}` (`ordersToday` an object with the seven statuses as required integer members); `Error` gains optional `productIds`. Path `id` example `00000000-0000-4000-8000-000000000703` on order routes and `00000000-0000-4000-8000-000000000401` on the store list; query `status` (the enum, example `placed`) on the store list and `page`, `pageSize` on both lists. Request examples (Postman's raw body): `{"addressId":"00000000-0000-4000-8000-000000000301"}`, `{"reason":"Ordered by mistake"}`, `{"status":"accepted","note":"Packing now"}`. The `Order` example, used wherever an order is answered (inside `items` of the list examples with `page` 1, `pageSize` 24, `total` 1):
    ```json
    {"id":"00000000-0000-4000-8000-000000000703","number":"SS-DEMOAAAD","storeId":"00000000-0000-4000-8000-000000000401","status":"placed","customerName":"Demo Customer","customerPhone":"+919800000000","address":{"label":"Home","line1":"12 80 Feet Rd, Koramangala","pincode":"560034"},"subtotalCents":103000,"deliveryFeeCents":0,"totalCents":103000,"paymentMethod":"cod","placedAt":"2026-10-13T09:20:00Z","items":[{"productId":"00000000-0000-4000-8000-000000000601","name":"Banana Robusta","unitLabel":"1 kg","imageUrl":"/api/core/v1/files/products/seed-fruits-vegetables.png","priceCents":7000,"mrpCents":7000,"quantity":1},{"productId":"00000000-0000-4000-8000-000000000604","name":"Pomegranate Bhagwa","unitLabel":"1 kg","imageUrl":"/api/core/v1/files/products/seed-fruits-vegetables.png","priceCents":32000,"mrpCents":32000,"quantity":3}],"events":[{"toStatus":"placed","actorType":"customer","createdAt":"2026-10-13T09:20:00Z"}]}
    ```
    The cancel route's 200 example is the same order with `"status":"cancelled"`, `"cancelledAt":"2026-10-13T09:22:00Z"`, `"cancelReason":"Ordered by mistake"` and a second event `{"fromStatus":"placed","toStatus":"cancelled","actorType":"customer","note":"Ordered by mistake","createdAt":"2026-10-13T09:22:00Z"}`; the status route's 200 example is the same order with `"status":"accepted"` and a second event `{"fromStatus":"placed","toStatus":"accepted","actorType":"staff","note":"Packing now","createdAt":"2026-10-13T09:21:00Z"}`. `POST /orders` documents its 409 once, with `examples` (the contract test accepts `example` or `examples`): `not_serviceable` `{"error":{"code":"not_serviceable","message":"the store does not deliver to this address","field":"addressId"}}`, `out_of_stock` `{"error":{"code":"out_of_stock","message":"some products are out of stock","productIds":["00000000-0000-4000-8000-000000000601"]}}`, `conflict` `{"error":{"code":"conflict","message":"already exists"}}`. The dashboard's 200 example: `{"items":[{"storeId":"00000000-0000-4000-8000-000000000401","storeName":"Koramangala","ordersToday":{"placed":1,"accepted":0,"packing":0,"ready":0,"out_for_delivery":0,"delivered":0,"cancelled":0},"lowStockCount":20,"revenueTodayCents":0}]}`. Every 400/401/404/409 example carries the message the handler writes (401: `{"error":{"code":"unauthorized","message":"sign in required"}}`, as on the other routes). The existing 409 description of `DELETE /admin/stores/{id}` already names orders and stays.
17. **Every writer of `store_stock` takes its rows in product id order (review rounds; spec'd in the `stock` delta).** `Reserve` already locked in id order (core-P2-L4). `Release` now locks with `LockStock` first (ac6507e), and the staff bulk upsert `UpsertStock` inserts from a subquery `(select unnest(@product_ids::uuid[]) as product_id, unnest(@quantities::integer[]) as quantity) t order by t.product_id` (5049692; sqlc v1.31.1 rejects the two-argument `unnest` in `from`, and this is the shape `AddStock` already uses), so a placement, a cancel and a stock save naming the same products cannot wait on each other in a cycle. Tests: `TestReleaseAndReserveDoNotDeadlock`, `TestUpsertAndReserveDoNotDeadlock` (`internal/stock/stock_test.go`, 50 rounds each, both red with `40P01` before their fix). This is written as a MODIFIED `stock` requirement ("Concurrent reservations never oversell"), not left as a design note: the living `stock` spec already promises that reservations do not deadlock, with a scenario; a deadlock is visible to a customer or to staff as a 500 on a cancel, a placement or a stock save; and without the requirement the two tests guard nothing the spec names. Ceiling: the upsert test drives the `UpsertStock` query, not `PUT /admin/stores/{id}/stock`; the handler runs that one query and nothing else on `store_stock`. Postgres does not promise that `insert ... select ... order by` takes its row locks in that order under every plan; for one `unnest` subquery it does, and the test would show a change.

## Test strategy
`make test-core` (`go test -race` on `shopperstop_core_test`, a schema per package and run; D26: no other database). `internal/order` tests are package `order` (for the unexported `allowed`), with `TestMain` on `testdb.Migrated("order")`; everything with HTTP goes through `internal/app`'s real router (`srv`, `testPool`), whose schema is shared by every test in the package, so fixtures never count rows globally and never reuse a pincode. No test in the module calls `t.Parallel`, so tests of one package run one after another.

Landed `internal/app` helpers the order tests reuse, by name: `call(t, method, path, token, body) (int, []byte)`, `decodeError`, `expectError(t, what, status, body, wantStatus, code, field, message)` (an empty message is not compared), `newCustomer(t) sessionBody` (`.Token`, `.Customer.ID`; name `Asha`, no phone, cheap hash), `createAddress(t, token, body) addressJSON`, `insertStore(t, isOpen, pincodes...) string` (fee 2500, free above 19900, minimum 9900, promised 10), `insertProduct(t, name, active) string`, `cartProduct(t, storeID, name, price) string` (active, price = MRP, 50 in stock at the store), `stockName(t) string` (a unique name), `quantityAt(t, storeID, productID) int32`, `setLine(t, token, storeID, productID, quantity) cartUpdateView`, `readCart(t, token) cartView`, `cartRows(t, customerID) int`, `adminToken(t) string`, `staffSignIn(t, email) string`, `storeStaffToken(t) string` (staff of `testStoreID`), `uniqueEmail(t)`, `cheapHash()`, `testStoreID`, `storeStaffEmail`, `adminStaffEmail`, `adminStoresPath`, `productsPath`.

New helpers, each written once in the task named and reused after it:
- task 2, `orders_test.go`: `const ordersPath = "/api/core/v1/orders"`; `const missingOrderID = "00000000-0000-4000-8000-0000000007fd"`; `nextPincode() string` (`fmt.Sprint(570000 + orderPin.Add(1))` on an `atomic.Int64`; this lane's block is `57xxxx`, other files use `5611xx` to `5613xx`); `type shop struct{ ID, Pincode string }` and `newShop(t) shop` (`insertStore(t, true, pincode)`, then `update stores set min_order_cents = 0 where id = $1`); `stockTo(t, storeID, productID string, n int)` (`update store_stock set quantity = $3 where store_id = $1 and product_id = $2`); `type buyer struct{ Token, ID, AddressID string }` and `newBuyer(t, pincode string) buyer` (`newCustomer`, `PATCH /me` `{"phone":"+919800000001"}` expecting 200, `createAddress` with `{"label":"Home","line1":"12 Test Rd","pincode":pincode}`); `orderView`, `orderItemView`, `orderEventView` (the JSON of Interfaces; times `time.Time`, `DeliveredAt`/`CancelledAt` `*time.Time`); `place(t, b buyer) (int, []byte)` (`POST /orders` `{"addressId": b.AddressID}`); `mustPlace(t, b buyer) orderView` (fails unless 201). `envelope` in `app_test.go` gains `ProductIDs []string` with tag `productIds`.
- task 3, `orders_test.go`: `orderListView{Items []orderView; Page, PageSize int; Total int64}`; `readOrder(t, path, token string) orderView` (GET, fails unless 200).
- task 4, `orders_cancel_test.go`: `forceStatus(t, orderID, status string)` (`update orders set status = $2::order_status where id = $1`); `orderStatus(t, orderID string) string` and `eventCount(t, orderID string) int` by plain SQL.
- task 5, `orders_staff_test.go`: `shopStaffToken(t, storeID string) string` (inserts `staff_users (email, password_hash, name, role, store_id)` with `uniqueEmail(t)`, `cheapHash()`, `'Shop Staff'`, `'store_staff'`, the store, then `staffSignIn`: milliseconds, so a staff user per shop is free and no `sync.Once` or `auth.CreateStaff` is needed); `orderIn(t, storeID, customerID, productID, status string) string` inserts with `testPool` and returns the order id: an order (`number` = `"SS-" + base32.StdEncoding.EncodeToString(b[3:])` where `b` is the 8 big-endian bytes of an `atomic.Int64` counter; `status` cast `::order_status`; `customer_name` `'Asha'`, `customer_phone` `'+919800000001'`, `address_label` `'Home'`, `address_line1` `'12 Test Rd'`, `address_pincode` `'570000'`, subtotal 2000, fee 0, total 2000), one item (`name` `'Fixture'`, `unit_label` `'1 unit'`, price and MRP 1000, quantity 2) and one event (`to_status` `'placed'`, `actor_type` `'customer'`, `actor_id` the customer); it takes no stock.

The race test starts two goroutines on one closed channel, each posting `/orders` for its own buyer, for 5 rounds; each round first sets the stock to 1 (`stockTo`), then sets both carts to 1 (`setLine`), in that order because the cart clamps to stock. The log test swaps `slog.SetDefault` for a JSON handler on a mutex-guarded buffer (`type lockedBuffer struct{ mu sync.Mutex; b bytes.Buffer }` with locking `Write` and `String`: the router writes its `request` line from the server's goroutine after the response has reached the test, so a bare `bytes.Buffer` is a data race under `-race`) and restores the logger in `t.Cleanup`; it counts only lines whose `msg` is `order transition` and whose `orderId` is the test's order. Seed tests extend `internal/seed/seed_test.go` and use its own `server(t)`, `assertSQL`, `assertCount`.

## Risks / Trade-offs
- [Three small exported readers land in packages owned by earlier lanes (`address`, `auth`, `store`)] → granted by the core manager (D25); no behaviour change, one function each, bodies in Interfaces.
- [D26: 0006 is unmerged until this lane's PR lands] → only the tests apply it, on `shopperstop_core_test`. After the PR merges, `make dev` and `make e2e` on `main` migrate and seed the dev and e2e databases themselves. From then on the seeded products `...0601` to `...0604` and the Koramangala store cannot be deleted (409), which is what Postman's `DELETE /admin/products/{{productId}}` expects; an apps e2e test that deletes one of them would fail (none does today).
- [`stock.Release` could deadlock with `stock.Reserve`, and the staff bulk upsert with either] → fixed in this lane (ac6507e, 5049692): every writer of `store_stock` takes its rows in product id order; `TestReleaseAndReserveDoNotDeadlock`, `TestUpsertAndReserveDoNotDeadlock` (Decisions 6 and 17).
- [A product delete racing a placement of that product] → in theory a lock cycle: the delete takes the `products` row, then cascades to its `store_stock` rows, while placement holds the `store_stock` row from `Reserve` and then inserts `order_items`, whose foreign key needs a share lock on the `products` row. Postgres would abort one of the two (`40P01`, a 500 with nothing written; the retry answers correctly). Not reproduced and not acted on (accepted by the manager, D13); if it shows in the logs, the fix is placement locking the product rows `for share` before `Reserve`.
- [Postman run order] → the `orders` folder runs top to bottom on one seed: `POST /orders` answers 400 if the cart folder emptied the cart (or the cart is below the minimum), and `POST /admin/orders/{{orderId}}/status` answers 409 once `POST /orders/{{orderId}}/cancel` has cancelled `...0703`. The collection asserts no statuses; a fresh `seed-demo --reset` restores both.
- [Dashboard "today" near midnight IST] → an order placed a moment before midnight leaves "today" at midnight; the tests backdate by two days, except `TestDashboardMidnightKolkata`, which places its orders a minute either side of IST midnight on a fresh store and skips itself in the first two minutes of the IST day; no test asserts the dashboard on seeded orders.
- [Order-number collision] → 409 `conflict` and a client retry, no server retry (Decision 10).
- [The app test package grows slower] → each placement is a few milliseconds and no fixture pays bcrypt cost 12 (customers and staff are inserted with `cheapHash`).

## Migration Plan
Forward only, like every core migration. Before the merge 0006 exists only in test schemas of `shopperstop_core_test` (D26). After the merge `core-admin migrate` applies it at the start of `make dev` and `make e2e` on `main`; no data to move (no orders exist before it). Rollback is a database reset by the orchestrator (`seed-demo --reset` after `migrate`).
