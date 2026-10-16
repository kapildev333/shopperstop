# mobile-P4-L4a-T4 - tracking screen (src/orders-tracking.tsx, src/app/orders/[id].tsx)
Status: done
## Doing
Task 4 landed. Commits: 7cbb944 test (fifteen scenarios, red), 673fd70 test (wait for the repeat, match rider lines only), e6a44a2 test (order read and list envelope, red), 648a085 test (await renderHook), 94d4b58 fix (orderOptions and useOrders throw the inner error), de3dcff feat (tracking screen; tasks 4.1 and 4.2 ticked). 15 of 15 tracking scenarios pass.
## Found
- `OrderTracking({ id })` and `Headline({ order })` are in `src/orders-tracking.tsx`; the route file reads `id` and renders `OrderTracking`. No rider card and no cancel button here; T7 mounts them.
- `orders.ts` fix (T1's file, done under the manager's instruction): `orderOptions` and `useOrders` throw `error?.error`, as `useMe` does. `postCancel` already returned the inner error (`call` unwraps it); a guard test covers it.
- Navigating files, one per file: `src/orders-tracking-redirect.test.tsx`, `src/orders-tracking-help.test.tsx`, `src/orders-tracking-not-found.test.tsx`.
- Gates at de3dcff: lint exit 0, typecheck exit 0, `npx jest --ci` 39 suites with 147 passed and 1 failed. The failure is `src/rider-card.test.tsx` "Rider on the way with a position" (T5's file), which passes alone twice and fails only under full-suite load (act warnings and timing). Not touched here.
## Requests
- to mobile-P4-L4a-T5 (via the lane): `src/rider-card.test.tsx` "Rider on the way with a position" is flaky under the full suite; it passes alone.
## Blockers
None.
