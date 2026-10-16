# mobile-P4-L4b-T4 - placing from the screen (`src/checkout-screen.tsx`, task 4 of mobile-checkout)
Status: done
## Doing
Done: test commit 67acf00 (red: nine scenarios in four files, 11 red and one guard), feat commit 13a02ae (screen placing, alert, badge, navigation; tasks 4.1 and 4.2 ticked), test commit 803c450 (awaited presses, see Found). Task 4 ticked.
## Found
- Red before feat, each for the right reason: `Place order sent once` (no `POST /orders` sent), the refusals and `Core cannot be reached` (no alert), `Order placed` (no heading at `/orders/<id>`), `Cart already empty goes to orders` and `Unconfirmed placement that emptied the cart` (no navigation to `/orders`). The guard `Place order sends nothing while the address list is unread` passed before feat, as the button sent nothing yet; it stays as the guard for `place()`.
- Deviation: the red commit's four files used unawaited `fireEvent.press`. With the feat they failed (overlapping `act()` calls, then the next test rendered empty). The presses are awaited in commit 803c450, a test-only commit after the feat, because history is not rewritten. Between 67acf00 and 803c450 the test files were red at HEAD; the feat commit alone is not green. Awaiting is safe here because the press handler returns `undefined` (`void place()`); the held answers are inside `place()`.
- Choices (no spec text decides them): the `sending` guard is a ref, so a second press in the same tick is refused; `place()` returns without sending while no address is chosen (the test above); the "Placement fails" scenario is three tests named `Placement fails (subtotal)`, `(address)` and `(conflict)`, one render each, as tasks.md allows; the refusal alert renders `Refusal.detail` as its second line (task 5 relies on the same field for the out-of-stock refusal); `outcomeOf` decides the navigation, `router.replace` to `/orders/<id>` or `/orders`.
- `productIds` from `outcomeOf` is not read in this task (task 5 marks the lines).
## Gates (worktree, after 803c450's content was in place)
- `npm run build --workspace packages/ui`: exit 0.
- `npm run lint --workspace apps/mobile`: exit 0.
- `npm run typecheck --workspace apps/mobile`: exit 0.
- `npm run test --workspace apps/mobile -- --run`, three runs: each `Test Suites: 89 passed, 89 total`, `Tests: 352 passed, 352 total` (340 before, plus the 12 new). No console errors in the feature files.
- `npm run build --workspace apps/mobile`: exit 0 (`Exported: dist`).
- `openspec validate mobile-checkout --strict`: "Change 'mobile-checkout' is valid".
- `npm ci` ran once in the worktree (no `node_modules` before).
## Requests
none
## Blockers
none
