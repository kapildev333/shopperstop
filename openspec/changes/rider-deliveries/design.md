## Context

See proposal.md for why. Inputs read: PLAN.md D29 to D32 (read-only), `.claude/areas/rider.md` (preamble, work package "rider-P3-L2 `rider-deliveries`", `## Requests`), `.claude/areas/core.md` `## Requests`, the rider-service-foundation change (design Decisions 1 to 14 and Interfaces), all of `services/rider` at `2703cc1` (the code is authoritative over the work package), core's `openapi.json` operations `listStoreOrders`, `getAdminOrder`, `setOrderStatus`, `getOrder` and the `Order`, `OrderItem`, `OrderAddress`, `OrderStatusChange` schemas, core's `internal/seed` (`seed.go`, `catalog.go`, `summary.go`) and `internal/order/status.go` (the `order transition` log), `docs/postman/local.postman_environment.json`, and the lane logs rider-P3-L1, core-P3-L1, platform-P3-L1.

Facts relied on (checked 2026-10-15 at `2703cc1`): core admits the service token on the four routes above and answers 401 to it elsewhere (403 on staff routes); `POST /admin/orders/{id}/status` from a service needs `actor` (400 `actor`), allows only `out_for_delivery` and `delivered` (403 otherwise), answers 409 when the table refuses and 404 for an unknown order, and returns the `Order`; `GET /admin/stores/{id}/orders` takes `status` and `pageSize` up to 100 and lists newest first; `GET /orders/{id}` answers the customer's own order and 404 for another customer's; core's delivered demo order is `00000000-0000-4000-8000-000000000701` `SS-DEMOAAAB` at store `...0401` (`...0703` is the placed one; the area plan's `...0703` is stale), lines Banana Robusta (product `...0601`, 1 kg, 7000) x2 and Shimla Apple (`...0602`, 1 kg, 19900) x1, subtotal 33900 over the 19900 free-delivery threshold, total 33900, customer `Demo Customer` `+919800000000`, address `12 80 Feet Rd, Koramangala`, `560034`, payment `cod`; the Postman environment already holds `deliveryId` `...0901`.

## Goals / Non-Goals

**Goals:** every requirement in `specs/deliveries/spec.md`, by adding one migration, one package (`internal/delivery`), methods on the existing core client and fake, routes in `internal/app` and rows in the seed, without reshaping L1's code.

**Non-Goals:** the rider app (L3); staff views of deliveries; handing back or reassigning a delivery; anything D32 lists as a ceiling; `CustomerFromToken` (Decision 6); a shared Go module (D31).

## Decisions

1. **One package, `internal/delivery`**, holding the handlers, the `Delivery` view and its sqlc output `internal/delivery/db` (second entry in `sqlc.yaml`, `queries/deliveries.sql`, same overrides as the first). Riders and sessions stay in `internal/auth`; `delivery` imports `auth` for `CurrentRider` and `Bearer`.
2. **`auth.Bearer` exported**: the unexported `bearer` in `internal/auth/auth.go` is renamed `Bearer` (its callers in `auth` follow) so the customer route reads the header the same way. No other change to `auth`.
3. **Claim = core read, then one transaction around the insert and the core move.** `core.Order(orderId)` with the service token first: core 404 is 404; `order.storeId` not the rider's store (case-insensitive) is 404, and no status call is made. Then `pgx.BeginFunc`: insert the delivery with snapshots from that read (unique `order_id` violation → 409 `conflict` "order already claimed"), then `core.ChangeStatus(orderId, "out_for_delivery", actor)`; any error returns from the function, so the insert rolls back: `core.ErrConflict` becomes 409 `conflict` "order is not ready for pickup", 404 and 502 pass through. The rider service does not check `status == ready` itself; core's table is the one rule. Concurrent claims serialise on the unique index: the second insert waits for the first transaction and then fails (409) or, if the first rolled back, proceeds and asks core itself. Ceilings: a database connection is held across one core call (5 s client timeout); a crash or a failed commit after core said yes leaves the order `out_for_delivery` with `riderName` in core and no delivery here (staff can still move it to `delivered` in core). An outbox or a compensating call fixes it if it ever happens.
4. **Delivered = lock, core move, update, one transaction.** `select ... for update` on the rider's delivery (other rider's or unknown: 404; not a uuid: 404 before any query); `delivered` already: 409 `conflict` "delivery is not assigned"; then `core.ChangeStatus(orderId, "delivered", actor)`, any error rolls back and passes through (`core.ErrConflict` 409, 404, 502); then `MarkDelivered`. Ceiling: if staff already moved the order to `delivered` in core, core answers 409 and the delivery stays `assigned` for good; treating that 409 as success needs a core read and is left until it happens.
5. **Service-token calls never answer 401.** `do` keeps L1's mapping; a new private helper `service(ctx, method, path, body, out)` calls `do` with `c.serviceToken` and turns `ErrUnauthorized` into the logged 502 (`failure(..., 401, nil)`). Core's 403 already falls into `do`'s default (502). `StoreOrders` also turns a core 404 (store missing) into the 502. `do` gains `case 409: return ErrConflict`. The rider app clears its token on a 401 (L3), so a wrong service token must never look like one.
6. **Customer ownership by `GET /orders/{id}` alone.** `core.CustomerOrder(ctx, token, id)` forwards the customer's bearer: core's 401 is the caller's 401, 404 is 404. That one call proves the token is a live customer session and the order is theirs, so `CustomerFromToken` is not built. No cache: every read of the customer route costs one core call. Ceiling: a tracking page polling every few seconds per customer is that many core reads; a 30 s cache per (token, order) like the staff cache when it matters. Order of checks: no bearer → 401 (no core call, so the contract's security probe sees 401); `orderId` not a uuid → 404; core; then the delivery row (none → 404). The request log names no subject on this route (the rider service never learns the customer id).
7. **Customer view is minimal.** `{riderName, status, location?}`: `riderName` is the rider's current `riders.name`; `location` `{lat, lng, recordedAt}` only while the delivery is `assigned` and the rider's position was recorded at or after `assigned_at` (one left join), so a stale position from an earlier shift and the rider's movements after delivery never reach the customer. No phone, no email, no rider id.
8. **Snapshots include the lines.** The work package's columns plus `items jsonb` (`[{name, unitLabel, quantity}]`, from core's `OrderItem`), because the rider app's delivery page shows the items table and the rider's list must work without core. `item_count` is the sum of quantities (units carried), the same number the ready list shows. `customer_phone` and `address_line2` are `''` when core omits them, and omitted from JSON when empty.
9. **Ready list**: one core call, `StoreOrders(rider.storeId, "ready")` reads page 1 with `pageSize=100`; orders with a delivery are dropped by one query (`order_id = any($1)`); sorted oldest `placedAt` first (core lists newest first; riders take the oldest). The answer is `{items}` without paging fields, as the work package says: it is a working set, not a browsable list. Ceiling: more than 100 orders ready at one store at once loses the oldest beyond 100; page through core then.
10. **Location** is a plain upsert keyed by `rider_id`, `recorded_at = now()` on the server (the client's clock is not trusted). It is accepted whether or not the rider has an assigned delivery. Body `{lat, lng}` read with `httpx.ReadJSON` into `*float64` fields: missing is 400 "is required", out of range 400 "must be between -90 and 90" / "-180 and 180", `lat` checked first. Ceiling: one row per rider, no history (D32).
11. **Lists**: `GET /me/deliveries` uses `httpx.Page` and `httpx.NewList`; `status` absent or empty is `assigned`, anything but `assigned`/`delivered` is 400 on `status`; order `assigned_at desc, id`.
12. **Logging** mirrors core's `order transition`: `slog.InfoContext(ctx, "delivery claimed" | "delivery delivered", "deliveryId", "orderId", "number", "riderId", "requestId")`, after the commit.
13. **Seed** appends `rider_locations, deliveries` to `truncateTables` and one `deliveries` row after the riders (values in Data model). Still no core call (L1 Decision 13). `Summary` gains one line; `TestSummaryMatchesSeed` reads the table name from each id line and checks both Postman ids.
14. **`app.New(pool, origins, a, d *delivery.Deliveries)`**: callers that never reach a delivery route pass `nil` (`app_test.go` readyz-down server, `riders_test.go` limited server, `cmd/rider-admin/main_test.go`, `internal/seed/seed_test.go`); `TestMain` in `app` and `cmd/rider` pass a real one. Routes are registered as method values, so a nil `d` is safe until a delivery route is called.
15. **No `docs/design/rider-P3-L2.md`**: this file carries the data model, interfaces, error handling and tests.

## Data model

`migrations/0003_deliveries.sql`:

```sql
-- Deliveries (one rider carrying one core order) and each rider's last position (rider-deliveries).
create type delivery_status as enum ('assigned', 'delivered');

create table deliveries (
    id              uuid primary key default gen_random_uuid(),
    order_id        uuid not null unique, -- core's order id, no foreign key (D32)
    order_number    text not null,
    store_id        uuid not null,        -- core's store id
    rider_id        uuid not null references riders (id),
    status          delivery_status not null default 'assigned',
    customer_name   text not null,
    customer_phone  text not null default '',
    address_line1   text not null,
    address_line2   text not null default '',
    address_pincode text not null,
    total_cents     bigint not null check (total_cents >= 0),
    payment_method  text not null,
    item_count      integer not null check (item_count > 0),
    items           jsonb not null,
    assigned_at     timestamptz not null default now(),
    delivered_at    timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    check ((status = 'delivered') = (delivered_at is not null))
);
create index deliveries_rider_id_status on deliveries (rider_id, status);
create trigger deliveries_updated_at before update on deliveries for each row execute function set_updated_at();

create table rider_locations (
    rider_id    uuid primary key references riders (id) on delete cascade,
    lat         double precision not null check (lat between -90 and 90),
    lng         double precision not null check (lng between -180 and 180),
    recorded_at timestamptz not null default now(),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create trigger rider_locations_updated_at before update on rider_locations for each row execute function set_updated_at();
```

`queries/deliveries.sql` (names fixed): `CreateDelivery :one` (insert every snapshot column, `returning *`), `ClaimedOrders :many` (`select order_id from deliveries where order_id = any(sqlc.arg(order_ids)::uuid[])`), `RiderDeliveries :many` and `CountRiderDeliveries :one` (`where rider_id = $1 and status = $2`, list `order by assigned_at desc, id limit offset`), `RiderDelivery :one` (`where id = $1 and rider_id = $2`), `LockRiderDelivery :one` (same, `for update`), `MarkDelivered :one` (`set status = 'delivered', delivered_at = now() where id = $1 returning *`), `UpsertLocation :exec` (`insert ... on conflict (rider_id) do update set lat = excluded.lat, lng = excluded.lng, recorded_at = now()`), `OrderDelivery :one`:

```sql
select d.status, r.name as rider_name, l.lat, l.lng, l.recorded_at
from deliveries d
join riders r on r.id = d.rider_id
left join rider_locations l
  on l.rider_id = d.rider_id and d.status = 'assigned' and l.recorded_at >= d.assigned_at
where d.order_id = $1;
```

`make gen` regenerates `internal/auth/db/models.go` too (sqlc writes the whole schema into each package's models); commit it.

Seed row (task 5), after the riders:

```sql
insert into deliveries (id, order_id, order_number, store_id, rider_id, status, customer_name, customer_phone,
    address_line1, address_pincode, total_cents, payment_method, item_count, items, assigned_at, delivered_at)
values ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000701', 'SS-DEMOAAAB',
    '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000801', 'delivered',
    'Demo Customer', '+919800000000', '12 80 Feet Rd, Koramangala', '560034', 33900, 'cod', 3,
    '[{"name":"Banana Robusta","unitLabel":"1 kg","quantity":2},{"name":"Shimla Apple","unitLabel":"1 kg","quantity":1}]',
    now() - interval '2 days' + interval '6 minutes', now() - interval '2 days' + interval '11 minutes');
```

Summary line, after the riders: `  00000000-0000-4000-8000-000000000901  deliveries  SS-DEMOAAAB by Arjun Rao, delivered (Postman deliveryId)`; the header line `seed-demo: demo riders and delivery loaded (local databases only)`.

## Interfaces

`internal/core` (added; L1's API unchanged):

```go
type OrderAddress struct {
    Line1   string `json:"line1"`
    Line2   string `json:"line2,omitempty"`
    Pincode string `json:"pincode"`
}
type OrderItem struct { // the part of core's OrderItem the rider keeps
    Name      string `json:"name"`
    UnitLabel string `json:"unitLabel"`
    Quantity  int    `json:"quantity"`
}
type Order struct { // the part of core's Order the rider reads
    ID            string       `json:"id"`
    Number        string       `json:"number"`
    StoreID       string       `json:"storeId"`
    Status        string       `json:"status"`
    CustomerName  string       `json:"customerName"`
    CustomerPhone string       `json:"customerPhone,omitempty"`
    Address       OrderAddress `json:"address"`
    TotalCents    int64        `json:"totalCents"`
    PaymentMethod string       `json:"paymentMethod"`
    PlacedAt      time.Time    `json:"placedAt"`
    Items         []OrderItem  `json:"items"`
}
type Actor struct {
    Type string `json:"type"` // always "rider"
    ID   string `json:"id"`
    Name string `json:"name"`
}
var ErrConflict = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "core refused the change"}

func (c *Client) StoreOrders(ctx context.Context, storeID, status string) ([]Order, error) // GET /admin/stores/{id}/orders?status=&pageSize=100, service token; 404 → 502
func (c *Client) Order(ctx context.Context, id string) (Order, error)                      // GET /admin/orders/{id}, service token; 404 passes
func (c *Client) ChangeStatus(ctx context.Context, id, status string, actor Actor) error    // POST /admin/orders/{id}/status {status, actor}, service token; 404, 409 pass
func (c *Client) CustomerOrder(ctx context.Context, token, id string) (Order, error)       // GET /orders/{id} with the customer's bearer; 401, 404 pass
func (c *Client) service(ctx context.Context, method, path string, body, out any) error   // do with the service token; 401 → logged 502
```

Path ids go through `url.PathEscape`, the query through `url.Values`.

`internal/coretest` (added; L1's API unchanged):

```go
const ServiceToken = "service-token" // the bearer the service routes admit; the app tests already pass it to core.New
type StatusChange struct { Status string; Actor core.Actor }
func (f *Fake) AddOrder(o core.Order, customerToken string) // GET /admin/orders/{id}, the store list and GET /orders/{id} serve it
func (f *Fake) SetOrderStatus(id, status string)
func (f *Fake) OrderStatus(id string) string
func (f *Fake) StatusChanges(id string) []StatusChange      // every accepted move, in order
func (f *Fake) FailRoute(route string, status int)          // like Fail, for one route pattern only; 0 restores
```

Fake routes (core's envelopes, `Calls` counts them as L1's do): `GET /api/core/v1/admin/stores/{id}/orders` (bearer must be `ServiceToken` else 401; the store's orders with `status` equal to the query, `{items, page: 1, pageSize, total}`; unknown store: empty list), `GET /api/core/v1/admin/orders/{id}` (service token; unknown 404), `POST /api/core/v1/admin/orders/{id}/status` (service token; body `{status, actor}`; actor missing or not `rider` 400 field `actor`; target not `out_for_delivery`/`delivered` 403 `forbidden`; unknown 404; `ready`→`out_for_delivery` and `out_for_delivery`→`delivered` move, record a `StatusChange` and answer the order, else 409 `conflict`; the move is under the fake's mutex), `GET /api/core/v1/orders/{id}` (bearer must be some order's customer token else 401; another customer's or unknown order 404).

`internal/auth`: `func Bearer(r *http.Request) string` (renamed from `bearer`).

`internal/delivery`:

```go
type Item struct {
    Name      string `json:"name"`
    UnitLabel string `json:"unitLabel"`
    Quantity  int    `json:"quantity"`
}
type Address struct {
    Line1   string `json:"line1"`
    Line2   string `json:"line2,omitempty"`
    Pincode string `json:"pincode"`
}
type Delivery struct {
    ID            string     `json:"id"`
    OrderID       string     `json:"orderId"`
    OrderNumber   string     `json:"orderNumber"`
    StoreID       string     `json:"storeId"`
    Status        string     `json:"status"` // assigned | delivered
    CustomerName  string     `json:"customerName"`
    CustomerPhone string     `json:"customerPhone,omitempty"`
    Address       Address    `json:"address"`
    TotalCents    int64      `json:"totalCents"`
    PaymentMethod string     `json:"paymentMethod"`
    ItemCount     int        `json:"itemCount"`
    Items         []Item     `json:"items"`
    AssignedAt    time.Time  `json:"assignedAt"`
    DeliveredAt   *time.Time `json:"deliveredAt,omitempty"`
}
type ReadyOrder struct {
    OrderID      string    `json:"orderId"`
    Number       string    `json:"number"`
    PlacedAt     time.Time `json:"placedAt"`
    ItemCount    int       `json:"itemCount"`
    TotalCents   int64     `json:"totalCents"`
    Pincode      string    `json:"pincode"`
    CustomerName string    `json:"customerName"`
}
type Location struct {
    Lat        float64   `json:"lat"`
    Lng        float64   `json:"lng"`
    RecordedAt time.Time `json:"recordedAt"`
}
type CustomerDelivery struct {
    RiderName string    `json:"riderName"`
    Status    string    `json:"status"`
    Location  *Location `json:"location,omitempty"`
}

func New(pool *pgxpool.Pool, c *core.Client) *Deliveries
func (d *Deliveries) ReadyOrders(w, r); Claim(w, r); List(w, r); Get(w, r); Delivered(w, r); PutLocation(w, r); OrderDelivery(w, r)
```

`internal/app` routes (full paths; rider routes behind `a.RequireRider`, the customer route without middleware):

| Route | Handler | Answers |
|---|---|---|
| `GET /api/rider/v1/me/ready-orders` | `ReadyOrders` | 200 `ReadyOrderList`, 401, 502 |
| `POST /api/rider/v1/me/deliveries` | `Claim` | 201 `Delivery`, 400 (`orderId`, body), 401, 404, 409, 502 |
| `GET /api/rider/v1/me/deliveries` | `List` | 200 `DeliveryList`, 400 (`status`, `page`, `pageSize`), 401 |
| `GET /api/rider/v1/me/deliveries/{id}` | `Get` | 200 `Delivery`, 401, 404 |
| `POST /api/rider/v1/me/deliveries/{id}/delivered` | `Delivered` | 200 `Delivery`, 401, 404, 409, 502 |
| `PUT /api/rider/v1/me/location` | `PutLocation` | 204, 400 (`lat`, `lng`, body), 401 |
| `GET /api/rider/v1/orders/{orderId}/delivery` | `OrderDelivery` | 200 `CustomerDelivery`, 401, 404, 502 |

`openapi.json`: tag `deliveries` ("Ready orders, claims, deliveries, rider location and the customer's view of a delivery."); schemas `ReadyOrder`, `ReadyOrderList` (`{items}`), `DeliveryClaim` (`{orderId}`), `Delivery`, `DeliveryItem`, `DeliveryAddress`, `DeliveryList`, `LocationUpdate` (`{lat, lng}`), `CustomerDelivery`, `Location`; response schemas `additionalProperties: false`, request schemas without (L1 Decision 10); every route `security: [{"bearer": []}]` and a 401; an example on every response with content, using the demo ids (`...0801`, `...0901`, `...0701`, `SS-DEMOAAAB`). `cmd/rider` builds `delivery.New(pool, c)` with the same client.

## Error handling

Handlers return `*httpx.Error` values or raw errors to `httpx.WriteError` as L1. Local errors: 400 `validation` with `field` (`orderId`, `status`, `lat`, `lng`, plus `httpx.Page`'s), 404 `not_found` (`auth`'s message), 409 `conflict` "order already claimed" (unique violation via `pg.IsUnique`), "order is not ready for pickup" (claim, `core.ErrConflict`), "delivery is not assigned" (delivered twice). Core errors as Decisions 3 to 6. No new error code.

## Test strategy

- Every scenario runs through the real router against `shopperstop_rider_test` (`internal/app`, fresh schema per package as L1) with `coretest.Fake` at the process boundary (D31). Riders are inserted with SQL and signed in through `POST /auth/sign-in` as `riders_test.go` does; fake orders get fresh uuids per test so tests do not collide in the shared fake.
- New file `internal/app/deliveries_test.go` holds the route tests; `internal/core/core_test.go` the client tests; `internal/seed/seed_test.go` the seed tests.
- Concurrency: five goroutines released by one closed channel, each with its own rider of the store, `POST /me/deliveries` the same order; assert one 201, four 409, `select count(*) from deliveries where order_id = $1` = 1, `len(fake.StatusChanges(id)) == 1`. Run under `-race`.
- Rollback proofs: claim of a fake order set to `packing` (409, zero rows); `FailRoute("POST /api/core/v1/admin/orders/{id}/status", 500)` (502, zero rows); delivered with `FailRoute` on the same route (502, row still `assigned`, then 200 after `FailRoute(..., 0)`).
- Wrong service token: a second `httptest.Server` over the same pool with `delivery.New(testPool, core.New(fake.URL(), "wrong-token", time.Now))` and the shared `auth`.
- Log: capture `slog` with a JSON handler on a buffer as `TestRiderRequestLogNamesSubject` does.

## Files

`services/rider/`: `migrations/0003_deliveries.sql`, `queries/deliveries.sql`, `sqlc.yaml`, `internal/delivery/` (+ `db/`), `internal/auth/db/models.go` (generated), `internal/auth/auth.go`, `internal/auth/rider.go`, `internal/auth/staff.go` (the `Bearer` rename at its three callers), `internal/core/`, `internal/coretest/`, `internal/app/` (`app.go`, tests), `cmd/rider/main.go`, `cmd/rider-admin/main_test.go` (the extra `nil`), `internal/seed/`, `openapi.json`. Generated: `docs/postman/shopperstop-rider.postman_collection.json`; `packages/ui/src/api/rider.d.ts` only if it exists on main. This change folder. Nothing else.

## Risks / Trade-offs

- The fake drifts from real core: its bodies and status table follow core's `openapi.json` and `internal/order/status.go`; L3's `make e2e` drives the real core through claim and delivered. Until then the manager's verification includes one claim and one delivered against `make core` with the dev service token.
- Holding a transaction across a core call (Decision 3, 4): bounded by the client's 5 s timeout and the pool size; fine at demo scale.
- Core-side and rider-side state can disagree after a crash between core's yes and the commit (Decision 3) or a staff move in core (Decision 4); named, not handled.
