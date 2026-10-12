# Design

## Context
Builds on, without redefining: core-P2-L1 `core-accounts-auth` (archived; migration 0002 with `order_status`, `set_updated_at()`, `customers`, `addresses`; `sqlc.yaml`; `pg.Map`/`IsUnique`; `testdb.Migrated`; `httpx` `ReadJSON`/`Page`/`NewList`/`PathID`/`IsUUID`/`WriteError`; `auth` `RequireCustomer`/`RequireStaff`/`CustomerID`/`CurrentStaff`; `seed.Reset`/`Load` with Decision 22's id blocks, `...07xx` reserved for orders; the contract and security tests; the `app` test fixtures), core-P2-L2 `core-stores-serviceability` (0003 `stores`, `store_service_areas`; `store.Get`, `store.ForPincode`, `store.Store`; demo stores `...0401` Koramangala, `...0402` Indiranagar; store staff `...0102`, `...0103`), core-P2-L3 `core-catalog` (0004 `categories`, `products`; demo products `...0601` to `...0694`) and core-P2-L4 `core-stock-cart` (0005 `store_stock`, `carts`, `cart_items`; `stock.Reserve`/`Release`/`LowCount`/`OutOfStockError`/`Line`, `cart.Lines`/`Clear`, `catalog.ProductsByID`/`StoreProduct`; demo stock). All four merge before task 1 starts and this branch is rebased onto them. Behaviour comes from this change's deltas (`orders`, `admin-staff`, `admin-stores`, `platform`). PLAN.md D7 (customers cancel only while placed or accepted; store staff see the customer's phone), D19/D23 (commit regenerated `core.d.ts` and Postman collection), D20 (bearer `security`, `/admin/` prefix, fixed ids), D22 (seed grows per lane), D24 (no SQL on another package's tables; read-only joins only for `catalog` and `stock`).

A spike on 2026-10-12 (scratch copy of `services/core` at 8a2a603 with L2's 0003 and L4's 0005 from their design.md, L3's committed 0004, sqlc v1.31.1, `shopperstop_core_test`) confirmed the migration, the `sqlc.yaml` entry, `queries/order.sql` and the `AddressByID` query below verbatim: they generate and vet; timestamps scan into `time.Time` / `*time.Time`; `OrderStatus.Valid()` and `AllOrderStatusValues()` are generated; a lowercase number is `23514` `orders_number_check`; a duplicate number `23505` `orders_number_key`; a wrong total `23514` `orders_total`; deleting an ordered product is `23503` `order_items_product_id_fkey`; deleting a store with an order is `23503` `orders_store_id_fkey`; the nullable scope filters hide another store's order; `CountsToday` and `RevenueToday` count today's rows and drop rows backdated two days; one `truncate` of every demo table succeeds; the demo-order statements of Decision 15 load three orders with totals 15200, 7000 and 30100 on placeholder products. Workers copy these; they do not redesign them.

### Assumptions about L2, L3, L4 (from their change folders and lane logs, 2026-10-12)
- `store.ForPincode(ctx, q db.DBTX, pincode) (store.Store, error)` answers `*httpx.Error` 404 `not_serviceable` when no store serves it; `store.Store` has `ID`, `Name`, `IsOpen`, `DeliveryFeeCents`, `FreeDeliveryAboveCents`, `MinOrderCents`. L2's `ListStores` query (`limit $1 offset $2`) and its row-to-`Store` conversion exist.
- `cart.Lines(ctx, tx pgx.Tx, customerID) (storeID string, lines []stock.Line, err error)` locks the cart; no cart is `"", nil, nil`. `cart.Clear(ctx, d, customerID) error`.
- `stock.Reserve(ctx, tx, storeID, lines) error` (all or nothing; `*stock.OutOfStockError{ProductIDs}` ascending), `stock.Release(ctx, tx, storeID, lines) error`, `stock.LowCount(ctx, d, storeID) (int64, error)`, `stock.Line{ProductID string; Quantity int32}`.
- `catalog.ProductsByID(ctx, d, storeID, ids) (map[string]catalog.StoreProduct, error)` with `Name`, `UnitLabel`, `ImageURL`, `MrpCents`, `PriceCents` (inactive products included).
- If a name moved before the rebase, the worker uses the landed name and notes it in the lane log; a behaviour difference (for example `Reserve` no longer naming inactive products) stops the worker and goes to the team lead.

## Goals / Non-Goals
**Goals:** every scenario in the four deltas has a Go test against the real database or through the real router; web gets checkout, order history, tracking and cancel; admin gets the order board, order detail, status changes and the dashboard; Postman's `orderId` is a fixed demo order.

**Non-Goals:** a status filter with several values, keyset paging, store name or promised minutes inside the order (clients read `GET /stores/{id}`), the event's `actorId` in responses, a retry on order-number collision, an `actor_type` `system` caller (reserved for the rider service).

## Files (all in `services/core/` unless noted)
```
migrations/0006_orders.sql                 schema below, verbatim
sqlc.yaml                                  one entry appended (below)
queries/order.sql                          verbatim below
queries/address.sql                        AddressByID appended (below)
internal/order/db/*, internal/*/db/*      sqlc output, never hand-edited (every package's models.go gains the three tables)
internal/order/order.go                    Order, Item, Event, Address, Actor, scope, views, newNumber
internal/order/place.go                    Place
internal/order/status.go                   next, allowed, Transition, Today
internal/order/handlers.go                 Create, List, Get, Cancel, StoreList, AdminGet, SetStatus
internal/order/*_test.go                   schema rules, allowed table, newNumber
internal/staff/dashboard.go                Dashboard handler
internal/address/address.go                Get (exported reader)
internal/auth/customer.go                  CustomerByID (exported reader over the existing query)
internal/store/store.go                    All (exported reader over the existing ListStores query)
internal/httpx/errors.go, json_test.go     Error.ProductIDs
internal/seed/seed.go, seed_test.go        truncate list, demo orders
internal/app/app.go                        eight routes
internal/app/orders_test.go, orders_staff_test.go, dashboard_test.go, TestAuthGates rows
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
`orders.store_id` and `orders.customer_id` carry no `on delete` (no action): a store with orders cannot be deleted (L2's delete answers 409 through `pg.Map` with no code change), and nothing deletes customers. `order_items.product_id ... on delete restrict` makes L3's "ordered product cannot be deleted" real with no code change in `catalog`. `order_items` and `order_events` reference `orders` without cascade: orders are never deleted, only truncated by the seed. No `addresses` foreign key: the address is a snapshot and the customer may delete the address later.

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
The two timestamp overrides apply to this entry only; other packages keep `pgtype.Timestamptz`.

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
select id, status, store_id from orders
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
Generated: `db.Order` (every column; `Status OrderStatus`, `PlacedAt time.Time`, `DeliveredAt`, `CancelledAt *time.Time`), `CreateOrderParams{Number, CustomerID, StoreID, CustomerName, CustomerPhone, AddressLabel, AddressLine1, AddressLine2, AddressPincode string; SubtotalCents, DeliveryFeeCents, TotalCents int64}` returning the id, `AddItemsParams{OrderID string; ProductIds, Names, UnitLabels, ImageUrls []string; PriceCents, MrpCents []int64; Quantities []int32}`, `AddEventParams{OrderID string; FromStatus *OrderStatus; ToStatus OrderStatus; ActorType string; ActorID *string; Note string}`, `GetOrderParams` / `LockOrderParams{ID string; CustomerID, StoreID *string}`, `LockOrderRow{ID string; Status OrderStatus; StoreID string}`, `SetStatusParams{Status OrderStatus; CancelReason, ID string}`, `CustomerOrdersParams{CustomerID string; Off, Lim int32}`, `StoreOrdersParams{StoreID string; Status *OrderStatus; Off, Lim int32}`, `CountStoreOrdersParams{StoreID string; Status *OrderStatus}`, `OrderItemsRow`, `OrderEventsRow{OrderID string; FromStatus *OrderStatus; ToStatus OrderStatus; ActorType, Note string; CreatedAt time.Time}`, `CountsTodayRow{Status OrderStatus; Orders int64}`, `RevenueToday` returns `int64`. (sqlc refuses one parameter used twice in an `insert ... values` arithmetic expression, so `total_cents` is passed; the `orders_total` check guards it.)

### Appended to `queries/address.sql` (verbatim)
```sql
-- name: AddressByID :one
select id, label, line1, line2, pincode, is_default from addresses where id = $1 and customer_id = $2;
```
Generated `AddressByIDParams{ID, CustomerID string}` and `AddressByIDRow`, convertible with `Address(row)` like the other rows.

## Interfaces
```go
// internal/httpx (one field; L4's request)
type Error struct {
    Status     int      `json:"-"`
    Code       string   `json:"code"`
    Message    string   `json:"message"`
    Field      string   `json:"field,omitempty"`
    ProductIDs []string `json:"productIds,omitempty"` // only with out_of_stock
}

// Exported readers in packages owned by earlier lanes (no new behaviour, D24 ownership kept):
func address.Get(ctx context.Context, d db.DBTX, customerID, id string) (address.Address, error) // AddressByID; no rows -> pg.Map 404
func auth.CustomerByID(ctx context.Context, d db.DBTX, id string) (auth.Customer, error)       // existing CustomerByID query
func store.All(ctx context.Context, d db.DBTX) ([]store.Store, error)                         // ListStores limit 1000 offset 0, by name

// internal/order
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
    CreatedAt  time.Time `json:"createdAt"`            // UTC
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
    PlacedAt         time.Time  `json:"placedAt"`              // UTC
    DeliveredAt      *time.Time `json:"deliveredAt,omitempty"`
    CancelledAt      *time.Time `json:"cancelledAt,omitempty"`
    CancelReason     string     `json:"cancelReason,omitempty"`
    Items            []Item     `json:"items"`                 // never nil
    Events           []Event    `json:"events"`                // never nil, oldest first
}
type Actor struct{ Type, ID string } // Type "customer" or "staff"
type scope struct{ customerID, storeID *string } // nil = no filter; customer: own id; store staff: own store; admin: none

func Place(ctx context.Context, pool *pgxpool.Pool, customerID, addressID string) (id string, err error)
func Transition(ctx context.Context, pool *pgxpool.Pool, id string, sc scope, to db.OrderStatus, actor Actor, note string) error
func Today(ctx context.Context, d db.DBTX, storeID string) (byStatus map[string]int64, revenueCents int64, err error) // all seven keys
func views(ctx context.Context, q *db.Queries, rows []db.Order) ([]Order, error) // one OrderItems and one OrderEvents call for the page
func newNumber() (string, error) // "SS-" + base32.StdEncoding of 5 crypto/rand bytes (8 characters, no padding)
var next = map[db.OrderStatus][]db.OrderStatus{ /* Spec 2 §4 table, Decision 5 */ }
func allowed(from, to db.OrderStatus, actorType string) bool

// handlers, plain functions like L4's, each func(pool *pgxpool.Pool) http.HandlerFunc:
// Create (POST /orders), List (GET /orders), Get (GET /orders/{id}), Cancel (POST /orders/{id}/cancel),
// StoreList (GET /admin/stores/{id}/orders), AdminGet (GET /admin/orders/{id}), SetStatus (POST /admin/orders/{id}/status)

// internal/staff
type DashboardStore struct {
    StoreID           string           `json:"storeId"`
    StoreName         string           `json:"storeName"`
    OrdersToday       map[string]int64 `json:"ordersToday"` // seven keys, from db.AllOrderStatusValues()
    LowStockCount     int64            `json:"lowStockCount"`
    RevenueTodayCents int64            `json:"revenueTodayCents"`
}
func Dashboard(pool *pgxpool.Pool) http.HandlerFunc // GET /admin/dashboard -> {"items": []DashboardStore}
```
Imports (no cycles): `order` → `cart`, `stock`, `store`, `catalog`, `address`, `auth`, `httpx`, `pg`; `staff` → `order`, `stock`, `store`, `auth`, `httpx`. None of those import `order` or `staff`.

## Routes (`internal/app.New`, flat full paths under `/api/core/v1`)
| Method and path | Middleware | Handler | Tag | Answers |
|---|---|---|---|---|
| POST /orders | RequireCustomer | `order.Create(pool)` | orders | 201 Order; 400; 401; 409 `not_serviceable`, `out_of_stock` |
| GET /orders | RequireCustomer | `order.List(pool)` | orders | 200 OrderList; 400; 401 |
| GET /orders/{id} | RequireCustomer | `order.Get(pool)` | orders | 200 Order; 401; 404 |
| POST /orders/{id}/cancel | RequireCustomer | `order.Cancel(pool)` | orders | 200 Order; 400; 401; 404; 409 `conflict` |
| GET /admin/stores/{id}/orders | RequireStaff | `order.StoreList(pool)` | orders | 200 OrderList; 400; 401; 404 |
| GET /admin/orders/{id} | RequireStaff | `order.AdminGet(pool)` | orders | 200 Order; 401; 404 |
| POST /admin/orders/{id}/status | RequireStaff | `order.SetStatus(pool)` | orders | 200 Order; 400; 401; 404; 409 `conflict` |
| GET /admin/dashboard | RequireStaff | `staff.Dashboard(pool)` | admin-staff | 200 Dashboard; 401 |

Messages (handlers write exactly these): empty cart 400 "cart is empty" (no field); `addressId` absent 400 field `addressId` "required", not a uuid "must be a uuid", not the customer's "unknown address"; below minimum 400 field `subtotal` "below the store's minimum order"; pincode not served by the cart's store 409 `not_serviceable` field `addressId` "the store does not deliver to this address"; store closed 409 `not_serviceable` "the store is closed"; stock 409 `out_of_stock` "some products are out of stock" with `productIds`; forbidden transition 409 `conflict` "cannot move an order from <from> to <to>"; unknown or missing `status` 400 field `status` "must be one of placed, accepted, packing, ready, out_for_delivery, delivered, cancelled"; `reason` or `note` over 500 characters 400 field `reason`/`note` "at most 500 characters"; unknown order, other customer's or other store's order, unknown store 404 "not found".

## Decisions
1. **Ownership (D24).** `internal/order` runs SQL only on `orders`, `order_items`, `order_events`; it reads carts, stock, stores, products, addresses and customers only through `cart`, `stock`, `store`, `catalog`, `address` and `auth`. Three of those readers do not exist yet and are added here, each a few lines over an existing or one new query in its own package (`address.Get`, `auth.CustomerByID`, `store.All`): adding them keeps ownership intact where a read-only join would need a new D24 exception. `internal/staff` runs no SQL at all. Ceiling: none.
2. **Placement is one `pgx.BeginFunc`, in Spec 2 §4's order.** (1) `cart.Lines(tx, customer)`: no lines → 400 "cart is empty"; the cart row lock serialises two placements by the same customer, so a double submit finds the cart gone and answers 400. (2) `address.Get(tx, customer, addressId)`: 404 → 400 `addressId` "unknown address". (3) `store.ForPincode(tx, address.Pincode)`: its 404 `not_serviceable`, or a store id other than the cart's → 409 `not_serviceable` field `addressId`; `!IsOpen` → 409 `not_serviceable` "the store is closed". `ForPincode` returns the cart's store with its fees, so no `store.Get`. (4) `stock.Reserve(tx, storeID, lines)`: `*stock.OutOfStockError` → 409 `out_of_stock` with its `ProductIDs`. (5) `catalog.ProductsByID(tx, storeID, ids)` for the snapshot and current prices; subtotal = Σ price × quantity; below `MinOrderCents` → 400 `subtotal` (the reservation rolls back with the transaction); fee = 0 when subtotal ≥ `FreeDeliveryAboveCents`, else `DeliveryFeeCents`. (6) `auth.CustomerByID(tx, customer)` for the name and phone snapshot; `newNumber()`; `CreateOrder`; `AddItems` in cart order; `AddEvent` (no from, `placed`, `customer`, the customer's id); `cart.Clear(tx, customer)`. After commit: the log line (Decision 7), then `GetOrder` + `views` for the 201 body. Any error rolls everything back, so nothing is partly placed. Ceiling: about ten round trips in one transaction; fine for carts of at most 20 lines.
3. **409 for `not_serviceable` and `out_of_stock` at placement.** The request is well formed; the store's state refuses it. `GET /serviceability` keeps L2's 404 (a lookup that found nothing). Ceiling: none.
4. **Snapshots.** Address (label, line1, line2, pincode), customer name and phone, and per item name, unit label, image URL, price and MRP are copied at placement. The customer's name is a snapshot too (Spec 2 §3 lists only the phone) so staff views need no read of `customers`. The item keeps `image_url` (the served path from `catalog.StoreProduct.ImageURL`), not Spec 2 §3's `image_key`: `catalog` exposes the URL, and the key is not needed to show the order. Ceiling: an image replaced under the same key changes old orders' pictures; when images move to S3 (Spec 2 §14), old rows keep the old path and need a one-off rewrite.
5. **Transitions are one table plus one rule.** `next` holds Spec 2 §4's table (`placed` → `accepted`, `cancelled`; `accepted` → `packing`, `cancelled`; `packing` → `ready`; `ready` → `out_for_delivery`; `out_for_delivery` → `delivered`); `allowed(from, to, actor)` is `to ∈ next[from] && (actor == "staff" || to == cancelled)`. Customers may therefore only cancel, and only from `placed` or `accepted` (D7). Admins and store staff are the same actor. Moving to the same status is forbidden (not in the table). When the rider service owns `out_for_delivery` → `delivered`, the rule gains one clause. Ceiling: none.
6. **`Transition` in one transaction.** `LockOrder(id, scope)` (`for update`; no rows → 404, which is also the isolation answer for another customer's or another store's order) → `allowed` or 409 → `SetStatus` (sets `delivered_at` / `cancelled_at` / `cancel_reason` in SQL from the database clock) → when `to` is `cancelled`, `OrderItems([id])` → `stock.Release(tx, storeID, lines)` → `AddEvent(from, to, actor, note)`. The customer cancel passes `reason` as both the note and `cancel_reason`; the staff route passes `note`. Concurrent changes to one order serialise on the row lock, so a cancel racing an accept gives one 200 and one 409. Ceiling: none.
7. **One log line per transition, after commit.** `slog.InfoContext(ctx, "order transition", "orderId", id, "number", number, "from", from, "to", to, "actorType", a.Type, "actorId", a.ID, "requestId", httpx.RequestID(ctx))`; placement omits `from`. Logged only after the commit succeeds, so a rolled-back transition never logs. Ceiling: a crash between commit and log loses one line; the `order_events` row is the record.
8. **Scope filters in SQL.** `GetOrder` and `LockOrder` take nullable `customer_id` and `store_id`: customer routes pass the customer's id, store staff their store, admins neither. A row outside the scope is "no rows" → 404, so existence never leaks (Spec 2 §5). `StoreList` checks before any query: `PathID` → store staff with another store id → 404 → `store.Get` (404 for unknown, also for admins) → `status` (absent, or `db.OrderStatus(s).Valid()`, else 400) → `httpx.Page` → `StoreOrders` + `CountStoreOrders`. Ceiling: none.
9. **Lists.** Both lists use `httpx.Page` (default 24, max 100), newest first by `placed_at desc, id desc`, and `views` loads items and events for the whole page in two queries (`= any(ids)`), so a page costs four queries. `items` and `events` are never nil. Times are written in UTC. Ceiling: offset paging (keyset past 10 000 orders per customer or store, L1 Decision 14); a single `status` filter (the admin board asks once per column or reads all).
10. **Order number.** `"SS-" + base32.StdEncoding.EncodeToString(5 random bytes)` from `crypto/rand`: exactly 8 characters of `A-Z2-7`, about 10^12 values. The `unique` constraint catches a collision, which fails the placement with 409 `conflict` (`pg.Map`); the client may retry. Ceiling: at a million orders a collision is about one in a million placements; add a retry loop if that ever shows up in the logs.
11. **Bodies.** `POST /orders` `{addressId}`; `POST /orders/{id}/cancel` `{reason?}`, a JSON object (`{}` allowed, an empty body is 400 "invalid JSON" like every JSON route); `POST /admin/orders/{id}/status` `{status, note?}`. `reason` and `note` are trimmed and at most 500 runes. Validation runs before the transaction.
12. **Dashboard.** `staff.Dashboard`: admin → `store.All(pool)`; store staff → `store.Get(pool, staff.StoreID)` alone. Per store: `order.Today(pool, id)` (`CountsToday` grouped by current status, filled to all seven keys from `db.AllOrderStatusValues()`, and `RevenueToday`) and `stock.LowCount(pool, id)`. "Today" is `date_trunc('day', now(), 'Asia/Kolkata')` in SQL: Bengaluru has no daylight saving and the database clock is the only clock (L1 Decision 5). Orders count by `placed_at`, revenue by `delivered_at`. Ceiling: three queries per store (fine for a handful of stores); `store.All` stops at 1000 stores.
13. **Status codes.** Placement 201, every other success 200 with the order; 500 `internal` is not documented per operation (L1 Decision 24).
14. **`httpx.Error.ProductIDs`.** One optional field, written only by placement's `out_of_stock`; every other error omits it. L2's `PincodeConflict` keeps its own handler-written members (L2 Decision 8). `openapi.json`'s `Error` schema gains optional `productIds` (array of uuid strings).
15. **Seed (D22).** `seed.Reset`'s single `truncate` gains `order_events, order_items, orders` (they reference `customers`, `stores` and `products`, truncated in the same statement). `Load` ends, after L4's stock, with four statements, run in this order (spiked):
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
    Fixed rows: `...0701` `SS-DEMOAAAB` delivered two days ago (2 × `...0601`, 1 × `...0602`), `...0702` `SS-DEMOAAAC` cancelled yesterday by the customer with reason "Ordered by mistake" (1 × `...0603`), `...0703` `SS-DEMOAAAD` placed ten minutes before the reset (1 × `...0601`, 3 × `...0604`); all for the demo customer to Home (560034) at Koramangala. Items and events take generated ids. The seeded orders do not take stock (the demo stock stays L4's); Postman's cancel of `...0703` adds 1 and 3 back, harmless until the next reset. Postman `orderId` is `00000000-0000-4000-8000-000000000703`. Ceiling: the snapshot values depend on L3's demo products at seed time, so `SS-DEMOAAAD`'s totals change if L3's prices change (tests read them back, never hard-code them).
16. **`openapi.json` shapes.** Tag `orders` appended after L4's tags ("Placing, reading, cancelling and moving orders"); the dashboard operation under `admin-staff`. Schemas: `OrderAddress`, `OrderItem`, `OrderEvent` (`fromStatus` optional), `Order` (required: every member except `customerPhone`, `deliveredAt`, `cancelledAt`, `cancelReason`; `status` and the event statuses an enum of the seven values; times `format: date-time`), `OrderList {items, page, pageSize, total}`, `OrderCreate {addressId}`, `OrderCancel {reason?}` (`maxLength` 500), `OrderStatusChange {status, note?}`, `DashboardStore`, `Dashboard {items}` (`ordersToday` an object with the seven statuses as required integer members); `Error` gains optional `productIds`. Path `id` example `00000000-0000-4000-8000-000000000703` on order routes and `00000000-0000-4000-8000-000000000401` on the store list; query `status` (enum) and `page`, `pageSize` on both lists. Request examples (Postman's raw body): `{"addressId":"00000000-0000-4000-8000-000000000301"}`, `{"reason":"Ordered by mistake"}`, `{"status":"accepted","note":"Packing now"}`. Response examples: the `Order` example is the demo placed order `...0703` with one item `...0601` Banana Robusta and its `placed` event; 409 `out_of_stock` `{"error":{"code":"out_of_stock","message":"some products are out of stock","productIds":["00000000-0000-4000-8000-000000000601"]}}`; every 400/401/404/409 with the message the handler writes. All eight operations carry `security: [{"bearer": []}]` and a 401 example.

## Test strategy
`make test-core` (`go test -race` on `shopperstop_core_test`, per-package schemas). `internal/order` tests (package `order` for the unexported `allowed` and `newNumber`; `TestMain` with `testdb.Migrated("order")`) cover the schema rules and the table; everything with HTTP goes through `internal/app`'s real router (`srv`), whose schema is shared by every test in the package, so fixtures use unique names and the pincode block `57xxxx` (an `atomic.Int64` counter from 570000; L2 uses `5611xx` to `5613xx`). Fixture helpers in `internal/app/orders_test.go` (task 2, reused by later tasks): `newShop(t, opts)` inserts with `testPool` an open store (fee 2500, free above 19900, minimum 0 unless set), one served pincode, a category and products with given prices and stock (column lists from 0003 to 0005); `newBuyer(t, shop)` registers a customer through the router (L1's helper) and creates an address at the shop's pincode; `fillCart(t, buyer, shop, productID, qty)` uses `PUT /me/cart/items`; `place(t, buyer)` posts `/orders`; `orderIn(t, shop, buyer, status)` inserts an order with one item in any status directly with `testPool` (for the transition matrix; no stock taken). Store staff for a shop come from `auth.CreateStaff` and `POST /admin/auth/sign-in` (bcrypt cost 12, so one staff user per shop, created once per file through `sync.Once`, L1 Test strategy); admin and customer tokens reuse L1's fixtures. The race test starts two goroutines on one closed channel, each posting `/orders` for its own customer, and repeats 5 rounds with the stock reset to 1; it asserts one 201, one 409 with `productIds`, and stock 0 each round. The log test swaps `slog.SetDefault` with a JSON handler on a buffer (not parallel) and restores it. `TestAuthGates` gains the eight rows: customer routes anonymous 401, customer allowed, admin 401, store staff 401; staff routes anonymous 401, customer 401, admin allowed, own-store staff allowed. Seed tests extend `internal/seed/seed_test.go`.

## Risks / Trade-offs
- [L2, L3 or L4 change a name before the rebase] → Assumptions above are the only coupling; the team lead re-reads their landed design and lane logs after the rebase and refreshes briefs 2 to 7 if names moved.
- [Three small exported readers land in packages owned by earlier lanes (`address`, `auth`, `store`)] → no behaviour change, one function each (one new query in `queries/address.sql`); the core manager's scope call, escalated in the report. Fallback if refused: a read-only join in `queries/order.sql`, which needs a D24 amendment from the orchestrator.
- [Postman run order] → the `orders` folder runs top to bottom on one seed: `POST /orders` answers 400 if the cart folder emptied the cart (or the cart is below the minimum), and `POST /admin/orders/{{orderId}}/status` answers 409 once `POST /orders/{{orderId}}/cancel` has cancelled `...0703`. The collection asserts no statuses; a fresh `seed-demo --reset` restores both.
- [Dashboard "today" near midnight IST] → an order placed a moment before midnight leaves "today" at midnight; tests backdate by two days, never by minutes.
- [Order-number collision] → 409 and a client retry (Decision 10).
- [The app test package grows slower] → each placement is a few milliseconds; the bcrypt cost is in registrations and store-staff sign-ins, kept to one per shop per file.

## Migration Plan
Forward only, like every core migration: `core-admin migrate` applies 0006 on start of `make dev`/`make e2e`; no data to move (no orders exist before it). Rollback is a database reset (`seed-demo --reset` on dev and e2e).
