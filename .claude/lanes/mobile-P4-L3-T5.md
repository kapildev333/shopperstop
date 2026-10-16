# mobile-P4-L3-T5 - Cart sheet (mobile-cart task 5)
Status: done (committed; the feat imports task 4's `src/cart-alert.tsx`, which is still uncommitted in the worktree)
## Doing
Task 5 done: `CartSheet` (`src/cart-sheet.tsx`) mounted in `src/app/_layout.tsx` after `<PincodeSheet />`. Tasks 5.1 and 5.2 ticked in the feat commit.
## Found
- Red: `0c135c8` `test: sheet lines and bill and the cart sheet scenarios (red)`: `src/cart-sheet.test.tsx` (12 tests), `src/cart-sheet-proceed.test.tsx`, `src/cart-sheet-proceed-signed-in.test.tsx`. Run before the module existed: `Cannot find module './cart-sheet'`.
- Test correction after the first green run: `238dad2` `test: grand total reads in the bill and the footer`. The footer's TOTAL also reads ₹135 (design "Footer"), so the bill assertion became `getAllByText('₹135')` with length 2. No behaviour assertion changed.
- Feat `3ee732a` `feat: cart sheet with lines, bill, minimum order and proceed`: `src/cart-sheet.tsx`, the `_layout.tsx` mount and import, tasks 5.1 and 5.2 ticked.
- Proceed tests assert with `router.getPathname()` and `router.getSearchParams()` (the pattern `src/pincode-sign-in.test.tsx` uses); the brief's `toHavePathname` matcher is not used anywhere in the repo.
- Choices made from the design file, no open question: "Shipment of 1 item" for one line item (the design says "1 item" for one); the header row and "Delivery in N minutes" only when the open store is the cart's store; the Remove button only for out-of-stock lines; `CartWriteAlert` under each line.
- Gates on the working tree at `3ee732a` (`export PATH=...`):
  - `npm run lint --workspace apps/mobile` exit 0.
  - `npm run typecheck --workspace apps/mobile` exit 0 (one fix: `CartLineRow` takes `storeId?: string`, because `view.storeId` is optional; caught by tsc before the commit).
  - `npx jest --ci --silent` (full mobile suite, includes other workers' tests on this branch): `Test Suites: 76 passed, 76 total`, `Tests: 289 passed, 289 total`.
  - `npm run build --workspace packages/ui` exit 0.
  - `npm run build --workspace apps/mobile` exit 0 (`Exported: dist`).
  - `node --test scripts/*.test.mjs` (in `apps/mobile`): `# pass 7`, `# fail 0`.
  - `openspec validate mobile-cart --strict`: `Change 'mobile-cart' is valid`.
## Requests
- to mobile-P4-L3 (task 4 worker and manager): `src/cart-alert.tsx` is untracked in the worktree. `src/cart-sheet.tsx` (commit `3ee732a`) imports `CartWriteAlert` from it, so the branch does not type-check or import in history until task 4 commits that file. Please land it with task 4.2.
- to mobile-P4-L3 (team lead): the sheet's line Steppers take their value from `useQuantity` (design section 4, as written). A cart at a store other than the resolved open store shows "ADD" on its lines, since `useQuantity` prices only the resolved store. Not reachable in the current flows (a store change empties the server cart and the pincode sets the store), so kept as the design says. Flag it if you want the line value to be the cart line's own quantity.
## Blockers
None for task 5.
