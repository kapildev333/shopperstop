# Proposal

## Why
Spec 2 §7: the customer site ends at the cart drawer. "Proceed to checkout" leads to a page that does not exist, so nothing can be ordered, followed or cancelled from the site. core-P2-L5 (`core-orders`, #137) now serves placement, the customer's orders and the cancel. This change adds the three pages that use them: `/checkout`, `/orders/{id}` and `/orders`.

## What Changes
- `/checkout` (signed in; signed out goes to sign-in and comes back): the customer's addresses with the default chosen, "Add address" through the existing address dialog, a read-only order summary of the server cart at the cart's store (lines, subtotal, delivery fee, total, cash on delivery), "Place order (COD)", "Edit cart" opening the drawer. Empty, loading and failed states; the minimum-order notice with the button disabled.
- Placing: `POST /orders {addressId}` behind the cart's write queue; on 201 the cart shows empty and the site moves to the order's page. One retry on 409 `conflict`. 400 "cart is empty" is read as already placed and goes to `/orders`. 409 `out_of_stock` marks the named lines and offers "Remove <name>" through the cart. An address the store does not serve, a closed store, a subtotal below the minimum and any other failure each show their own alert, the cart kept.
- `/orders/{id}`: status message (announced when it changes), status history from the order's events, a countdown to `placedAt` plus the store's promised minutes ("Running late…" after it), items, totals, the delivery address, "Cancel order" with a confirm dialog while the order is `placed` or `accepted`. It reads the order again every 10 s while it is under way, not while the tab is hidden, and stops at `delivered` or `cancelled`; a failed read changes nothing on screen.
- `/orders`: the customer's latest orders, newest first, a card each with number, date, status badge, item count, total and a link; empty, loading and failed states.
- Links to `/orders` on the account page, the tracking page and the empty checkout. The cart drawer's checkout link becomes a router link. The phone cart bar is not shown on `/checkout`.
- Playwright `e2e/checkout.spec.ts` and `e2e/orders.spec.ts` against core with the demo seed, a fresh customer per writing test, axe on every page and dialog, one 390 px layout test.

Area: web. Capability touched: `web-app`. Out of scope: online payment; a cancel reason; editing quantities on the checkout page itself; checking addresses against the store before placement; paging the history beyond the first 24; reorder; the cross-app flow with the admin board (web-P2-L5); any change in `packages/ui`, `services/core` or Figma.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `web-app`: 18 ADDED requirements ("Customer checkout and order pages require sign-in", "Customer checkout page", "Customer checkout states", "Customer checkout address choice", "Customer checkout minimum order", "Customer places an order", "Customer checkout out of stock", "Customer checkout refusals", "Customer order tracking page", "Customer order status names", "Customer order status message", "Customer order tracking poll", "Customer order countdown", "Customer order cancel", "Customer order history", "Customer order history states", "Customer order links", "Customer checkout and order page layout") and 1 MODIFIED ("Customer cart bar and header button": no bar on `/checkout`, one scenario added, its two kept). 44 scenarios in the delta, 42 of them new.

## Impact
- Files: `apps/web/**` (listed in design.md), this change folder. No new dependency.
- Cross-area contracts relied on:
  - core (`services/core/openapi.json` through `@shopperstop/ui/api`; living spec `openspec/specs/orders`, core-P2-L5, on main since #137): `POST /orders` `OrderCreate {addressId}` → 201 `Order`; 400 `validation` (no field: cart empty; fields `addressId`, `subtotal`); 409 `not_serviceable` (field `addressId`, or none when the store is closed), `out_of_stock` with `productIds`, `conflict`; `GET /orders` → `OrderList`; `GET /orders/{id}` → `Order`, 404; `POST /orders/{id}/cancel` `OrderCancel` (a JSON body is required) → 200 `Order`, 409 `conflict`; `GET /stores/{id}` → `Store` (name, `promisedMinutes`); `GET /me/addresses`, `POST /me/addresses`; `GET /me/cart`, `PUT /me/cart/items`; the demo seed (customer, two addresses, orders `...0701` to `...0703`, stock); for e2e only, `POST /admin/auth/sign-in`, `GET|PUT /admin/stores/{id}/stock` and `POST /admin/orders/{id}/status` with the seeded admin.
  - ui: `@shopperstop/ui` `Badge`, `Button`, `ButtonLink`, `Card`, `Chip`, `Dialog`, `DialogFooter` (`cancelLabel`), `EmptyState`, `ErrorBanner`, `PageHeader`, `Price`, `Skeleton`, `StatusMessage`; tokens. No ui change.
  - platform: the `make e2e` environment (core :18080, `shopperstop_core_e2e`, preview 15173).
  - web, same area, on main: `src/cart.ts` (`useCart`, `cartKey`, `setLine`, the write queue), `src/cart-drawer.tsx`, `src/address-dialog.tsx`, `src/routes/account.tsx`, `src/api.ts`, `src/session.ts`, `src/auth.ts`, `src/catalog.ts`, `src/test-data.ts`.

## Requests to other areas
None blocks this change.
- ui, optional: a single-choice control (radio group or choice card); checkout chooses an address with `Chip`s (`aria-pressed`) until then. A status-history (timeline) component if admin's order sheet wants the same list; here it is a plain `ol`.
- core: `promisedMinutes` and the store's name as snapshots on `Order` were asked for and are not coming in Phase 2; the countdown following the store's current value is a named ceiling (design Decision 9).
- admin, information: the status names and `Badge` variants in design.md (Vocabulary) are PLAN.md D28, which the board follows too.
