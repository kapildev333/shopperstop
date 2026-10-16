## Why

Phase 5 adds the payment service (PLAN.md D48 to D51). Core keeps the order and its status machine; the payment service needs core to know how an order is paid, to hold a staff accept until an online order is paid, to take the service's "paid", "refunded" and timeout cancel, and to expose order events it can tail for refunds (core never calls out, D51). Spec 2 §14: money needs a verified account.

## What Changes

- Migration 0011: `orders.payment_method` admits `cod` and `online`; `orders.payment_status` (new enum `payment_status`: `pending`, `paid`, `refunded`; null exactly for cash, a check constraint); `orders.payment_reference text not null default ''`; `order_events.seq bigserial not null` with a unique index.
- `POST /orders` takes optional `paymentMethod` (`cod` default, `online`); online needs `Customer.emailVerified` (409 `email_unverified`, checked first) and starts `paymentStatus` `pending`; another value 400 field `paymentMethod`. Every order read carries `paymentMethod` and, when set, `paymentStatus` and `paymentReference`.
- Staff accepting a `pending` order: 409 `payment_pending`. Cancels unchanged.
- `POST /admin/orders/{id}/payment {status: paid|refunded, reference}` for the `payment` service only: paid only from pending, refunded only from paid, else 409 `conflict`; sets the reference, appends an event from and to the order's status by `system` (`actorName` `payment`, note `Payment <status>, reference <ref>`), logs `order payment`.
- Service actor table on `POST /admin/orders/{id}/status`: `rider` as today; `payment` may only cancel, naming `{type: "system", name}` with no id (the timeout cancel, stock restored). Another service moves nothing.
- Services are named per route (manager's request, relayed from platform-P5-L1): `rider` keeps its five routes; `payment` gets `GET /admin/orders/{id}`, the status route, the payment route and the feed, nothing else. The contract test probes with every service token.
- `GET /admin/order-events?after=&limit=` for the `payment` service: `{items}` cursor list ascending by `seq` (limit 1 to 500, default 100). Every event write takes a transaction-scoped advisory lock first, so `seq` follows commit order.
- `Error.code` adds `email_unverified` and `payment_pending`. `OrderStatusChange.actor` admits `type` `system` (id then refused). `OrderEvent.actorName` also on system events.
- Seed: demo order `SS-DEMOAAAE` (`...0704`), placed three days ago, online, paid, reference `fake_demo_0a01`, with its payment event. The package named it `SS-DEMOAAAC`, which `...0702` already holds; Postman keeps `orderId` `...0703`.
- `openapi.json` (three scripts), `core.d.ts` (D19), the Postman collection (D23), sqlc output regenerated.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `orders`: ADDED "Customers pay cash or online", "Paying online needs a verified email", "Staff accept only paid online orders", "The payment service marks payments paid or refunded", "Services tail order events", "Event numbers follow commit order", "The demo order paid online"; MODIFIED "Transitions are recorded", "A service moves orders for a rider", "Orders name their rider", "Demo orders".
- `platform`: MODIFIED "Error envelope", "Service tokens are configured", "Services reach the rider's admin routes", "The contract names the service routes".
- `accounts`: no change. `emailVerified` already exists (core-P4-L2); the rule that uses it is an `orders` requirement.

## Impact

- Area: `core`. Files under `services/core/`: `migrations/0011_payments.sql` (new), `queries/order.sql` and sqlc output, `internal/order` (`order.go`, `place.go`, `handlers.go`, `status.go`, new `payment.go`, new `events.go`, `schema_test.go`), `internal/auth/auth.go` and `auth_test.go`, `internal/app` (`app.go`, `app_test.go`, `contract_test.go`, `orders_test.go`, `service_test.go`, new `orders_payment_test.go`, new `order_events_test.go`), `internal/config/config_test.go`, `internal/seed` (`seed.go`, `seed_test.go`, `summary.go`), `openapi.json`. Generated: `packages/ui/src/api/core.d.ts`, `docs/postman/shopperstop-core.postman_collection.json`.
- Contracts relied on: `services/core/openapi.json` (core to the apps, rider and payment).
- Cross-area: every workspace typechecks and `make test-web` passes on the spike. Two e2e lines count the demo customer's orders and see four after Task 4 (`apps/web/e2e/orders.spec.ts` line 126, `apps/mobile/e2e/orders.spec.ts` line 110); design.md "Cross-area" gives both-ways fixes. Rider needs no change. Platform's Makefile must name the `payment` token (platform-P5-L1, in progress).
- No new dependency. No new environment variable.
- Out of scope: the payment service; app screens (badges, Pay online, awaiting payment); rider's cash line; idempotent retries of the payment route; a push from core; receipts.
