## Why

Phase 3 hands the last leg of an order to riders (PLAN.md D29 to D32; Spec 2 §4: "the rider service will later own out_for_delivery to delivered"). rider-service-foundation gave the rider service accounts, sessions, a core client and a contract; riders still cannot see what is ready, take it, or finish it, and customers cannot see who is bringing their order. This change adds deliveries and seeds the capability `deliveries`.

## What Changes

- Migration `0003_deliveries.sql`: `deliveries` (one per core order, snapshots of the order copied at claim, status `assigned | delivered`) and `rider_locations` (one last position per rider).
- `internal/core` grows the service-token calls `StoreOrders`, `Order`, `ChangeStatus` and the customer-bearer read `CustomerOrder`, a 409 passthrough, and maps core's 401 to a service-token call into a 502. `internal/coretest` grows the matching fake routes with a small status table, a customer-token check and a record of status changes.
- New package `internal/delivery` (handlers and sqlc queries in `queries/deliveries.sql`), wired in `internal/app`:
  - `GET /me/ready-orders`, `POST /me/deliveries`, `GET /me/deliveries`, `GET /me/deliveries/{id}`, `POST /me/deliveries/{id}/delivered`, `PUT /me/location` (rider bearer);
  - `GET /orders/{orderId}/delivery` (customer bearer, ownership proven by core).
- `openapi.json`: tag `deliveries`, every new route with every code and examples; the regenerated rider Postman collection.
- Demo seed: delivered delivery `...0901` by rider `...0801` for core's delivered demo order `...0701` (`SS-DEMOAAAB`), still without calling core.

Out of scope: the rider app (rider-P3-L3); `packages/ui/src/api/rider.d.ts` unless ui-P3-L2 has landed it on main (then regenerated, D19 extended); everything D32 names as a ceiling (delivery proof, COD collection, batches, online or offline state, location history, distance); handing a delivery back or reassigning it; staff routes over deliveries.

## Capabilities

### New Capabilities

- `deliveries`: ready orders for a rider, claims, a rider's deliveries, marking delivered, the rider's last location, the customer's view of their order's delivery, and the delivery demo seed.

### Modified Capabilities

None. The `rider-service` contract requirement ("lists exactly the served routes") already covers the new routes; the delivery seed is its own requirement here so this change does not depend on the archive of rider-service-foundation.

## Impact

- Area: rider. Files under `services/rider/` only, this change folder, and the generated `docs/postman/shopperstop-rider.postman_collection.json` (and `packages/ui/src/api/rider.d.ts` only if it already exists on main).
- Cross-area contracts relied on, all in `services/core/openapi.json` on main since core-P3-L1: the service token (`Authorization: Bearer <SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN>`) on `GET /admin/stores/{id}/orders?status=ready&pageSize=100`, `GET /admin/orders/{id}` and `POST /admin/orders/{id}/status` with `{status, actor: {type: "rider", id, name}}` (400 `actor`, 403 for other targets, 409 for table refusals, 404 unknown); the customer bearer on `GET /orders/{id}` (404 for another customer's order, 401 for staff or unknown tokens); `Order` fields `id`, `number`, `storeId`, `status`, `customerName`, `customerPhone?`, `address {line1, line2?, pincode}`, `totalCents`, `paymentMethod`, `placedAt`, `items[] {name, unitLabel, quantity}`. Core's demo order `...0701` (`SS-DEMOAAAB`, delivered, store `...0401`). Platform's `docs/postman/local.postman_environment.json` `deliveryId` `...0901` (already there).
