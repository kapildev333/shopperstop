## Context

Every mobile screen has its own e2e suite after L1 to L4b (`accounts`, `catalog`, `orders`, `cart`, `checkout`), each starting from a preset state. Spec 2 §13 wants one customer through all of them. The web app holds that flow as `apps/web/e2e/flows.spec.ts` › "customer order to delivered across both apps" (`web-app` "Customer cross-app end-to-end flows"); this change ports it to the mobile suite, test only.

Binding from earlier mobile changes: on the web export a sheet's dialog role arrives after its slide, so wait for `getByRole('dialog', { name })` before axe or a press (L1 Decision 8); dynamic routes (`/category/<slug>`, `/product/<slug>`, `/orders/<id>`) 404 on a direct load of the static export, so the flow taps through the app and never `goto`s them (L2 Decision 7, L4a Decision 9); screens under the one shown stay mounted at 0×0, so a locator that could match a covered screen is scoped to the visible screen; the token key is `shopperstop.customer-token`, the pincode `shopperstop:pincode`, the guest cart `shopperstop:cart` in `localStorage`.

### The web flow it mirrors

| step | web (`flows.spec.ts`) | mobile (`flow.spec.ts`) |
|---|---|---|
| 1 register | `/register`, back on `/` | `page.goto('/register')` (a static route), "Create account", back on `/` |
| 2 pincode | sheet "Your delivery pincode" | sheet "Where should we deliver?", `560034`, "Continue" |
| 3 browse | Home "Shop by category" › "Dairy, Bread & Eggs" | the same link; the category screen; then its "Back" |
| 4 two products | both from search, signed in | the first from search, signed in; the second at step 6 as a guest |
| 5 quantity | raise the first in the cart drawer | raise the first in the "My cart" sheet ("Add one <name>"), "Close" |
| 6 sign out and in | sign out, sign in, the server cart comes back (merge covered elsewhere) | sign out on "My account"; as a guest add the second product from search; Home "Account" › sign-in › "My account" › "Back"; the guest line is merged into the server cart |
| 7 checkout | drawer › "Proceed to checkout", add address in a dialog | bar "View cart…" › sheet › "Proceed to checkout"; "No addresses yet" › "Add address" sheet › "Save address"; "Delivering to Home" |
| 8 placed | "Place order (COD)", `/orders/<id>` | "Place order", `/orders/<id>`, "Order SS-…", "Order placed. Waiting for the store to accept it." |
| 9 staff | the admin app's board, five steps and a confirm dialog | core's `POST /admin/orders/{id}/status` as `koramangala@shopperstop.local`, five calls (the admin app is not in this suite) |
| 10 delivered | "Your order was delivered." within 15 s, no reload | the same text within 15 s, no reload (L4a's 10 s poll) |

## Goals / Non-Goals

**Goals:** the §13 customer flow in one test, through taps, with the guest merge inside it, axe on every screen and sheet.

**Non-Goals:** app changes; the admin app; the second §13 flow (needs the admin app; the web suite holds it); a shared e2e helper module.

## Decisions

### 1. The guest merge happens inside the flow

Web's flow signs out and in with everything already on the server, and leaves the merge to its cart suite. Here the second product is added after sign-out, as a guest, so the sign-in merges a real guest line (L3's `mergeGuestCart` in `openSession`) into a server cart that already holds the first product. Same steps as §13 (two products, a quantity change, sign out and back in, the cart merged), and the merge is seen end to end. The quantities on the bar, the sheet and checkout (L4b's "<quantity> × <unit>") prove it.

Sign-in goes through Home's "Account" button (`/account` redirects to `/sign-in?returnTo=%2Faccount`, then "My account" after the merge), then "My account"'s "Back" to Home. Not through the cart sheet: a guest cart of one unit is below the minimum, so the sheet shows the minimum-order block and no "Proceed to checkout".

### 2. Products: `orderPick` indices 6 and 7

Picking rule: web's and L4a's `orderPick` (the n-th product on `GET /stores/<koramangala>/products?page=2&pageSize=100` with `inStock`, `quantity === 10`, `priceCents >= 2000`). Index ownership inside the mobile suite: `orders.spec.ts` 0 and 1 (L4a), `checkout.spec.ts` 2 to 5 (L4b; 4 has its stock set to 0 and restored), this flow 6 and 7. `cart.spec.ts` (L3) picks from page 1 (no `page` parameter) and changes stock only there (clamp, restored), and Home's "Picked for you" is page 1 too, so the flow's two products are never on Home and never touched by another test. Playwright runs the spec files in parallel workers against one database; only placing an order takes stock, and only this flow orders 6 and 7. The make target reseeds before every suite, so web's own use of index 7 does not collide. The web flow needs at least 9 qualifying products on page 2; it passes, so 8 exist.

Quantity: the first product's `qa = max(2, ceil((minOrderCents - b.priceCents) / a.priceCents))`, as web's flow, so the merged cart reaches the minimum; with stock 10 the test asserts `qa <= 10`. Search fills the product's name; the card's button is "Add <name>" and its Stepper the group "Quantity of <name>".

### 3. Helpers copied, not extracted

The flow copies what it needs from `e2e/orders.spec.ts` (`core`, `koramangala`, `expectNoViolations`, `freshEmail`, `orderPick` returning `name` and `priceCents` as L4b's copy does, `staffHeaders`) and `sheet` / `savePincode` / `section` from `e2e/catalog.spec.ts`. An `e2e/support.ts` would touch four green spec files owned by four merged changes for no behaviour, under the shared e2e slot. Ceiling: about 60 duplicated lines across five spec files; extract when a sixth mobile spec arrives or a helper must change in more than one file (scope then: `e2e/support.ts` and the helper blocks and imports of every `e2e/*.spec.ts`, no assertion changes).

### 4. Staff half through core's API

The admin app is not built or served by the mobile suite. The order id comes from the tracking URL (`/orders/<uuid>`); `staffHeaders` signs in `koramangala@shopperstop.local` / `staff12345` on `POST /admin/auth/sign-in`; five `POST /admin/orders/{id}/status` calls each answer 200, as `orders.spec.ts` › "Tracking follows the order against core". Ceiling: the store-staff UI half of §13 is covered by the web suite only.

### 5. Test-first for a test-only lane

The behaviour exists once L3 and L4b are merged, so the test may pass on its first run. The `test:` commit is the deliverable. To show the test bites, the worker changes one expected text locally (for example "Your order was delivered!"), sees it fail on that line, and reverts before committing; the log records the failure line. A failure caused by the app is not fixed here (scope is the spec file): the worker stops and reports, and the manager opens a fix task in the owning scope.

## Contract audit

Routes used by the test itself: `GET /stores/{id}`, `GET /stores/{id}/products` (page 2), `POST /admin/auth/sign-in`, `POST /admin/orders/{id}/status`. All on main in `services/core/openapi.json`. No rider route is driven; the tracking screen's rider read finds no delivery and the rider card stays hidden. **No gaps.**

## Files

- New: `apps/mobile/e2e/flow.spec.ts`.
- Nothing else in `apps/mobile`.

## Scenario to test

| Scenario | Test | Task |
|---|---|---|
| Customer order to delivered against core | `e2e/flow.spec.ts`: `Customer order to delivered against core` | 1 |

## Risks / Trade-offs

- [Run time] Register, eleven screens or sheets with axe, and a 10 s poll: `test.slow()` (triple timeout), as web's flow.
- [Sign-in rate limit] Core allows 10 sign-ins per email per hour; the customer signs in once, the staff once per run (L4a's test signs in the same staff once).
- [Back from "My account"] `useBack` goes back when there is history: `/` › `/account` (replaced by `/sign-in`, then by `/account`) › Back lands on `/`. If it lands elsewhere the worker stops and reports.
- [Proceed after a merge] The sheet's "Proceed to checkout" shows only at or above the minimum; Decision 2's `qa` guarantees it.
