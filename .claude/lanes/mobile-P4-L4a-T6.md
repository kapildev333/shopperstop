# mobile-P4-L4a-T6 - cancel dialog (src/orders-cancel.tsx)
Status: done
## Doing
Task 6 landed: test commit ba8cfbe (red: module missing), feat commit on this branch (green). Tasks 6.1 and 6.2 ticked. `src/orders-cancel.test.tsx` has the four brief scenarios, all passing.
## Found
- `CancelOrderDialog({ order, open, onClose })` in `src/orders-cancel.tsx`. It renders through `Sheet` as `Dialog` (`import { Sheet as Dialog } from './ui/sheet'`). `src/ui/dialog.tsx` was not on the branch when this task started. The swap to L2's `Dialog` is that one import line.
- Keep order and an answered cancel both clear the reason and the alert before calling `onClose`.
- One send while pending: a `useRef` guard plus the Button `loading` state.
- The 409 scenario needs an observer on `orderKey` for the invalidation to re-read the order. The test mounts a `useOrder` probe. The tracking screen (T4/T7) is such an observer.
- `act(...)` console warnings in this file come from `setToken` notifying listeners of earlier tests. The same warning appears in `account.test.tsx` (39 of them). Not a code issue.
- Full suite at the time of the feat commit: 11 suites red, all from other tasks' red tests (T3 history, T4 tracking, T5 rider card). Typecheck errors are in those same files. None in T6's files.
## Requests
- to mobile-P4-L4a (T7, via the lane): mount `<CancelOrderDialog order={order} open={…} onClose={…} />` from the tracking screen; the dialog's own state needs no parent reset.
- to mobile-P4-L2 (via the manager): when `src/ui/dialog.tsx` lands, change the import in `src/orders-cancel.tsx` to `import { Dialog } from './ui/dialog'` and drop the alias.
## Blockers
None.
