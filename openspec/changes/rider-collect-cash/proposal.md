## Why
core-P5-L1 (D50) gave every order a `paymentMethod` (`cod` or `online`) and, on online orders, a `paymentStatus`. The rider is the one who takes the cash at the door, so the rider must see which orders are cash and, on the delivery page, whether to collect money or not (D53: "the rider app shows the cash line"). Today the ready list says nothing about payment and the delivery page knows only `paymentMethod`: it shows "Collect ₹x cash" for `cod` and nothing for `online`.

## What Changes
- Service: `GET /me/ready-orders` items gain `paymentMethod` and, for online orders, `paymentStatus`, read live from core's store order list the route already makes (service token, no new call).
- Service: a claim keeps core's `paymentStatus` in the delivery row next to the `paymentMethod` it already keeps (migration `0004_delivery_payment_status`, one `text not null default ''` column), and every `Delivery` answer (claim, list, read, delivered) carries it, omitted for cash.
- `openapi.json`: `ReadyOrder` and `Delivery` schemas and the ready-orders example; `make gen postman` regenerates `packages/ui/src/api/rider.d.ts` (D19) and the rider Postman collection (D23).
- App: the ready card marks a cash order with a neutral `Badge` "Cash" beside its price. The delivery page's amount line, while assigned, reads "Collect ₹<total> in cash" for `cod`, "Paid online" for a paid online order and "Awaiting payment" (warning) for a pending one, which core makes unreachable but the page shows defensively.
- e2e: the cross-app flow (a cash order) asserts the "Cash" badge on the ready card and the "Collect ₹… in cash" line on the delivery page; axe runs on both pages as before.

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `deliveries`: MODIFIED "Riders see their store's ready orders" (payment fields, new scenario) and "Riders claim a ready order" (the delivery keeps the payment status, new scenario). The work package named `rider-service`; the ready list and the delivery reads are specified in `deliveries`, so the delta goes there and `rider-service` is untouched.
- `rider-app`: MODIFIED "Ready orders list" (the Cash badge), "Cash to collect" (the three amount lines) and "Cross-app delivery flow" (the cash assertions).

## Impact
- Area: rider. Files: `services/rider/migrations/0004_delivery_payment_status.sql`, `services/rider/queries/deliveries.sql`, `services/rider/internal/{core/core.go,delivery/delivery.go}`, the sqlc output under `services/rider/internal/*/db/`, `services/rider/openapi.json`, tests `services/rider/internal/app/deliveries_test.go`, `services/rider/internal/migrate/migrate_test.go`; `apps/rider/src/{ready,delivery}.tsx`, tests `apps/rider/src/{ready,delivery}.test.tsx`, `apps/rider/src/fake-api.ts`, `apps/rider/e2e/flow.spec.ts`; generated `packages/ui/src/api/rider.d.ts` and `docs/postman/shopperstop-rider.postman_collection.json`.
- Contracts relied on: core's `Order.paymentMethod` and `Order.paymentStatus` in `services/core/openapi.json` (on `GET /admin/stores/{id}/orders` and `GET /admin/orders/{id}`, read with the rider's service token); core's rule that staff accept only paid online orders and nobody cancels from `packing` on (`openspec/specs/orders`), which freezes `paymentStatus` at `paid` before an order is ready; the `@shopperstop/ui` `Badge` and `StatusMessage`.
- Out of scope: any core, ui, web, admin or mobile change; collecting or recording the cash (the rider marks delivered as today); refunds; a payment line in History.
