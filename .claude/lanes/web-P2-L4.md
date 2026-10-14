# web-P2-L4 - web-checkout-orders: /checkout, /orders/{id}, /orders (team lead)
Status: started
## Doing
2026-10-13: task 1 landed and is in review; artifacts updated for D28, web-P2-L8 and task 1 as landed. Next: task 2 worker.
## Found
- Change: `openspec/changes/web-checkout-orders/` (proposal; `web-app` delta: 18 ADDED requirements, 1 MODIFIED "Customer cart bar and header button", 44 scenarios of which 42 new; design with files, interfaces, copy, 21 decisions, the scenario-to-test map and the e2e plan; tasks: four). No `docs/design/web-P2-L4.md`: design.md is enough.
- `openspec validate web-checkout-orders --strict` valid (one warning, not an error: "Consider splitting changes with more than 10 deltas"); `--all --strict` 15 of 15 on the branch. Archive rehearsed on a scratch copy of `origin/main`'s `openspec/` plus this change: 18 added, 1 modified, `web-app` 58 requirements and 151 scenarios, `--all --strict` 14 of 14; the longest merged requirement of this change is 483 characters (limit 500).
- The branch was cut at `e6d8e4b`; `origin/main` is four commits on (#140 archive of core-orders, then plan and area-plan commits; none touches `apps/web`, `packages/ui`, `openapi.json` or `specs/web-app`). `openspec/specs/orders` is not on the branch yet; it was read from `origin/main`. The manager rebases before task 1; no conflict expected.
- Contract checked against `services/core/openapi.json`, `core.d.ts` and `internal/order/place.go`, not the relayed summary. It holds. Two points the summary did not carry: `setLine` takes the product object, `setLine(storeId, product, quantity)`, not a product id; core checks the address and the store before stock, and stock before the minimum.
- Design points other lanes may care about:
  - `placeOrder` runs inside `cart.ts`'s write queue (task 3 exports `queued`): a Stepper tap followed by "Place order (COD)" would otherwise place the old quantity and then write the new one into a fresh cart.
  - After 201 the cart cache is set to the empty cart (not only invalidated), so the bar and header do not show the old count on the order page.
  - 400 `validation` with no field at placement goes to `/orders`; matched on the code and the absent field, never the message.
  - `useAddresses` moves from `routes/account.tsx` to `src/addresses.ts` with `addAddress`; `storeOptions` / `useStore` go to `src/catalog.ts` (`storeKey` stays exported from `cart-drawer.tsx`); the drawer's totals become the exported `Totals`.
  - The phone cart bar is not shown on `/checkout` (MODIFIED requirement).
  - e2e: `e2e/shopper.ts` helpers; every writing test has its own customer, address, cart and product (`orderPick(request, n)` from `page=2&pageSize=100`, which no other spec touches); the cancel test cancels an order it placed itself; demo orders are only read.
- Admin's lead to web (`.claude/areas/admin.md` on main, #143): with `openapi-fetch` 0.17.0 a non-ok answer with an empty or non-JSON body gives `error` undefined, so `if (error) throw` and `call()` read a 502 as success. This change's new code does not rely on it (design Decision 21: writes need the order in the answer, reads throw without data). The existing web code (`call`, the cart, the account forms) still has the shape; the one-place fix is an `onResponse` middleware in `src/api.ts`, outside this change: for the manager (a fix lane, or an extra task here).
- For web-P2-L5 (`web-e2e-flows`): `e2e/shopper.ts` will hold `freshShopper`, `addAddress`, `orderPick`, `fillCart`, `placeByApi`, `signedIn`, `staffHeaders`; page copy and accessible names are in design.md.
- Not checked by this lane: the Figma `Customer web` frames for the three pages.
- 2026-10-13, after the manager's rebase and task 1: (1) design Decision 21 rewritten: web-P2-L8 (#152) covers failed answers without an envelope; what stays is that a write needs the order in its answer, and that `internal` on `POST /orders` makes `placeOrder` read the cart again (a second press is safe: 400 "cart is empty" goes to `/orders`). (2) Status badges are PLAN.md D28; all seven enum values, `ready` included, are in the vocabulary, the scenario and task 2's test. (3) The other defaults stand; the snapshot request to core is closed (not in Phase 2). (4) Task 1 deviations ruled on in design.md "As landed": the plain "Your orders" link is switched in task 2 with a navigation test; the `error || !data` guards, the awaited invalidation in `addAddress`, the empty state without a description and the unused `children` are kept; the `exact: true` rule is Playwright's only.
## Requests
- to ui (optional, through the manager): a single-choice control (radio group or choice card); checkout uses `Chip`s with `aria-pressed` until then. A status-history component if admin wants the same list.
- (closed, not in Phase 2) to core: `promisedMinutes` and the store name as snapshots on `Order`.
- to admin (information, through the manager): status names and `Badge` variants in design.md, Vocabulary (under way `accent`, delivered `success`, cancelled `neutral`).
- (answered 2026-10-13) to the web manager: the defaults stand; badges are D28.
## Blockers
None.
