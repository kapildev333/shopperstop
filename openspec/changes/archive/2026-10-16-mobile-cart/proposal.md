## Why

The mobile app (Phase 4, D36 to D42) browses a store since `mobile-serviceability-catalog` (L2), but its Steppers count into an in-memory stub (`src/cart.ts`, L2 design.md Decision 5): nothing persists, nothing reaches core, and there is no way to see the cart. This change gives the app its cart: the design canvas artboards 4 Cart sheet and 14 Cart empty, the sticky cart bar of artboards 1 and 2, the guest cart, the server cart and the merge at sign-in, mirroring `web-app`'s cart requirements (D38) and D27's replaced-cart notice.

## What Changes

- `src/cart-guest.ts`: the guest cart, a port of `apps/web/src/guest-cart.ts`: set-a-line reducer with core's semantics (clamp to stock and 20, another store replaces), totals from the resolved store's fees, kept in async storage `shopperstop:cart` (read once, asynchronously, like the pincode).
- `src/cart.ts`: L2's stub bodies replaced, names kept (`useQuantity`, `setQuantity`, `useCartSummary`, `getCartSummary`, `clearCart`): the server cart (`GET /me/cart`, `PUT /me/cart/items`, `DELETE /me/cart`) while a token is held, the guest cart otherwise, behind one hook; one write queue so quick taps count; core's answer is the truth (clamp, replace); per-control write failures; the merge of the guest cart at sign-in; the cart sheet's open state. `setQuantity` now takes the product instead of its id (the guest cart keeps the product to show it).
- `src/cart-sheet.tsx`: the "My cart" sheet (artboard 4: delivery promise and lines with Steppers, free-delivery nudge, bill details with the MRP struck, minimum-order block, Proceed to checkout; artboard 14 when empty; loading and error states; clamped and replaced notices), mounted once in the root layout; it opens once on a replaced answer (D27).
- `src/cart-bar.tsx`: the cart bar (count, total, "View cart", the replaced notice) mounted on Home, the Categories tab, Category and Search.
- `src/cart-alert.tsx`: the one-line alert a failed cart write shows under its control (product card, product screen bar, sheet line).
- `src/ui/sheet.tsx`: an optional `footer` that stays below the scrolling content (the sheet's Proceed bar).
- Integration lines in L2 and L1 files, named in design.md: the card and the product screen write through the cart and show the alert; the root layout mounts the sheet; four screens mount the bar; `src/auth.ts` merges the guest cart after sign-in and register; `jest.setup.ts` closes the sheet after each test.
- `e2e/cart.spec.ts`: guest cart, quick taps, merge at sign-in, clamp, store change and replaced notice against core, with axe.

Out of scope: the checkout screen (L4b `mobile-checkout`; "Proceed to checkout" opens `/checkout`, which shows the not-found screen until L4b lands), a cart bar on the product screen (artboard 3 has its own price bar), recovering a replaced cart (D27 ceiling), native device e2e (D37 ceiling).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-app`: ADDED requirements for the guest cart and its storage, cart totals, the cart behind every Stepper, quick taps, the server cart, write failures, the merge at sign-in, the cart sheet and its states, the minimum order, the cart bar, the server cart emptied on a store change, the replaced notice, and the cart e2e suite. L2's "Mobile cart counts before the cart" is superseded and REMOVED once L2's change is archived on main (tasks.md task 0).

## Impact

- Area: mobile. Files: `apps/mobile/**` as listed in design.md "Files", this change's folder, `docs/design/mobile-P4-L3.md`, `.claude/lanes/mobile-P4-L3*.md`.
- Cross-area contracts relied on, unchanged: `services/core/openapi.json` through `@shopperstop/ui/api` (`GET /me/cart`, `PUT /me/cart/items` answering `CartUpdate` with `replaced` and `clamped`, `DELETE /me/cart`, `GET /stores/{id}`, `GET /serviceability`; the e2e suite also uses `POST /auth/register`, `POST /admin/auth/sign-in` and `PUT /admin/stores/{id}/stock` as `apps/web/e2e/cart.spec.ts` does); `@shopperstop/ui/tokens`, `@shopperstop/ui/format` (`formatInr`). No rider route. No new dependency (`@react-native-async-storage/async-storage` is L2's).
- Depends on mobile-P4-L2 (`mobile-serviceability-catalog`) on main: its `src/cart.ts` names, `src/ui/` primitives, `src/pincode-sheet.tsx` (the "Switch store" confirm already awaits `clearCart()`), screens and spec. Feeds mobile-P4-L4b (`mobile-checkout`): `useCart`, `setQuantity`, `cartKey`.
