## Context

After L1 (`mobile-foundation-accounts`), L2 (`mobile-serviceability-catalog`), L4a (`mobile-orders`) and L3 (`mobile-cart`), the app has addresses and L1's address sheet (`src/addresses.ts`, `src/address-sheet.tsx`), the cart behind every Stepper with the cart sheet whose "Proceed to checkout" opens `/checkout` (or sign-in with `returnTo` `/checkout`, merging the guest cart after sign-in), and the tracking screen `/orders/<id>` reading `orderKey(token, id)`. `/checkout` itself shows the not-found screen. The web app solved the same screen in `web-checkout-orders` (web-P2-L4) and its follow-ups (web-P2-L11 failure rules): `apps/web/src/checkout.tsx` and `placeOrder` / `postOrder` / `cartEmptied` in `apps/web/src/orders.ts`. This change ports that logic and draws artboard 5.

Binding from earlier mobile changes: tokens only from `src/ui/tokens.ts`; sheets are `Modal`s named by their title, dialog role only after the slide on the web export (L1 Decision 8); loading and error pattern and "keep data on a failed refetch" (L1 Decision 10); RNTL 14's `render`, `fireEvent`, `renderRouter` are async and awaited; one navigating `renderRouter` test per file; a map-based `renderRouter` needs `QueryClientProvider` in its layout; `router.getPathname()` / `toHavePathname`; groups by `getByLabelText` or `getByRole('group' | 'radiogroup', { name })`; no `level` in `getByRole` (check `aria-level`); dynamic routes 404 on direct load of the static export, so e2e reaches screens in-app (L2 Decision 7, L4a Decision 9); muted text only on `surface` (L2's axe finding, L3 task 5); parallel workers never amend, reset or rebase and stage by explicit path.

Workers cannot open the canvas: `docs/design/mobile-P4-L4b.md` carries artboard 5, the copy and the module interfaces.

### web-app requirements mirrored

| mobile-app requirement | mirrors web-app (and core `orders`) | differs |
|---|---|---|
| Mobile checkout requires sign-in | Customer checkout and order pages require sign-in | none |
| Mobile checkout screen | Customer checkout page | canvas: "Back to cart" instead of "Edit cart"; one column; line shows "<qty> × <unit>" |
| Mobile checkout payment and bill | Customer checkout page (totals, "Cash on delivery") | canvas copy: "Pay the rider in cash", the payment-service note, "Items total", "FREE", "To pay" |
| Mobile checkout states | Customer checkout states | "Start shopping" / "Your orders" buttons; L1's error state |
| Mobile checkout address card | Customer checkout address choice (chosen = default, else first; no address) | a card with "Change" (named "Change address") instead of an inline radio list |
| Mobile checkout address choice | Customer checkout address choice (radio group "Deliver to") | in a sheet "Choose address"; choosing closes it |
| Mobile checkout address added | Customer checkout address choice ("Address added at checkout") | one sheet at a time |
| Mobile checkout place order bar | Customer checkout minimum order; Customer checkout address choice (no address disables) | a block in the bar instead of a disabled button (L3's sheet pattern); marked lines block too (canvas) |
| Mobile places an order | Customer places an order; core "Place an order" | `router.replace`, so Back from tracking does not return to an empty checkout; double press guarded in the same tick |
| Mobile checkout out of stock | Customer checkout out of stock; Customer cart write failure (checkout half) | canvas: mark text in place of the unit, Remove in place of the price; second alert line |
| Mobile checkout refusals | Customer checkout refusals | none |
| Mobile checkout refusal cleared | Customer checkout refusal cleared | badge seen in the card and the sheet |
| Mobile checkout unconfirmed placement | Customer checkout unconfirmed placement | none |
| Mobile checkout end-to-end suite | the `web-app` checkout e2e scenarios | 390×844 only; `/checkout` reached through the cart sheet |

## Goals / Non-Goals

**Goals:** artboard 5 against the real cart and addresses; placing through core with web's outcome table; the out-of-stock marks; every refusal; the unconfirmed placement; e2e with axe.

**Non-Goals:** other payment methods (payment service, Phase 5); quantity changes on the checkout lines (the cart sheet owns them); delivery slots and tips (not on the canvas); a layout requirement like web's 390 px check (Decision 10).

## Decisions

### 1. Port web's checkout; three files by concern

`src/checkout.ts` holds the logic with no React (web's `postOrder`, `cartEmptied`, `placeOrder`, `refusalOf`, `shortText`, plus `outcomeOf` and `blockReason`, pure functions the screen calls); `src/checkout-address.tsx` the address card and its two sheets; `src/checkout-screen.tsx` the screen; `src/app/checkout.tsx` only renders the screen. Splitting `outcomeOf` out of the screen lets the decision table be unit tested once, so only the three outcomes that navigate need their own router test files. Web's comments come along: they carry the reasons for the races they close.

### 2. Canvas layout: one column, a fixed bar

Artboard 5: white header, scrolling cards (alert, address, lines, payment, bill), and a bar fixed below the scroll holding "Place order" with the amount, or a block when the order cannot be placed. A block instead of a disabled button follows L3's cart sheet footer and the canvas's out-of-stock state; the block's reason is one function (`blockReason`) with a fixed precedence: marked lines, then minimum, then no address.

### 3. Address: a card, a choice sheet, one sheet at a time

The canvas shows one address with "Change"; the button reads "Change" and is named "Change address" for assistive technology (reviewer R1 finding 3; the spec says so). It opens a `Sheet` "Choose address" holding a radio group "Deliver to" (rows are `Pressable` with `accessibilityRole="radio"` and `accessibilityState.checked` inside a `View` with `accessibilityRole="radiogroup"`; the app has no radio primitive and needs one only here). Choosing closes the sheet. "Add address" closes the choice sheet before L1's `AddressSheet` opens: two stacked `Modal`s are unreliable on iOS. The new address is chosen by difference: the card records the ids it lists when the address sheet opens, and on close chooses the one id now listed that was not (L1's `saveAddress` awaits the address list's refetch before the sheet closes). No L1 file changes. Ceiling: first page of addresses (24, L1's ceiling); an address added on another device at the same moment could be the one picked.

### 4. Placing runs in L3's write queue

As web: `placeOrder` runs inside `queued` from `src/cart.ts`, so a Stepper tap made before the press is written before the order is placed, and checks the token is unchanged when its turn comes. L3 exports `queued<T>(work)` from `src/cart.ts` (L3 task 3, at this lane's request; checked in task 0).

### 5. Outcomes navigate with `replace`

On 201 the answered order is put in `orderKey(token, id)` (L4a), the cart cache set to the empty view (`cartView(emptyCart)` from L3's `src/cart-guest.ts`), `ordersKey(token)` invalidated, and the screen replaced with `/orders/<id>`: the tracking screen draws from the cache at once and Back does not return to an empty checkout. A cart already empty (400 `validation`, no field) and an `internal` answer after which the cart reads empty replace with `/orders` (the Orders tab). Everything else stays with a refusal.

### 6. The cart's store, not the pincode's

The lines card reads `GET /stores/{cart.storeId}` (web's rule: the cart may be at another store than the pincode resolves to). It uses L3's `storeOptions(storeId)` (key `['store', id]`, the whole `Store`, throws `error.error`; `useStoreName` selects the name from the same entry), as `useQuery({ ...storeOptions(view.storeId ?? ''), enabled: !!view?.storeId })`.

Fees and the minimum come only from the server cart (`GET /me/cart`, which core prices at the cart's own store), never from `useStore()` (the pincode's store); checked in task 0 against L3 as merged: signed in, `useCart().view` is `GET /me/cart`'s answer unchanged, and the guest pricing with the resolved store's fees applies only with no token. Checkout is signed-in only, so L3's guest pricing (zero fees and minimum 0 while no store resolves, L3 review R1 finding 2) never reaches it: the guest cart is merged at sign-in and the screen shows core's answer. Core re-checks the minimum at placement; its 400 `subtotal` refusal is the "Placement fails" scenario. Scenario "Minimum from the cart when the pincode is not served" pins it.

### 7. Marks are text, not badges; the block names marked products

The canvas marks a line with danger text in place of its unit ("Out of stock") and swaps its price for "Remove". Web's three texts are kept ("Out of stock", "Only N left", "Not enough stock"). The canvas block reads "Remove out-of-stock product to continue"; a line can be marked for being short, not out, so the block reads "Remove the marked products to continue.", and the alert's second line "Remove them to place your order.". The canvas dims a marked line to 75% opacity; dropped, as it pulls `danger` and `inkMuted` text under 4.5:1.

### 8. Contrast fixes to the canvas

"Pay the rider in cash" sits on `accentSoft` in the canvas in `inkMuted`, about 4.3:1: drawn in `ink`. The bar's blocks sit on `canvas`: text in `ink` (L3's minimum-order block, same finding).

### 9. Copy

Refusal copy is web's word for word; core's messages are never shown at checkout except a failed removal's, which is L3's write-failure alert. The button is "Place order" (the canvas), not web's "Place order (COD)": the payment card already says cash on delivery, and the bar holds the amount. Its accessible name is "Place order" alone, so tests and screen readers find one stable name.

### 10. No layout requirement

Web has "Customer checkout and order page layout" (44 px targets inside cards, no sideways scroll, tabular amounts) checked by Playwright geometry. Here every control is an L1 primitive with a 44 px minimum, amounts use `tabular`, and the web export is fixed at 390 wide; the e2e suite runs axe on every state. Ceiling: no geometry assertion; add one when a layout bug shows up on a device walk.

### 11. e2e helpers copied, picks 2 to 5

`e2e/orders.spec.ts` keeps its helpers local; this suite copies the ones it needs (`freshShopper`, `orderPick` returning the name too, `fillCart`, `addAddress` with a label and pincode, `staffHeaders`, `signedIn`, `expectNoViolations`) rather than editing L4a's file. Ceiling: duplicated helpers until L5b extracts a shared `e2e/support.ts`. Picks use web's `orderPick` rule at indices 2, 3, 4 and 5 (L4a takes 0 and 1). `/checkout` is a static route and loads directly on the export, but the suite reaches it through "View cart" and "Proceed to checkout", the path a customer takes.

## Contract audit (core openapi on main, 2026-10-16)

Every route and field exists: `POST /orders` with `OrderCreate` `{addressId}` → 201 `Order` (`id`, `number`, the rest as L4a reads it); 400 `validation` without a field (cart empty), with `addressId` (missing, not a uuid, unknown address) or `subtotal`; 401; 409 `not_serviceable` with field `addressId` (not served) or none (store closed); 409 `out_of_stock` with `productIds`; 409 `conflict` (number collision, retry). `GET /stores/{id}` → `Store` with `name` and `promisedMinutes`. `GET /me/cart`, `PUT /me/cart/items`, `GET` and `POST /me/addresses`, `GET /orders/{id}`, `GET /orders` as L1, L3 and L4a use them. e2e: `POST /auth/register`, `POST /admin/auth/sign-in`, `GET` and `PUT /admin/stores/{id}/stock`, `GET /stores/{id}/products`. No rider route. **No gaps.** Notes, not requests: `Address` has no city (the canvas's "Bengaluru" in the address line is left out); payment is always `cod`, so nothing is sent for it.

## Files

All inside `apps/mobile/` plus this change, `docs/design/mobile-P4-L4b.md` and the lane logs:

- New: `src/checkout.ts`, `src/checkout-address.tsx`, `src/checkout-screen.tsx`, `src/app/checkout.tsx`, `e2e/checkout.spec.ts`; tests `src/checkout.test.ts`, `src/checkout-address.test.tsx`, `src/checkout-screen.test.tsx`, `src/checkout-redirect.test.tsx`, `src/checkout-back.test.tsx`, `src/checkout-place.test.tsx`, `src/checkout-placed.test.tsx`, `src/checkout-emptied.test.tsx`, `src/checkout-unconfirmed.test.tsx`, `src/checkout-out-of-stock.test.tsx`
- No file outside this change's list: L3's exports cover what checkout needs (task 0)

## Scenario to test

| Scenario | Test file: test name | Task |
|---|---|---|
| Order placed after a pending cart change; Order number collision retried once | `src/checkout.test.ts`: the scenario names | 1 |
| Default address shown; No address yet; Choice sheet lists the addresses; Another address chosen; Address added at checkout | `src/checkout-address.test.tsx`: the scenario names | 2 |
| Checkout summary from the cart; Summary names the cart's store; Cash on delivery and bill; Free delivery at checkout; Empty checkout; Loading and failed checkout; Checkout below the minimum; Minimum from the cart when the pincode is not served; No address blocks placing; Place order shows the amount | `src/checkout-screen.test.tsx`: the scenario names | 3 |
| Signed-out checkout redirect | `src/checkout-redirect.test.tsx`: `Signed-out checkout redirect` | 3 |
| Back to cart opens the cart sheet | `src/checkout-back.test.tsx`: `Back to cart opens the cart sheet` | 3 |
| Place order sent once; Address not served; Store closed at placement; Placement fails; Choosing another address clears the alert; Core cannot be reached at placement | `src/checkout-place.test.tsx`: the scenario names | 4 |
| Order placed | `src/checkout-placed.test.tsx`: `Order placed` | 4 |
| Cart already empty goes to orders | `src/checkout-emptied.test.tsx`: `Cart already empty goes to orders` | 4 |
| Unconfirmed placement that emptied the cart | `src/checkout-unconfirmed.test.tsx`: `Unconfirmed placement that emptied the cart` | 4 |
| Out-of-stock lines marked; Marked line removed; Failed removal at checkout | `src/checkout-out-of-stock.test.tsx`: the scenario names | 5 |
| Address added at checkout against core; Order placed against core; Out of stock at checkout against core; Address not served against core | `e2e/checkout.spec.ts`: the scenario names | 6 |

"Placement fails" is three tests, `Placement fails (subtotal)`, `(address)` and `(conflict)` (tasks.md allows it). Extra tests with no scenario of their own: `refused address badge` (task 2), `Place order sends nothing while the address list is unread` (task 4), the outcome, refusal, mark and block tables (task 1). Task 1's unit tests of `outcomeOf`, `refusalOf`, `shortText` and `blockReason` cover no scenario on their own; tasks 3 to 5 cover the same rules on the screen.

## Risks / Trade-offs

- [L3's names] Reconciled in task 0 against L3 as merged (#300, archived #301): `useCart`, `cartKey`, `queued`, `storeOptions`, `useLineWrite`, `useLineQuantity`, `openCartSheet`, `CartWriteAlert`, `cartView`, `emptyCart` as named here; the cart sheet's "Proceed to checkout" is a link to `/checkout`. `ReplacedNotice` is not shown at checkout (no Stepper there, web shows none either).
- [`useCart().error` is core's whole envelope] L3's `cartOptions` throws `{ error: {...} }`, not the inner error, so L1's `ErrorBanner` reads every failed cart read as "You're offline". The checkout scenario only uses an unreachable core, so nothing here depends on it; reported to the manager for L3 as a follow-up.
- [Two sheets] "Choose address" closes before "Add address" opens; on the web export the second dialog's role arrives after its slide, so tests and e2e wait for `getByRole('dialog', { name: 'Add address' })`.
- [Success shows the empty state for a frame] The cart cache empties before `router.replace` lands; web has the same frame. Harmless: the screen is replaced at once.
- [`replace` to a tab route] `/orders` is the Orders tab inside `(tabs)`; `router.replace('/orders')` from a stack screen is what L4a's "Your orders" does with `navigate`. Task 4's router test asserts the path.
- [axe on the alert and blocks] Alert text is `ink` on `dangerSoft`; block text `ink` on `canvas`; mark text `danger` on `surface` (the cart sheet's alert pair). An axe failure on markup the app does not control stops the worker (no rule switched off).
- [Parallel workers] Group A's two tasks touch disjoint files; later tasks are serial on `src/checkout-screen.tsx`.

## Acceptance record (task 7)

Verified on the branch at a32a2c1 (L3 #300 and core-P4-L2 #314 merged in): `packages/ui` build, mobile lint and typecheck exit 0; `npm run test --workspace apps/mobile -- --run` 90 suites, 355 tests, node tests 7 of 7; mobile build exit 0; `openspec validate --all --strict` 20 passed. `make e2e` exit 0 per T6 (admin 15, mobile 25 with the four checkout scenarios, rider 7, web 45). Every one of the 35 scenarios maps to a test of the same name in the table above (all passing); tasks 0 to 6 ticked.

Landed outside the task scopes, accepted by the manager:
- F1 (8f9de62, test 16b6624): `src/cart.ts` `cartOptions` throws `error.error`, so the error state tells a server failure from an unreachable core (found at task 0); `src/cart.test.ts` covers it.
- F2 (e886eee): `src/account.test.tsx` "Profile shown" waits for the profile (`findByText`), a race under parallel load seen by T1 and T2. Labelled `fix:` though it changes only a test (reviewer R1 finding 4); not rewritten.

Test-first deviations, for the record: T1 corrected its red test to the design's `detail` field before the feat (253ecde); T2 changed its group selector to `getByLabelText` after the red commit (0fec71d, RNTL finds no non-accessible `radiogroup` View by role); T3 rewrote its loading test after the feat (9236076: an unmount and second render in one test left the next test's render empty); T4 awaited its presses after the feat (803c450: unawaited presses overlapped `act()`; the press handler returns at once, the held answers sit inside `place()`), so the feat commit alone was red; T6's three of four scenarios were green on the first run (the screens existed; the fourth was a wrong test expectation, c864556).

Decisions workers made where the spec is silent (kept): the bar does not block on the address while the address list is unread (no "Add an address" flash); the new address is read from the query cache at close; the out-of-stock alert stays after a removal until the next press or address choice; axe does not run on the search screen in this suite (L2's suite covers it).

Deferred (ceilings, not gaps): web's 390 px layout check (Decision 10); the city in the address line (core's `Address` has none); payment methods other than cash on delivery (payment service); shared e2e helpers (Decision 11, L5b); native device e2e (D37).

Reviewer R1 (approve): finding 3 taken here (spec wording); findings 1 (unused `send` parameter), 2 (sent-once and address-unread tests no longer exercise the same tick, and the count needs a flush) and 5 (Place order shown while the address list is unread) are being fixed by a worker; acceptance is re-checked when they land.
