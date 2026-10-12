# Proposal

## Why
Spec 2 §7: a customer fills a cart at the store that delivers to their pincode, as a guest or signed in, sees it in a drawer (bottom sheet on phone, side drawer on desktop) opened from a sticky bottom bar on phone or the header cart button on desktop, and proceeds to checkout. Guests keep the cart in `localStorage`; at sign-in it is pushed to the server line by line and discarded. Moving the pincode to another store empties the cart after a confirm dialog. web-P2-L1 ships every `Stepper` behind `useCartQuantity(product)` with a local stub; this change gives that hook a real cart. Checkout (web-P2-L4) reads the server cart this change fills.

## What Changes
- Guest cart: a pure reducer over `{storeId?, items: [{product, quantity}]}` with set semantics (0 removes), clamping to the product's displayed stock and the 20-per-line cap, one store (a line at another store starts a new cart), persisted in `localStorage` `shopperstop:cart` behind the same storage guard as the session and pincode stores.
- Guest totals computed in the browser from the resolved store's fees with core's formula (subtotal, fee or free above the threshold, total, minimum order, shortfall to free delivery), so guest and server carts render through one shape.
- Server cart: `GET /me/cart` through TanStack Query; every change is `PUT /me/cart/items` and its answer replaces the cached cart; `clamped: true` shows a notice in the drawer.
- One hook pair over both backends: `useCart()` and `useCartQuantity(product)` (web-P2-L1's signature kept), chosen by whether a customer token is held.
- Sign-in and register push each guest line with `PUT /me/cart/items` in guest order, then discard the guest cart.
- Cart drawer (`Sheet` "Your cart"): lines with image tile, name, unit, `Price` and `Stepper` (Remove for an out-of-stock line), subtotal, delivery fee or "Free", "Add ₹X more for free delivery" from `shortfallCents`, the minimum-order notice with checkout disabled below it, "Proceed to checkout" to `/checkout` or to `/sign-in?returnTo=%2Fcheckout` when signed out; empty, loading and error states.
- Sticky bottom bar on phone (count, total, "View cart", `shadow-sheet`), hidden while the cart is empty; header cart button on desktop with the count and total.
- Store-change confirm: saving a pincode that resolves to a different store while the cart has lines opens a `Dialog` (Cancel first); confirming empties the guest cart or `DELETE /me/cart` and then stores the pincode; Cancel keeps the old pincode.
- Playwright `e2e/cart.spec.ts` against real core and the demo seed: guest merge at sign-in, drawer on phone, server clamp, store change; axe on every page, sheet and dialog visited.

Area: web. Capabilities touched: `web-app` (ADDED requirements only). Out of scope: the `/checkout` page and orders (web-P2-L4; this change only links to `/checkout`), cross-tab cart sync, optimistic server updates, holding stock, a cart route or page, Figma changes (the Customer web frames for the cart drawer on phone and desktop with empty, loading and error exist).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `web-app`: ADDED "Customer guest cart lines", "Customer guest cart storage", "Customer cart totals", "Customer cart behind every Stepper", "Customer server cart", "Customer cart merge at sign-in", "Customer cart drawer", "Customer cart drawer states", "Customer cart minimum order", "Customer cart bar and header button", "Customer store change confirm", "Customer store change outcome" (12 requirements, 25 scenarios; names distinct from the 13 on main and web-P2-L1's 10).

## Impact
- Files: `apps/web/**` (listed in design.md), this change folder. No new dependency.
- Cross-area contracts relied on:
  - core (`services/core/openapi.json` through `@shopperstop/ui/api`, core-P2-L4 `core-stock-cart`): `GET /me/cart` → `Cart {storeId?, items: CartLine[{product: StoreProduct, quantity}], subtotalCents, deliveryFeeCents, totalCents, minOrderCents, shortfallCents}`; `PUT /me/cart/items` `CartItemSet {storeId, productId, quantity}` → `CartUpdate` (`Cart` plus `replaced`, `clamped`), 400 `validation` (fields `quantity`, `productId`, `storeId`), 401; `DELETE /me/cart` → 204; `StoreProduct.quantity` capped at 10 (D7); the demo stock (D22); `POST /admin/auth/sign-in` and `PUT /admin/stores/{id}/stock` with the seeded admin (e2e only). From core-P2-L2: `Store {id, name, isOpen, deliveryFeeCents, freeDeliveryAboveCents, minOrderCents, promisedMinutes}` through `GET /serviceability`.
  - ui: `@shopperstop/ui` `Button`, `ButtonLink`, `Dialog`, `DialogFooter`, `EmptyState`, `ErrorBanner`, `Price`, `formatInr`, `Sheet`, `Skeleton`, `StatusMessage`, `Stepper`; tokens (`shadow-sheet`). No ui change.
  - platform: `make e2e` environment (core :18080, `shopperstop_core_e2e`, preview 15173).
  - web, same area: web-P2-L2 on main (`src/api.ts`, `src/session.ts`, `src/auth.ts` `openSession`); web-P2-L1 `web-serviceability-catalog` (not yet merged): `src/pincode.ts` (`setPincode`, `closePincodeSheet`), `src/catalog.ts` (`keys`, `useServiceability`), `src/pincode-sheet.tsx`, `src/product-card.tsx` (`ImageTile`, `ProductCard`), `src/cart.ts` (`useCartQuantity` stub this change replaces).

## Requests to other areas
- core (core-P2-L4): confirm the generated schema names `Cart`, `CartLine`, `CartItemSet`, `CartUpdate`, that `CartLine.product` is `StoreProduct`, and that `storeId` is omitted (not `""`) on the empty cart.
