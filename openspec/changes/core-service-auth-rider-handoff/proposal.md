## Why

Phase 3 adds the rider service (D29). It must read the stores and their ready orders from core and move an order to `out_for_delivery` when a rider claims it and to `delivered` when the rider hands it over, without a staff user signed in (D30). Customers and staff should see who is delivering. Today core knows only customer and staff sessions, and an order event records only `customer`, `staff` or `system`.

## What Changes

- Config: optional `SHOPPERSTOP_CORE_SERVICE_TOKENS` (`name:token,...`, each token 32 bytes or more). The Makefile already passes `rider:<36-byte token>` in `make dev` and `make e2e` (platform-P3-L1, #193).
- Auth: a bearer token equal to a configured service token is a `service` subject named by its entry (constant-time comparison). It reaches five routes as an unscoped reader, like an admin: `GET /admin/stores`, `GET /admin/stores/{id}`, `GET /admin/stores/{id}/orders`, `GET /admin/orders/{id}`, `POST /admin/orders/{id}/status`. Every other staff route answers it 403 `forbidden`; customer routes 401. The request log line names it `subjectType` `service`, `subjectId` `<name>`.
- Orders: `OrderStatusChange` gains `actor {type: "rider", id, name}`, required from a service and refused from staff (400 field `actor`). A service may only move an order to `out_for_delivery` or `delivered` (403 `forbidden` for any other target; the table's own refusals stay 409). The event records `actorType` `rider` and `actorName`; moving to `out_for_delivery` for a rider snapshots `riderName` on the order. Staff keep every transition.
- Migration 0007: `orders.rider_name text null`, `order_events.actor_name text null`, and the `order_events.actor_type` check admits `rider`.
- Contract: `Order.riderName` and `OrderEvent.actorName` (both optional, omitted when empty), `OrderEvent.actorType` adds `rider`, `OrderStatusChange.actor`; the five service routes carry `"x-service-token": true` and every other secured `/admin/` operation documents its 403. The contract test probes every secured operation with a service token. Regenerated `packages/ui/src/api/core.d.ts` (D19) and `docs/postman/shopperstop-core.postman_collection.json` (D23).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform`: ADDED "Service tokens are configured", "Services reach the rider's admin routes", "The contract names the service routes"; MODIFIED "The request log names the signed-in subject".
- `orders`: ADDED "A service moves orders for a rider", "Orders name their rider"; MODIFIED "Transitions are recorded", "Order routes need the right session".
- `admin-stores`: MODIFIED "Store administration is for admins only" (a service reads two of its routes).
- `admin-staff`: MODIFIED "Staff sessions" and "Admin-only routes" (a service token is 403, not 401).

## Impact

- Area: `core` only. Files under `services/core/`: `internal/config`, `internal/auth`, `internal/app` (routes and tests), `internal/order`, `cmd/core/main.go`, `migrations/0007_rider_handoff.sql`, `queries/order.sql`, sqlc output in every `internal/*/db/models.go` and `internal/order/db/order.sql.go`, `openapi.json`. Generated: `packages/ui/src/api/core.d.ts`, `docs/postman/shopperstop-core.postman_collection.json`.
- Contracts relied on: `services/core/openapi.json` (core to apps and to the rider service), the Makefile's `SHOPPERSTOP_CORE_SERVICE_TOKENS` values (platform, on main).
- Cross-area: `apps/admin/src/order-sheet.tsx` indexes an object literal of three actor types by `event.actorType`; once `core.d.ts` adds `rider` the admin typecheck fails until admin adds a `rider` key. Admin must land that one-line change before this change merges (request in the lane report).
- No new dependency, no new route.
- Out of scope: rider accounts and deliveries (rider area); a `serviceToken` Postman variable (platform); staff names on staff events (admin backlog); token rotation without restart; a rider name on the demo delivered order.
