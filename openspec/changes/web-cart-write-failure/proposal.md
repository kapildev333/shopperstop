# web-cart-write-failure

## Why

Backlog item from web-cart (#129), in `.claude/areas/web.md` › Backlog: a signed-in customer's cart change that fails (core cannot be reached, or core answers an error such as 400 `validation` "product not available") snaps the `Stepper` back to the cart's count and says nothing. The customer sees their tap undone with no reason and no hint to try again, and assistive tech hears nothing.

## What Changes

- When the last change asked for a cart line fails, an `ErrorBanner` (an `alert`) shows directly under the control the change was made from: the `Stepper` on a product card, on the product page, or on a cart drawer line (also that line's Remove button). Its text is core's error message, or the existing "Could not reach ShopperStop. Try again." when core was not reached or did not answer with the error envelope.
- The message goes when that control is used again, and when it leaves the page (navigation, drawer closed).
- A change skipped because a later tap overtook it shows nothing; the guest cart cannot fail and shows nothing.
- The `Stepper` still returns to the cart's count, as today.

Area: web. Out of scope: `packages/ui` (existing `ErrorBanner` only); the checkout page's Remove on an out-of-stock line (it still fails silently, named in design.md as a ceiling); the clamp notice (`clamped: true` is a 200, not a failure, and keeps its drawer-only `StatusMessage`); the merge at sign-in (it already refetches on a failed push); `clearCart` (the store-change dialog already shows "Could not empty your cart."); core, admin.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-app`: two ADDED requirements, "Customer cart write failure" and "Customer cart write failure cleared". "Customer cart quick taps" is not modified: its "the `Stepper` SHALL return to the cart's count" still holds.

## Impact

- `apps/web/src/api.ts` (export the existing `unreachable` error), `apps/web/src/cart.ts` (`setLine` answers the failure; one hook), `apps/web/src/product-card.tsx`, `apps/web/src/routes/p.$slug.tsx`, `apps/web/src/cart-drawer.tsx` (render the banner), tests in `apps/web/src/cart.test.tsx`, `apps/web/src/cart-drawer.test.tsx` and a new `apps/web/src/cart-write-failure.test.tsx`.
- Cross-area contracts relied on, unchanged: the `@shopperstop/ui` export `ErrorBanner` (`role="alert"`, message, optional retry); `services/core/openapi.json` `PUT /me/cart/items` answers 200 `CartUpdate`, 400 and 401 with the error envelope.
