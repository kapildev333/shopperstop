# mobile-P4-L4b-T5 - out-of-stock marks (`src/checkout-screen.tsx`, task 5 of mobile-checkout)
Status: done
## Doing
Done: test commit 35dd1d3 (red: three scenarios), feat commit cecf250 (marks, Remove, failure alert, block on marked lines; tasks 5.1 and 5.2 ticked). Task 5 ticked.
## Found
- Red before feat (`npx jest --ci src/checkout-out-of-stock.test.tsx`): 3 failed, 3 total. `Out-of-stock lines marked`: `Unable to find an element with text: Only 2 left`; `Marked line removed` and `Failed removal at checkout`: `Unable to find an element with role: button, name: Remove Amul Butter`.
- Green after feat: the three tests, plus `checkout-screen.test.tsx`, `checkout-place.test.tsx` and the new file, 22/22 with the other checkout files named above (run together).
- Design as built: `short` is a state record of product id to the quantity asked when core refused; a line is marked while its quantity is unchanged (design "Screen state"). `place()` clears `short` on each press and fills it from `outcome.productIds` against the cart `placeOrder` read again (`cartAfter`, the same read `outcomeOf` uses). `marked` for `blockReason` is any line marked.
- `MarkedLine` (own row, text in place of the unit, `Remove` in place of the price, `CartWriteAlert` under it) uses `useLineWrite(view.storeId, product)` with `write(0)`. The unmarked `Line` is the old row, unchanged.
- The mark is decided by `productIds` only: a short line core did not name is not marked (scenario "Marked line removed" covers Taaza, short by stock but not named).
- No spec text decided: the alert stays after a removal (the scenarios do not ask for its removal); it goes at the next press or address choice.
- BSD sed note for the shell: `sed -i` needs `''` on macOS.
## Gates (worktree, after cecf250)
- `npm run build --workspace packages/ui`: exit 0.
- `npm run lint --workspace apps/mobile`: exit 0 (`eslint .`, no findings).
- `npm run typecheck --workspace apps/mobile`: exit 0 (`tsc -p tsconfig.json`).
- `npm run test --workspace apps/mobile -- --run`, three runs: each exit 0; `Test Suites: 90 passed, 90 total`; `Tests: 355 passed, 355 total` (352 before, plus the 3 new).
- `npm run build --workspace apps/mobile`: exit 0 (`Exported: dist`).
- `openspec validate mobile-checkout --strict`: "Change 'mobile-checkout' is valid".
## Requests
none
## Blockers
none
