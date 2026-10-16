# mobile-P4-L4b-T3 - checkout screen, states and route (`src/checkout-screen.tsx`, `src/app/checkout.tsx`, task 3 of mobile-checkout)
Status: done
## Doing
Done: test commit 51d60a6 (red: the twelve scenarios in three files), feat commit d4a936a (screen, route, ticks 3.1 and 3.2), test commit 9236076 (loading test rewritten, see Found). Tasks 3.1 and 3.2 ticked in d4a936a.
## Found
- Red before feat: `src/checkout-screen.test.tsx` → `Cannot find module './checkout-screen'`; `src/checkout-back.test.tsx` → `Cannot find module './app/checkout'`; `src/checkout-redirect.test.tsx` → the route is not found (the sign-in heading never shows).
- Loading test rewritten after the feat (commit 9236076): the first version read the cart twice in one test, with `unmount()` and a second `renderScreen()`. Run in the file, the next test ("Checkout below the minimum") rendered no cart at all: no fetch calls and an empty query cache, though it passed alone. The rewrite holds the first read, rejects it with a `TypeError` (the "You're offline" path), then presses "Try again"; one render, same two halves. Root cause not chased further; recorded as a harness lesson: do not unmount and render again inside one test.
- Choice (no spec text decides it): while `GET /me/addresses` has not answered, the bar does not block on the address (`hasAddress` is true until the list is read), so the "Add an address" block never flashes on load. A failed address read leaves the button shown; task 4's `place()` returns with no chosen address.
- The "Place order" button renders with the amount and no press handler (task 4 wires it); `blockReason` runs with `marked: false` (task 5).
- Screen split as design.md asks: `CheckoutScreen` (token check, Redirect) renders `Checkout` (hooks), so no hook runs after a conditional return.
- Lines use the cart's store only: `storeOptions(view.storeId)` with `enabled: !!view?.storeId`; fees, subtotal, minimum and total come from `useCart().view`.
- The branch carries two other commits made in this session by other lanes or sessions: `d682212` (F2 lane log) and `e886eee` (account profile test wait). Not touched here.
## Gates (worktree, after 9236076's content was in place)
- `npm run build --workspace packages/ui`: exit 0.
- `npm run lint --workspace apps/mobile`: exit 0.
- `npm run typecheck --workspace apps/mobile`: exit 0.
- `npm run test --workspace apps/mobile -- --run`: exit 0; `Test Suites: 85 passed, 85 total`, `Tests: 340 passed, 340 total`.
- `npm run build --workspace apps/mobile`: exit 0 (`Exported: dist`).
- `openspec validate mobile-checkout --strict`: "Change 'mobile-checkout' is valid".
- Single files: `checkout-screen.test.tsx` 10/10, `checkout-redirect.test.tsx` 1/1, `checkout-back.test.tsx` 1/1.
## Requests
none
## Blockers
none
