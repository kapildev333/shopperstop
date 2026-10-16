## Why

The mobile app (Phase 4, D36 to D42) browses a store (L2), holds a cart and opens "Proceed to checkout" from the cart sheet (L3, `mobile-cart`), and shows orders (L4a, `mobile-orders`), but `/checkout` does not exist: a customer cannot place an order from the phone. This change draws artboard 5 Checkout of the design canvas and places the order through core, mirroring `web-app`'s checkout requirements (D38), including web-P2-L11's failure rules.

## What Changes

- Area: mobile. Capability touched: `mobile-app` (ADDED requirements only).
- `src/app/checkout.tsx` and `src/checkout-screen.tsx`: the Checkout screen (artboard 5): a white header with "Back to cart" (goes back and opens the cart sheet) and "Checkout"; the address card; the lines card headed with the cart store's promise; the payment card fixed to cash on delivery with the note "UPI and cards come with the payment service."; the bill; a bar below the scroll holding "Place order" with the amount to pay, or a block naming why the order cannot be placed (marked lines, minimum order, no address). Empty, loading and error states; signed out it goes to sign-in with `returnTo` `/checkout`.
- `src/checkout-address.tsx`: the address card ("Delivering to <label>", "Change"), the "Choose address" sheet (one radio group "Deliver to"), "Add address" through L1's address sheet, the new address chosen once saved, the "Not delivered here" badge.
- `src/checkout.ts`: placing (`POST /orders` inside L3's cart write queue, one retry on `conflict`, the answered order and the empty cart held), the outcome table (to the tracking screen, to Orders, or a refusal with its copy) and the out-of-stock mark text.
- On success the app replaces the screen with L4a's tracking screen `/orders/<id>` and the cart counts nothing. `out_of_stock` marks the named lines with a "Remove <name>" button and blocks placing. Web's failure rules: a cart already empty goes to Orders; an unconfirmed placement ("may have been placed") links to Orders; refusals for an address not served, a closed store and the minimum order.
- `e2e/checkout.spec.ts`: address added at checkout, order placed after a guest signs in from the cart sheet, out of stock at checkout, address not served, against core with axe.

Out of scope: payment methods other than cash on delivery (payment service, Phase 5); a Stepper on checkout lines (the cart sheet edits quantities; "Back to cart" reaches it); a delivery slot or tip (not on the canvas); the city in the address line (core's `Address` has none); web's 390 px layout requirement as its own check (primitives hold the 44 px targets; axe runs on every state); native device e2e (D37 ceiling); deep links to `/checkout` from outside the app.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-app`: ADDED requirements for the checkout sign-in redirect, the checkout screen, payment and bill, states, address card and choice, address added at checkout, the place-order bar, placing an order, out of stock, refusals, refusal cleared, unconfirmed placement, and the checkout e2e suite.

## Impact

- Files: `apps/mobile/src/app/checkout.tsx`, `apps/mobile/src/checkout*.ts(x)` and their tests, `apps/mobile/e2e/checkout.spec.ts`, this change, `docs/design/mobile-P4-L4b.md`, `.claude/lanes/mobile-P4-L4b*.md`.
- Cross-area contracts relied on, unchanged: `services/core/openapi.json` through `@shopperstop/ui/api` (`POST /orders`, `GET /me/cart`, `PUT /me/cart/items`, `GET /me/addresses`, `POST /me/addresses`, `GET /stores/{id}`, `GET /orders/{id}`; the e2e suite also uses `POST /auth/register`, `POST /admin/auth/sign-in`, `GET` and `PUT /admin/stores/{id}/stock`, `GET /stores/{id}/products`, `GET /orders`); `@shopperstop/ui/tokens`; `@shopperstop/ui/format` (`formatInr`). No rider route. No new dependency.
- Depends on mobile-P4-L3 (`mobile-cart`) on main: `useCart`, `cartKey`, `queued`, `storeOptions`, `useLineWrite`, `CartWriteAlert`, `openCartSheet`, `cartView` and `emptyCart`, the cart sheet's "Proceed to checkout" link and the merge at sign-in; on L1's `useAddresses` and `AddressSheet`; on L4a's `orderKey`, `ordersKey`, `Order` and the tracking route.
