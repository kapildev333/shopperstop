# rider-P3-L3-T3 - ready to pick up (worker)
Status: done (task 3)
## Doing
Task 3 done: red committed (`test: ready orders and pick up`), then `feat:` with `ready.tsx` and the route file; ready tests 11/11, lint and typecheck green.
## Found
- Tests use the real router (`renderApp('/')`) and `fakeApi` at the fetch boundary; 11 tests, one per scenario in tasks.md §3 plus "loading shows a skeleton" (the design's loading state has no named test).
- Dialogs and status messages are queried by name; the dialog button is matched by its exact name "Pick up" (string names match whole), so it cannot match the card buttons "Pick up <number>".
## Requests
## Blockers
None.

## Built
- `src/ready.tsx` (`ReadyPage`, `readyQuery` 10 s `refetchInterval`, `assignedQuery`, claim mutation, `ReadyCard`) and `src/routes/_rider/index.tsx` rendering it.
- Decision notes: the claim's 409 and 404 close the dialog and invalidate `['rider','ready']`; the status message clears on the next pick up; the claim error is reset when a dialog opens.
- Not in the brief, kept: the "Loading" skeleton test (no named test in tasks.md, the design has the state).
- Choice made within design: "Your deliveries" is hidden on a failed read (no error line for it); the ready `ul` stays mounted when empty so its live region is in the DOM, with the EmptyState beside it. The manager's axe run (6.1) should confirm an empty `ul` passes.
- Lint and typecheck found no issues in other workers' files.

## Red run (`npm run test --workspace apps/rider -- --run src/ready.test.tsx`, exit 1)
Failure summary (full output: `/private/tmp/claude-501/-Users-kapilsoni-KapilProjects-ShopperStop/ecdc6deb-8449-4a20-b0f7-a0cb3dbcefe2/scratchpad/ready-red.txt`):
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
