# rider-P3-L3-T3 - ready to pick up (worker)
Status: started
## Doing
Task 3.1 red committed; next the page (`ready.tsx`, route file) in `feat:`.
## Found
- Tests use the real router (`renderApp('/')`) and `fakeApi` at the fetch boundary; 11 tests, one per scenario in tasks.md §3 plus "loading shows a skeleton" (the design's loading state has no named test).
- Dialogs and status messages are queried by name; the `Pick up` dialog button is matched with `exact: true` so it cannot match the card buttons "Pick up <number>".
## Requests
## Blockers
None.

## Red run (`npm run test --workspace apps/rider -- --run src/ready.test.tsx`, exit 1)
Failure summary (full output kept in the scratchpad at `SCR/ready-red.txt`):
⎯⎯⎯⎯⎯⎯ Failed Tests 11 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ready.test.tsx > ready orders listed
 FAIL  src/ready.test.tsx > new order appears without a reload
 FAIL  src/ready.test.tsx > loading shows a skeleton
 FAIL  src/ready.test.tsx > no ready orders
 FAIL  src/ready.test.tsx > read fails
 FAIL  src/ready.test.tsx > assigned delivery linked
 FAIL  src/ready.test.tsx > none assigned
 FAIL  src/ready.test.tsx > pick up succeeds
 FAIL  src/ready.test.tsx > cancel sends nothing
 FAIL  src/ready.test.tsx > claimed by someone else
 FAIL  src/ready.test.tsx > service fails
 Test Files  1 failed (1)
      Tests  11 failed (11)
