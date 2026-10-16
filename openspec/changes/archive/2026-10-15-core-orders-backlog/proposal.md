## Why

The Phase 2 backlog lands in Phase 3 (D34). The admin board pages through statuses to show a store's open work; it needs a store's active orders in one call with a `total`. The web tracking countdown and the admin board recompute the store's name and promise from the store as it is now, which is wrong once the store changes; the order should carry them as they were at placement. The admin dashboard cannot show whether a store is open.

## What Changes

- `GET /api/core/v1/admin/stores/{id}/orders?active=true` keeps every order that is neither `delivered` nor `cancelled`, newest first, paged as before, `total` counting all of them. `active` accepts only `true` (absent or empty: no filter); any other value, or `active=true` with a non-empty `status`, is 400 field `active`. The page-size cap (100) stays; the panel sends `active=true&pageSize=100`. The service token keeps its access (the rider service uses `?status=ready`).
- Migration 0008: `orders.store_name text not null` and `orders.promised_minutes integer not null`, existing rows backfilled from their store (every order has one, so NOT NULL holds), written at placement from the store row placement already reads.
- `Order.storeName` and `Order.promisedMinutes`, required, on every customer and staff order read.
- `DashboardStore.isOpen`, required.
- Contract: `openapi.json` (the `active` parameter, the 400 description, the three schema members, every Order and dashboard example); regenerated `packages/ui/src/api/core.d.ts` (D19), `docs/postman/shopperstop-core.postman_collection.json` (D23) and every `internal/*/db/models.go` (sqlc, shared schema).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `orders`: MODIFIED "Orders are snapshots" (the store's name and promised minutes, backfill); ADDED "Staff read a store's active orders in one call".
- `admin-staff`: MODIFIED "Staff dashboard" (`isOpen`).

## Impact

- Area: `core`. Files under `services/core/`: `migrations/0008_order_store_snapshot.sql` (new), `queries/order.sql`, `internal/order` (`order.go`, `place.go`, `handlers.go`, `schema_test.go`), `internal/staff/dashboard.go`, `internal/seed` (`seed.go`, `seed_test.go`), `internal/app` (`orders_test.go`, `orders_staff_test.go`, `dashboard_test.go`), `openapi.json`, sqlc output. Generated: `packages/ui/src/api/core.d.ts`, the Postman collection.
- Contracts relied on: `services/core/openapi.json` (core to apps and to the rider service).
- Cross-area: the regenerated `core.d.ts` makes `Order.storeName`, `Order.promisedMinutes` and `DashboardStore.isOpen` required, which breaks three test fixtures typed with them: `apps/web/src/test-data.ts` (`order()`), `apps/admin/src/orders-fake.ts` (`order()`), `apps/admin/src/dashboard.test.tsx` (`atIndiranagar`, `atKoramangala`). Each needs a one-line change that typechecks on main today and after this change (a spread of the new members); web and admin land them before this change merges (requests in the lane report). The rider service and app are not on main yet; the rider service reads `Order` as JSON and gains two members it may ignore.
- No new dependency, no new route.
- Out of scope: staff names on staff events (admin backlog, not in D34); the apps showing the new fields (web and admin Phase 3 lanes); retrying an order-number collision; the dashboard's 1 + 3N queries.
