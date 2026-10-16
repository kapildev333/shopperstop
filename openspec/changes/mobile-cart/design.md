## Context

After `mobile-serviceability-catalog` (L2), `apps/mobile` resolves a store, browses it and counts Steppers into an in-memory stub, `src/cart.ts` (`useQuantity`, `setQuantity`, `useCartSummary`, `getCartSummary`, `clearCart`; L2 design.md Decision 5). L2's pincode sheet already opens "Switch to the <store> store?" and awaits `clearCart()`, showing "Could not empty your cart." on an error (built, untested until now). The web app solved the same cart in `web-cart` (web-P2-L3) and its follow-ups: `apps/web/src/guest-cart.ts`, `cart.ts`, `cart-drawer.tsx`, `store-change.tsx`. This change ports that logic and draws artboards 4 and 14 and the cart bar.

Binding from earlier mobile changes: tokens only from `src/ui/tokens.ts`; sheets are `Modal`s named by their title, and on the web export the dialog role arrives after the animation (e2e waits for `getByRole('dialog', { name })`) (L1 Decision 8); the loading and error pattern and "keep data on a failed refetch" (L1 Decision 10); RNTL 14's `render`, `fireEvent`, `renderRouter` are async and awaited; one navigating `renderRouter` test per file; a map-based `renderRouter` needs a `QueryClientProvider` around the screen; groups are found by `getByLabelText` / `getByRole('group', { name })`; no `level` option in `getByRole` (check `aria-level` on the element); dynamic routes are reached in-app only in e2e (L2 Decision 7).

Workers cannot open the canvas: `docs/design/mobile-P4-L3.md` carries the artboard data, copy and interfaces.

### web-app requirements mirrored

| mobile-app requirement | mirrors web-app (and core `cart`) | differs |
|---|---|---|
| Mobile guest cart lines | Customer guest cart lines; core "Cart lines are clamped to stock", "A different store replaces the cart" | none |
| Mobile guest cart storage | Customer guest cart storage | async storage, read once asynchronously; a change before the read wins (as the pincode, L2 Decision 2) |
| Mobile cart totals | Customer cart totals; core "Cart totals follow the store's fees" | none |
| Mobile cart behind every Stepper | Customer cart behind every Stepper | includes the sheet's lines |
| Mobile cart quick taps | Customer cart quick taps | none |
| Mobile server cart | Customer server cart; core "Customers set one cart line at a time" | notice in the sheet, not a drawer |
| Mobile cart write failure | Customer cart write failure, Customer cart write failure cleared | a one-line `small` alert, not an `ErrorBanner` (cards are 148 wide) |
| Mobile cart merge at sign-in | Customer cart merge at sign-in | none |
| Mobile cart sheet | Customer cart drawer | canvas copy: "My cart", "Delivery in N minutes", "Shipment of N items", "Bill details", "Items total" with the MRP total struck, "FREE", "Grand total"; line price is price × quantity |
| Mobile cart checkout and minimum order | Customer cart drawer (checkout link), Customer cart minimum order | link fixed below the scroll with the grand total; minimum is a block, not a disabled button; the cancellation note |
| Mobile cart sheet states | Customer cart drawer states | artboard 14's empty state; L1's error state (offline / server) instead of "Could not load your cart." |
| Mobile cart bar | Customer cart bar and header button | on Home, Categories, Category and Search only; no header button (no desktop); the whole bar is the button |
| Mobile store change empties the server cart | Customer store change outcome (server half) | L2's dialog copy |
| Mobile store change needs an answer | Customer store change confirm | stricter: a failed lookup or cart read with a non-empty cart stores nothing (web stores the pincode) |
| Mobile cart replaced notice | Customer cart replaced notice (D27) | sheet instead of drawer |
| Mobile cart end-to-end suite | the `web-app` cart e2e scenarios | 390×844 only |

## Goals / Non-Goals

**Goals:** the real cart behind L2's names; guest and server carts; merge at sign-in; the sheet, the empty state, the bar; write failures; the D27 notice; the store-change rules against a real cart; e2e with axe.

**Non-Goals:** checkout (L4b); a bar on the product screen; restoring a replaced cart (D27 ceiling); a cart badge on the tabs (not on the canvas).

## Decisions

### 1. Port web's cart, change only the storage and the store hook

`src/cart-guest.ts` is `apps/web/src/guest-cart.ts` with async storage; `src/cart.ts` is `apps/web/src/cart.ts` with `useStore()` from L2 for the resolved store, plus `useCartSummary` / `getCartSummary` / `loadCartSummary` for L2's callers and the sheet's open state. Web's queue (`queued`), `asked` map with turns, "core's answer is the truth", `replacedStoreId` from the previous cached cart and the merge are copied, comments included: they carry the reasons for the races they close. Ceiling (web's): one write chain for all carts; `asked` survives sign-out until its write settles.

### 2. Guest storage read once, asynchronously

As `src/pincode.ts`: module state with `useSyncExternalStore`; the first `useGuestCart()` (from an effect) or `loadGuestCart()` starts the one read; a `set` that changes the cart before the read settles marks it loaded and the read's result is dropped; a `set` that changes nothing (for example 0 for a product not in the cart) leaves the read to load the stored cart; `clearGuestCart()` always wins, even on an empty in-memory cart: it marks the cart loaded, emits and removes the stored value, because a clear is the customer's decision (store change confirmed, merge done) and a late read must not bring the cart back (manager, 2026-10-16, on T1's question). `loadGuestCart()` resolves the live cart once its single read has settled, never the snapshot that read produced, so later callers (the merge, the store-change check) compare against changes made since (found and fixed in task 8, task line 1.4). Every storage call is in `try`/`catch` or `.catch`. The static render in Node never reads (the read starts from an effect). On the web export async storage is `localStorage` under the same key, which the e2e suite reads.

### 3. `setQuantity` takes the product

L2's `setQuantity(storeId, productId, n)` cannot fill a guest line: the sheet shows the product's name, unit, price and image, and the guest cart has no other source for them. The name stays; the second argument becomes the product (`CartProduct`, which `StoreProduct` satisfies), and it returns the write's error. The two L2 callers move to `useLineWrite` (Decision 4); L2's tests that call `setQuantity` with an id pass a product object (task 3).

### 4. Write failures under the control

As web: `useLineWrite(storeId, product)` keeps the last failure in the control's own state, so it clears on the next use and on unmount. `CartWriteAlert` is a one-line `small` `danger` text with `role="alert"`; the canvas has no failure drawing and an `ErrorBanner` with "Try again" does not fit a 148-wide card. The two L2 files get the hook and one alert line each (named in Files).

### 5. One sheet, mounted once; its open state in `cart.ts`

`CartSheet` is mounted in the root layout beside L2's `PincodeSheet`, so the bar on any screen and a replaced answer from any Stepper open the same sheet (web's module flag). Built on L1's `Sheet`, which gains an optional `footer` rendered after its `ScrollView`, so "Proceed to checkout" stays visible while a long cart scrolls (artboard 4's fixed footer). `footer` is a one-prop change in a shared primitive (task 2), smaller than a second modal recipe.

### 6. Proceed is a `Link` that closes the sheet

As L2's sign-in link in the pincode sheet (proven in Jest after T10): `<Link href=… asChild><Pressable onPress={closeCartSheet} /></Link>`. Signed out it goes to `/sign-in?returnTo=%2Fcheckout`; L1's forms return there after the merge. `/checkout` does not exist until L4b and shows the not-found screen until then (ceiling, one lane long; the Jest test registers a stub `checkout` route).

### 7. The bar sits in the screen's column

The canvas floats the bar over the content 12 above the tab bar. Here `CartBar` is the last child of each browsing screen's root column, so it never hides the last row and needs no measured offsets; `edge` adds the bottom safe area on stack screens. No bar on the product screen: artboard 3's price bar owns the foot, and Back returns to a screen with the bar (ceiling: a "View cart" in that bar when asked). The bar is one button whose name carries the count and total, since a label on an accessible `Pressable` hides its children from screen readers.

### 8. Merge at sign-in in `auth.ts`

`openSession` awaits `mergeGuestCart()` after `startSession`, as web's `auth.ts` does and as L1's design reserved for L3; the forms' `router.replace(returnTo)` then runs on the merged cart. `mergeGuestCart` awaits `loadGuestCart()` first, so a guest cart still being read is merged too.

### 9. A store change needs an answer (manager's item from L2's review)

L2's sheet stores the pincode when the lookup fails, and reads the cart synchronously, so a failed lookup, or a signed-in cart not yet read, skips the "Switch store" confirm and the next add silently replaces the cart (D27). Rule: `next()` awaits the lookup and `loadCartSummary()` together; when the cart has lines or cannot be read, and either failed, the sheet stays open with "Could not check this pincode. Try again." and stores nothing; with an empty cart a failed lookup stores the pincode as before (the header then shows the error state with "Try again"). This is stricter than web, which stores the pincode on a failed lookup; named in the mirror table.

### 10. The sign-in copy stays

"Sign in to place your order. Your cart stays as it is." (L1 deferred it to L3, R1 finding 10) is true with the merge: the guest's lines are kept, and a replace or clamp is announced by the sheet. Kept.

### 11. The REMOVED requirement waits for L2's archive

L2's "Mobile cart counts before the cart" (in-memory counts) is superseded. A `REMOVED` delta needs it in `openspec/specs/mobile-app`, which happens only when L2's change is archived on main; until then this change validates with `ADDED` requirements only. Task 0 added the `REMOVED` entry once L2 was archived (#284). L2's tests of it (`src/cart.test.ts` `counts belong to one store`) are replaced by task 1's and task 3's tests.

## Contract audit (core openapi, 2026-10-16)

Every field and route the cart needs exists on main: `GET /me/cart` → `Cart` (`storeId` optional, `items[].product` as `StoreProduct` with `mrpCents`, `imageUrl`, `inStock`, `quantity`; `subtotalCents`, `deliveryFeeCents`, `totalCents`, `minOrderCents`, `shortfallCents`); `PUT /me/cart/items` (`CartItemSet` `{storeId, productId, quantity}`) → `CartUpdate` with `replaced` and `clamped`, 400 `validation`; `DELETE /me/cart` → 204; `GET /stores/{id}` → `Store` (name for the replaced notice); `Store.promisedMinutes` for "Delivery in N minutes"; e2e: `PUT /admin/stores/{id}/stock` for the clamp. No rider route. **No gaps.** Notes, not requests: `StoreProduct.quantity` is capped at 10 for display (D7), so a line's maximum is at most 10 even where the cap is 20; the MRP total is computed in the app from the lines.

## Files

All inside `apps/mobile/` plus this change, `docs/design/mobile-P4-L3.md` and the lane logs:

- New: `src/cart-guest.ts`, `src/cart-sheet.tsx`, `src/cart-bar.tsx`, `src/cart-alert.tsx`, `e2e/cart.spec.ts`, tests `src/cart-guest.test.ts`, `src/cart-stepper.test.tsx`, `src/cart-write-failure.test.tsx`, `src/cart-sheet.test.tsx`, `src/cart-sheet-proceed.test.tsx`, `src/cart-sheet-proceed-signed-in.test.tsx`, `src/cart-merge.test.ts`, `src/cart-store-change.test.tsx`, `src/cart-pincode-check.test.tsx`, `src/cart-bar.test.tsx`, `src/cart-bar-screens.test.tsx`
- Replaced: `src/cart.ts`, `src/cart.test.ts`
- Integration lines in L1 and L2 files: `src/ui/sheet.tsx` and `src/ui/sheet.test.tsx` (`footer`), `src/app/_layout.tsx` (mount `CartSheet`), `src/app/(tabs)/index.tsx`, `src/app/(tabs)/categories.tsx`, `src/app/category/[slug].tsx`, `src/app/search.tsx` (mount `CartBar`), `src/catalog-card.tsx` and `src/app/product/[slug].tsx` (`useLineWrite`, `CartWriteAlert`), `src/auth.ts` (merge), `src/pincode-sheet.tsx` (Decision 9), `jest.setup.ts` (`closeCartSheet()` after each test), `src/pincode-sheet.test.tsx` and `src/catalog-product-count.test.tsx` (`setQuantity` with a product)

## Scenario to test

| Scenario | Test file: test name | Task |
|---|---|---|
| Guest line set and removed; Guest line clamped; Another store replaces the guest cart; Out of stock at another store keeps the guest cart; Guest totals follow the store's fees; Guest cart persisted and restored; Guest change wins over a late read; Guest cart with blocked storage | `src/cart-guest.test.ts`: the scenario names | 1 |
| Card adds to the guest cart; Card shows the server cart; Card ignores a cart at another store; Guest taps each count; Quick taps each count; Failed write returns to the cart's count | `src/cart-stepper.test.tsx`: the scenario names | 3 |
| Failed write tells the customer; Core's refusal is shown; Next tap clears the failure; Overtaken change shows no failure | `src/cart-write-failure.test.tsx`: the scenario names | 4 |
| Sheet lines and bill; Free delivery; Out-of-stock line; Below the minimum order; Empty cart; Loading and failed cart; Answer wins over what was sent; Line clamped away; Replaced notice names the old store (sheet); Replace opens the sheet once; Replaced notice without the old store | `src/cart-sheet.test.tsx`: the scenario names | 5 |
| Proceed signed out | `src/cart-sheet-proceed.test.tsx`: `proceed signed out` | 5 |
| Proceed signed in | `src/cart-sheet-proceed-signed-in.test.tsx`: `proceed signed in` | 5 |
| Merge bodies in guest order; Guest cart discarded after merge; Merge dropped when the session changed | `src/cart-merge.test.ts`: the scenario names | 6 |
| Server cart emptied on a store change; Emptying the server cart fails | `src/cart-store-change.test.tsx`: the scenario names | 6 |
| Bar follows the cart; Replaced notice names the old store (bar half); Replaced notice without the old store (bar half) | `src/cart-bar.test.tsx`: `bar follows the cart`, `bar shows the replaced notice`, `bar names another store while the old one is unknown` | 7 |
| Bar on the browsing screens | `src/cart-bar-screens.test.tsx`: `bar on the home tab`, `bar on the categories tab`, `bar on a category screen`, `bar on search`, `no bar on the product screen` (one test per screen) | 7 |
| Failed lookup keeps the cart's pincode; Unread server cart is fetched before comparing; Failed lookup with an empty cart | `src/cart-pincode-check.test.tsx`: the scenario names | 8 |
| Guest cart against core; Quick taps against core; Merge at sign-in against core; Clamp against core; Server store change against core; Replaced notice against core | `e2e/cart.spec.ts`: the scenario names | 9 |

Task 2 (`Sheet` footer) and the summary and clear tests of task 3 (`src/cart.test.ts`) cover no scenario directly; tasks.md names them.

## Acceptance (team lead, 2026-10-16)

`/opsx:verify mobile-cart`: **accepted.** Every scenario of the delta maps to a passing named test (table above; Jest run on the merged branch aa97e13: 80 suites, 302 tests passed; the 6 e2e scenarios are the six `test(...)` names in `e2e/cart.spec.ts`, green in two `make e2e` runs reported by task 9 and verified by the manager: admin 15, mobile 21, rider 7, web 45). Every task is ticked. Gates re-run: `packages/ui` build, mobile lint, typecheck and test green; `openspec validate --all --strict` green.

Scope extensions, all inside `apps/mobile/`, accepted:
- `src/catalog-card.test.tsx`: wraps the card in `QueryClientProvider` (task 3; `useQuantity` now reads queries).
- `src/pincode-sheet.tsx` and the new `src/pincode-store-change-close.test.tsx` (R1 fix): the store change dialog keeps its last change while it closes, so the closing dialog neither blanks nor stores the wrong pincode.
- `src/app/search.tsx` (R1 fix, beyond the mount line): the result count reads in `ink` for contrast on `canvas`.
- `src/cart-guest.ts` by task 8's worker: `loadGuestCart()` resolves the live cart (task line 1.4, Decision 2).
- R1 findings 1 and 3 fixed in this lane: sheet lines count their own cart (`useLineQuantity`), one `ReplacedNotice` for the bar and the sheet.

Deferred, named:
- R1 #2 (a guest cart priced without a resolved store has zero fees and minimum, so Proceed can show below the store's minimum): handled in mobile-P4-L4b (checkout re-reads the store and core re-checks at placement).
- R1 #4: three "overlapping act() calls" console errors in `src/cart-write-failure.test.tsx`; not failing; clean up when that file is next touched.
- R1 #5: a guest change in the milliseconds before the one storage read settles drops the stored lines (Decision 2's rule); accepted.
- The Modal close in `src/pincode-store-change-close.test.tsx` is a stand-in (the test calls the dialog's close path directly; RNTL cannot run the native `Modal` fade-out); the e2e store-change scenario covers the real close on the web export.

## Risks / Trade-offs

- [Store change before the server cart is read] Decision 9 closes it by awaiting the read; a Continue now waits for both answers (both cached in the common case).
- [`useQuantity` per card calls `useStore()` and `useCart()`] Both read cached queries; dozens of cards subscribe to the same keys. Fine at the grid sizes here (24 per page).
- [axe on the sheet] The sheet adds `StatusMessage`s (role `status`) and a link with a label; on react-native-web the dialog role arrives after the slide, so e2e waits for `getByRole('dialog', { name: 'My cart' })` before axe. An axe failure on markup the app does not control stops the worker (no rule switched off).
- [`inkMuted` on `canvas`] Fails axe color-contrast (found by L2, whose store notices moved to `surface`); the minimum-order block uses `ink`, and muted text stays on `surface`.
- [`/checkout` absent until L4b] Proceed lands on the not-found screen until then (Decision 6).
- [Parallel workers] Tasks of one group touch disjoint files; workers never amend, reset or rebase, and stage by explicit path.
- [L2's names] Reconciled in task 0 against L2 as merged (#283, archived #284): names, callers and mount points as named here; L2's late pincode-sheet guards (dismissal ref, `pending`) are kept by task 8.
