# web-checkout-failures

## Why

Two backlog items in `.claude/areas/web.md` › Backlog, both on `/checkout`:

1. From web-cart-write-failure (#184): after a placement answered 409 `out_of_stock`, the "Remove <name>" button on a marked line calls `setLine` and drops its answer. When that write fails the line stays and nothing says why. The cart drawer and the product cards already show an `ErrorBanner` under the control for the same failure.
2. From web-checkout-orders (#171): when `POST /orders` answers `internal` (core not reached, a 5xx, a failed answer without the envelope, or a 2xx without an order), the page says "Could not place your order. Try again." That is not honest: the request may have reached core and committed. The customer is told it failed and invited to place it again.

## What Changes

- Checkout's Remove uses the cart's `useLineWrite`, so a failed removal shows the `ErrorBanner` under that line's Remove button, with the same message and clearing rules as the drawer and the cards.
- An `internal` answer at placement shows "We could not confirm your order. It may have been placed, so check Your orders before you place it again." and a "Your orders" link to `/orders`, instead of "Could not place your order. Try again.". "Place order (COD)" stays available: a second placement of the same cart is safe (design.md, Context).
- When the cart read again after an `internal` answer comes back empty, the order went through: the page goes to `/orders`, as it already does on 400 "cart is empty".
- Other refusals keep their messages.

Area: web. Out of scope: `packages/ui` (existing `ErrorBanner`, `buttonClass` only); core (no idempotency key: not needed, see design.md); admin; the drawer and cards (already done by web-cart-write-failure); Playwright (jsdom sees all of it).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-app`: MODIFIED "Customer cart write failure" (adds checkout's Remove and its scenario), MODIFIED "Customer checkout refusals" (`internal` no longer reads "Could not place your order"; the "Placement fails" scenario's second case is now a refusal that cannot have placed), ADDED "Customer checkout unconfirmed placement".

## Impact

- `apps/web/src/checkout.tsx`, `apps/web/src/checkout.test.tsx`.
- Cross-area contracts relied on, unchanged: `@shopperstop/ui` exports `ErrorBanner` and `buttonClass`; `services/core/openapi.json` `POST /orders` (201, 400, 401, 409; no idempotency key) and `GET /me/cart`; `openspec/specs/orders` "Customers place an order from their cart" (one transaction that empties the cart) and "Placement validates the cart…" (empty cart is 400 `validation`).
