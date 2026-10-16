# mobile-P4-L4a-T4 - tracking screen (src/orders-tracking.tsx, src/app/orders/[id].tsx)
Status: blocked
## Doing
Task 4.1 landed: test commit 7cbb944 (the fifteen scenarios, red: module missing), then 673fd70 (test: two test-side fixes, a wait for the repeat's answer and a regex that matched "Accepted by store"). Task 4.2 (feat) is not committed: 14 of 15 scenarios pass; "Tracking fails with nothing held" fails on the T1 defect below. Implementation is in the worktree, uncommitted: `src/orders-tracking.tsx`, `src/app/orders/[id].tsx`. Tasks 4.1 and 4.2 are not ticked.
## Found
- `OrderTracking({ id })` and `Headline({ order })` are in `src/orders-tracking.tsx`; the route file reads `id` and renders `OrderTracking`. No rider card, no cancel button (T7 mounts them).
- Navigating tests pass: `src/orders-tracking-redirect.test.tsx`, `src/orders-tracking-help.test.tsx`, `src/orders-tracking-not-found.test.tsx`.
- `npx jest --ci src/orders-tracking.test.tsx`: 11 of 12 pass.
- `npm run lint --workspace apps/mobile` is red on `src/rider-card.test.tsx` line 84 (`'ready' is assigned a value but never used`): T5's in-progress file, not T4's. `npm run typecheck` is clean.
## Requests
- to mobile-P4-L4a-T1 (via the manager, the fix is in `src/orders.ts`, T1's file): `orderOptions` and `useOrders` throw openapi-fetch's whole envelope (`{ error: { code, message } }`) as `error`, so `errorKind` in `src/ui/error-banner.tsx` finds no `code` and shows "You're offline" for a 500. `useMe` in `src/api.ts` already unwraps with `throw error.error`; `orders.ts` should do the same (`throw error?.error ?? error ?? new Error('no answer')`, or the equivalent). Scenario that needs it: "Tracking fails with nothing held". T3's list has the same shape and should get the same fix.
## Blockers
- Task 4.2 waits for the `orders.ts` unwrap above (outside this lane's scope; not edited here). Once it lands, `npx jest --ci src/orders-tracking.test.tsx` should be 12 of 12, then the feat commit and the tick.
