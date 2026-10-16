# mobile-P4-L3-T9 - e2e/cart.spec.ts, six scenarios against core (mobile-cart task 9)
Status: done (9.1 to 9.3 ticked; `make e2e` exit 0 twice; R1 manager items 1 to 4 landed)
## Doing
Done. Manager items landed test-first: closing store-change dialog, search count ink, per-line sheet count, ReplacedNotice.
## Doing (earlier)
Task 9.1 and 9.2 done: `e2e/cart.spec.ts` committed red, then two test-side fixes; all six scenarios green; no app fix needed. 9.3 not met: `make e2e` from the worktree root fails once on the mobile workspace (catalog.spec.ts:186, "store change against core", axe color-contrast on the store-change dialog text, L2's code). Reported to the manager; not fixed here (outside L3's scope).
## Commits (branch lane/mobile-P4-L3-cart, in order)
- `c8c27d7` `test: cart e2e scenarios against core` (red: first run 4 passed, 2 failed: Clamp strict-mode locator on a Home card and search; Replaced timed out on a Close click intercepted by the sheet panel)
- `23a79e3` `test: cart e2e clamp starts from Home, replaced sheet closes on its scrim` (test-side: Clamp reaches the product from Home's picks, so no search screen is visited; the Replaced sheet closes by a click on the scrim's corner, as a tap does)
- tick and lane log: this commit (`docs(mobile): mobile-P4-L3-T9 ...`)
## Found
- Red run (before fixes): `npm run e2e --workspace apps/mobile -- e2e/cart.spec.ts`: 4 passed (Guest, Quick taps, Merge, Server store change), 2 failed (Clamp: strict mode, two links to the product; Replaced: click intercepted by the sheet panel, a test-side click point).
- After the fixes: 6 of 6 green (18.3 s, 4 specs' worth of axe runs in each).
- Clamp: the axe run on the search screen (`1 product for “Alphonso Mango”` heading, `#6b7280` on `#f5f6f8`, 4.47:1) is L2's search screen (`src/app/search.tsx` heading, outside L3's scope). Not reachable from the Clamp test now; the search screen is not visited by any cart test. Report to the manager for L2's catalog/search fix.
- `make e2e` (worktree root, two runs): admin 15/15, rider 7/7, web 45/45; mobile 20/21: `e2e/catalog.spec.ts:186` "store change against core" fails on axe `color-contrast` on the store-change dialog's body text, which reads "Pincode undefined ... Your cart has undefined items from undefined" (the dialog's content rendered with the change already cleared, during its close). Node: `<div dir="auto" ...>` in `StoreChangeDialog` (`src/pincode-sheet.tsx`, L2). The same test passes alone (2 of 2 runs), the whole mobile suite passes alone (21 of 21), and admin then mobile passes. Only the full `make e2e` run fails it, so it is a timing race in L2's dialog test under that run. Not caused by `cart.spec.ts` (which passes in all the mobile-only runs above).
## Requests
- to mobile manager: L2's `e2e/catalog.spec.ts` "store change against core" flakes in the full `make e2e` run (dialog text rendered as undefined during the close; axe color-contrast). Needs a fix in L2's dialog flow (`src/pincode-sheet.tsx`) or its test's wait, outside L3's scope.
- to mobile manager: L2's search screen heading `1 product for ...` uses `inkMuted` on `canvas` (4.47:1, axe color-contrast). Outside L3's scope; L2 or a follow-up fix.
## Blockers
- 9.3: `make e2e` must exit 0. Blocked on the L2 catalog test above.
- Manager items (R1 and the L2 flake), all test-first: `124e0db`/`7163267` test, `178553c` fix (StoreChangeDialog keeps its last change while it closes; new file `src/pincode-store-change-close.test.tsx` stands in for the device's retained Modal children, since RN's Modal drops children at once under Jest); `b67e98f` fix (search count in ink); `5989797` fix (sheet lines use `useLineQuantity`, R1 #1); `fed7cc0` refactor (`ReplacedNotice` in `src/cart-alert.tsx`, R1 #3).
- Gates: jest 3 of 3 green (80 suites, 302 tests), lint, typecheck, build, `openspec validate --all --strict` 20 passed.
- `make e2e` from the worktree root, two runs, exit 0 both: admin 15 passed, mobile 21 passed, rider 7 passed, web 45 passed.
- Manager note (20:47 pkill of cmd/core by another session): not caused here; both runs were after it, and the ports were free before run 1.
