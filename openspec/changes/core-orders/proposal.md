# Proposal

## Why
A customer can browse, fill a cart and pick an address (core-P2-L1 to L4), but cannot order, and store staff have nothing to work on. This change, core-P2-L5 (Spec 2 §3, §4, §6, §9, §11, §12, §13; PLAN.md D7, D19, D20, D22, D23, D24), adds orders end to end: placement as one transaction from the cart, the status machine with its audit trail, cancel with stock restored, the customer and staff order routes with store-staff isolation, the staff dashboard, and three demo orders with fixed ids.

## What Changes
- Migration `0006_orders.sql`: `orders` (number `SS-` + 8 base32 characters, snapshots of the customer's name and phone and of the address, money in cents, `cancel_reason`, `delivered_at`, `cancelled_at`; `store_id` and `customer_id` foreign keys with no `on delete`), `order_items` (product snapshots, `product_id ... on delete restrict`), `order_events` (from, to, actor, note).
- `queries/order.sql` with generated code in `internal/order/db` (sqlc v1.31.1).
- `internal/order`: placement (`cart.Lines`, `address.Get`, `auth.CustomerByID`, `store.ForPincode`, `stock.Reserve`, `catalog.ProductsByID`, inserts, `cart.Clear`, all in one `pgx.BeginFunc`), the transitions table, `Transition` (cancel calls `stock.Release`), one log line per transition, customer and staff handlers, `Today` counts for the dashboard.
- `internal/staff`: `GET /admin/dashboard` (calls `store`, `order` and `stock`).
- `httpx.Error` gains `ProductIDs` (`productIds`, only with `out_of_stock`).
- Three exported readers in core packages owned by earlier lanes, no new behaviour: `address.Get` (one query appended to `queries/address.sql`), `auth.CustomerByID` (existing query), `store.All` (existing `ListStores` query).
- Routes under `/api/core/v1`: `POST /orders`, `GET /orders`, `GET /orders/{id}`, `POST /orders/{id}/cancel`, `GET /admin/stores/{id}/orders`, `GET /admin/orders/{id}`, `POST /admin/orders/{id}/status`, `GET /admin/dashboard`.
- `core-admin seed-demo --reset` adds three demo orders `...0701` (delivered), `...0702` (cancelled), `...0703` (placed) for the demo customer at Koramangala, two of them with product `...0601`.
- `openapi.json`: tag `orders` and the dashboard under `admin-staff`, `security` on all eight operations, examples on every response (including `out_of_stock` with `productIds`); regenerated `packages/ui/src/api/core.d.ts` (D19) and Postman collection (D23).

Area: core. Capabilities: `orders` (new), `admin-staff` (ADDED: dashboard), `admin-stores` (ADDED: stores with orders are kept, requested by core-P2-L2), `platform` (MODIFIED: the error envelope carries `productIds` for `out_of_stock`).

Out of scope: payment (cash on delivery only, `payment_method` `cod`), riders and their ownership of `out_for_delivery` to `delivered`, notifications, receipts, order edits after placement, reorder, partial cancel, refunds, a multi-status board filter, keyset paging, store names inside the order (clients read `GET /stores/{id}`).

## Capabilities

### New Capabilities
- `orders`: placement from the cart, totals and fee, snapshots, out-of-stock and serviceability errors, concurrent placement, customer order history and cancel, the status machine with events and log lines, staff order lists and status changes, store-staff isolation, demo orders.

### Modified Capabilities
- `admin-staff`: ADDED the staff dashboard.
- `admin-stores`: ADDED stores with orders cannot be deleted.
- `platform`: MODIFIED "Error envelope" (optional `productIds` with `out_of_stock`).

## Impact
- Files: `services/core/` (`migrations/0006_orders.sql`, `sqlc.yaml`, `queries/order.sql`, `queries/address.sql` (one query), `internal/order/`, `internal/staff/`, `internal/address/address.go` (`Get`), `internal/auth/customer.go` (`CustomerByID`), `internal/store/store.go` (`All`), `internal/httpx/errors.go`, `internal/seed/`, `internal/app/`, `openapi.json`), `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json` (generated, D19, D23), this change folder, `.claude/lanes/core-P2-L5.md`.
- Cross-area contracts produced: `openapi.json` schemas `Order`, `OrderList`, `OrderCreate`, `OrderCancel`, `OrderStatusChange`, `Dashboard`, and `Error` gaining optional `productIds`; the fixed demo order ids (Postman `orderId` = `00000000-0000-4000-8000-000000000703`, the placed order, so `POST /orders/{{orderId}}/cancel` succeeds once per reset).
- Cross-area contracts relied on: the `platform` spec (envelope, paging, path ids, bearer security), the Postman generator's `orders` path-id rule and its `orderId` variable.
- Core contracts relied on (earlier lanes): `cart.Lines`, `cart.Clear`, `stock.Reserve`, `stock.Release`, `stock.OutOfStockError`, `stock.LowCount` (core-P2-L4), `catalog.ProductsByID` (core-P2-L4), `store.ForPincode`, `store.Get` (core-P2-L2), `products` and `stores` tables (L2, L3).
- Dependencies: none new.
