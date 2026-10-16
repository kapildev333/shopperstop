# rider-P3-L3-T4 - delivery page, delivered and location (worker)
Status: done (tasks 4.1 to 4.3): red committed, then green with the feat commit; gates run
## Doing
Task 4 done: red committed, then the page, the hook and the route file in the feat commit; targeted tests, lint and typecheck green.
## Found
- `apps/rider` has no lucide-react dependency (only `packages/ui` and `apps/web` declare it). The design's `Phone` icon on the "Call" link is left out rather than adding a dependency to `apps/rider/package.json` (out of this task's scope); copy and link are unchanged.
- `unknown delivery` and `no cash line for a payment made online` pass on the red run: the task 1 stub already answers the not-found page, and a stub without a cash line shows none. They stay as guards.
- Mark delivered refused (409): the spec and design say "close the dialog and read the delivery again" with no message; the brief's "409 as StatusMessage" is not in either, so the page shows no message on 409 (escalated to the manager in the report).
## Requests
## Blockers
None.

## Red run (`npm run test --workspace apps/rider -- --run src/delivery.test.tsx src/location.test.tsx`, exit 1)
```
 Test Files  2 failed (2)
      Tests  14 failed | 2 passed (16)
 × src/delivery.test.tsx > assigned delivery shown
 × src/delivery.test.tsx > cash on delivery
 × src/delivery.test.tsx > delivered shows no collection
 × src/delivery.test.tsx > tel link only when a phone exists
 × src/delivery.test.tsx > cancel sends nothing
 × src/delivery.test.tsx > delivered
 × src/delivery.test.tsx > core fails
 × src/delivery.test.tsx > refused 409 closes the dialog and reads the delivery again
 × src/location.test.tsx > first fix sent, then every 15 seconds
 × src/location.test.tsx > stops after delivered
 × src/location.test.tsx > a delivered delivery is never watched
 × src/location.test.tsx > permission denied shows the message once and Mark delivered still works
 × src/location.test.tsx > no geolocation api shows the message and the page works
 × src/location.test.tsx > a failed send shows nothing and the next position is sent as scheduled
 ✓ src/delivery.test.tsx > unknown delivery
 ✓ src/delivery.test.tsx > no cash line for a payment made online
```
Each failure is an assertion on the stub page (the heading only: no customer, items, badge, dialog or location), not an import error.

## Gates
- `npm run test --workspace apps/rider -- --run src/delivery.test.tsx src/location.test.tsx`: 2 files, 16 tests passed (green).
- `npm run lint --workspace apps/rider` and `npm run typecheck --workspace apps/rider`: exit 0.
- Green deviation from the red run: the cleanup in `location.ts` keeps the `geolocation` object it watched with (a test removes the fake before React unmounts); two locators in the tests were fixed (the stacked table text, and "Call" links, since the nav has links too).
