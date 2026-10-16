# mobile-P5-L1-T5 - e2e hygiene: picks read once, shared helpers (worker)
Status: done
## Doing
Task 5 landed in one `refactor:` commit (4ebb5c8), no red first (the brief's reason: the suite is its own test). Tick and this log in the chore commit after it. Holding no e2e slot now.
## Found
- `e2e/global-setup.ts` reads, after the reseed, `GET stores/<koramangala>` (`minOrderCents`), `GET stores/<koramangala>/products?page=2&pageSize=100` and `GET stores/<id>/products?pageSize=24` for Koramangala and Indiranagar; any non-200 throws naming the URL. It sets `SHOPPERSTOP_MOBILE_E2E_PICKS` (JSON). `e2e/support.ts` parses it on each call; a missing variable throws "global setup did not hand over the picks".
- `e2e/support.ts` holds the constants, `Shopper`/`Pick` types, `freshEmail`, `expectNoViolations`, `freshShopper`, `orderPick(n)` and `homePicks(minimum, storeId)` (both synchronous), `fillCart`, `addAddress`, `signedIn`, `guest`, `staffHeaders` (Koramangala staff, as orders and flow use it), `adminHeaders` (the admin, as cart and checkout call it), `serverCart`, `pincodeSheet`, `savePincode`, `section`, `quantityOf`, `cartBar`, `cartSheet`, `openSearch`, `searchFor`. Specs keep only what one spec uses (`listedProduct`, `ensureClosedStore`, `proceedToCheckout`, `placeByApi`, `demoShopper`, `registerInBrowser`, `openAccountSignedIn`, `storedToken`, `productLinks`, `top`).
- Test bodies: compared with the pre-change files after the known renames (`await orderPick(request, n)` → `orderPick(n)`, `await homePicks(request, m[, s])` → `homePicks(m[, s])`, `sheet(page)` → `pincodeSheet(page)`, cart's and checkout's `staffHeaders` → `adminHeaders`, flow's `cartBar(page, 'N items')` → `cartBar(page, 'N')`, flow's one-call `searchFor` → `openSearch` then `searchFor`). Only other differences: cart's "Guest cart" test takes no `request` any more (lint: unused), and the demo shopper in `orders.spec.ts` returns its `email` and `password` (the shared `Shopper` type needs them).
- Headers: the file header comments that named the helpers' origin now say "helpers from ./support".
- Gates (after the refactor, before the commit): `npm run build --workspace packages/ui` ok; lint ok; typecheck ok; `npm run test --workspace apps/mobile`: Jest 98 suites, 383 tests passed, node `scripts` 7 tests passed; `npm run build --workspace apps/mobile` ok (lists `/verify-email`, `/reset-password`, `/forgot-password`); `openspec validate --all --strict`: 20 passed.
- `npm run e2e --workspace apps/mobile` (with the Makefile `E2E_ENV`): 28 passed.
- `make e2e`, run 1 (exit 2): admin 15 passed, mobile 28 passed, rider 7 passed, web 46 passed and 1 failed: `apps/web/e2e/browse.spec.ts:99` "search and load more against core", `toHaveValue('a')` received "banana" after `search.fill('a')`. A race in web's search box refill (the box still held the earlier query); the mobile suite is not involved in that test. Web's own flake fix is on main (#330) for the same test family.
- `make e2e`, run 2 (exit 0): admin 15 passed, mobile 28 passed, rider 7 passed, web 47 passed.
- The mobile count is 28, the count after T4; the brief's "previous count plus 2" was relative to 26 before T4.
- Ports 18080, 18081, 18082, 15173 to 15176 free after the runs; no server started by this lane was left running.
## Requests
- to mobile-P5-L1 manager: run 1 of the two `make e2e` runs exited 2 on web's `search and load more against core` (above). Run 2 exited 0. The brief asks for two consecutive green runs; I did not run a third. Decide whether to re-run, and whether the web flake goes to the web area.
## Blockers
None for this lane. The make e2e exit status above is the open item.
