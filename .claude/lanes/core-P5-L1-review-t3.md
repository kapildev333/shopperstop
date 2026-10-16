# core-P5-L1-review-t3 - review of core-P5-L1 task 3 (events feed and commit-ordered seq, core-payments)
Verdict: approve. No blocking findings. Commits 7bfb011 (test) then aa0810f (feat).

Gates: as recorded for task 1 (acceptance run at d088fce, all green).
Scenarios: orders "Services tail order events" (`TestEventFeedTailsPlacements`, `TestEventFeedValidation`, `TestEventFeedForServicesOnly`), "Event numbers follow commit order" (`TestEventWritesWaitForTheEventsLock`). All pass.

Findings (non-blocking):
1. The seed inserts events without taking the events lock. It runs offline in one transaction, so this is fine.
2. The lock test covers `Transition` only; placement and payment share `addEvent`, so they take the same lock.
3. The test duplicates the lock key literal (`hashtext('order_events')`). If the key ever changes, the test only fails, it does not miss anything.
4. `hashtext` gives an int4 key in the bigint advisory-lock space. Collision with another advisory lock is theoretical (none other exists in core).
