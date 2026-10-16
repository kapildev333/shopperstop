## Why

The mobile app (PLAN.md D36 to D42) has accounts but no orders: the Orders tab is L1's placeholder. This change builds the order screens of the design canvas, artboards 6 Order tracking, 15 Orders history and 16 Cancel order dialog, so a customer can see their orders, follow one to the door (with the rider card from Phase 3) and cancel one while the store has not started on it. It needs no cart: orders come from core, and checkout (artboard 5) is `mobile-checkout` (L4b). Area plan lane mobile-P4-L4a, run in parallel with L2 and L5a (D42).

## What Changes

- The Orders tab lists the customer's orders (number, status badge, placed time, item count, total), opens one, reads the list again when the tab is shown again, and covers signed out, loading, empty and failed states.
- New screen `/orders/<id>`: brand header with the order number and a headline ("Arriving in N min", "Running late", "Delivered", "Cancelled"), the status message announced in place, the six-step "Order status" timeline with event times, the rider card, products and totals, the delivery address, "Cancel order" while `placed` or `accepted`, "Need help?" to the account screen; not found, loading and failed states; a signed-out visit goes to sign-in and back. The order is read again every 10 seconds while it is under way.
- Cancel dialog: optional reason (four choices, sent as core's `reason`), "Keep order" first, refusals shown in the dialog.
- The rider card: name, status, "Last seen" and "Open in Maps", from `Order.riderName` and the rider service's `GET /api/rider/v1/orders/{orderId}/delivery`, read from `EXPO_PUBLIC_RIDER_URL` (default `http://localhost:8081`).
- Playwright scenarios at 390×844 on the web export against core: history and a delivered order, tracking that follows staff moves, cancel with a reason; axe on every screen visited.

Out of scope: checkout and placing an order (L4b); product thumbnails on the history cards (artboard 15; they need the catalog image URL helper L2 builds, follow-up); a "Load more" past the first page of 24 (web has none either); a help route ("Need help?" opens the account, as the area plan says); native push or background refresh; loading `/orders/<id>` directly on the static web export (404, a ceiling, design.md Decision 9); the rider card in e2e against a running rider service (the mobile Playwright config starts core only; Jest covers the card; see design.md Decision 9).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-app`: ADDED requirements for order history, tracking, the timeline, the headline, the poll, cancel, the rider card and read, and the orders e2e suite. Each mirrors the `web-app` requirement named in design.md, with the mobile scenario written out. (`mobile-app` is seeded by `mobile-foundation-accounts`, merged and awaiting archive; this change only adds requirements with new names.)

## Impact

- Area: mobile. Files: `apps/mobile/src/app/(tabs)/orders.tsx` (replaces L1's placeholder), `apps/mobile/src/app/orders/[id].tsx`, `apps/mobile/src/orders*.ts(x)`, `apps/mobile/src/rider*.ts(x)`, `apps/mobile/e2e/orders.spec.ts`, this change's folder, `docs/design/mobile-P4-L4a.md`, `.claude/lanes/mobile-P4-L4a*.md`. One shared-file change by manager decision (2026-10-16): the tab bar in `src/app/(tabs)/_layout.tsx` gets a navigation landmark named "Main" (axe `region`, design.md Decision 10); the `e2e` script line for `EXPO_PUBLIC_RIDER_URL` landed on this branch too (d4a613f). Nothing else in a shared file.
- Cross-area contracts relied on, all on main and unchanged: core `GET /orders`, `GET /orders/{id}`, `POST /orders/{id}/cancel` (`OrderCancel.reason`), `Order.promisedMinutes`, `Order.riderName`, `OrderEvent.actorType`/`actorName`; for the e2e setup `POST /auth/register`, `POST /auth/sign-in`, `POST /me/addresses`, `PUT /me/cart/items`, `POST /orders`, `POST /admin/auth/sign-in`, `POST /admin/orders/{id}/status`; rider `GET /orders/{orderId}/delivery` (`CustomerDelivery`, customer bearer accepted); `@shopperstop/ui/api` and `@shopperstop/ui/api/rider` types; `@shopperstop/ui/format` `formatInr`; `@shopperstop/ui/tokens`; core and rider CORS origins 5176 and 15176 (platform-P4-L1).
- Dependencies: none new.
