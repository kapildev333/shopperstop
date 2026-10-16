# mobile-P4-L4a-T5 - rider card (src/rider-card.tsx)
Status: done
## Doing
Task 5 landed: test commits f579398 (red, module missing) and 5eedc94 (timing fix in the test); feat commit ff1637c (`RiderCard`, tasks 5.1 and 5.2 ticked); cleanup 32faeff (lint and type fixes in the test). Jest: `rider-card.test.tsx` 5 of 5 green; lint and typecheck exit 0.
## Found
- `RiderCard({ order })` reads `useDelivery(order.id, order.status)` (L4a `rider.ts`) and `useNow()` (T1 `orders.ts`); it renders nothing unless `riderStage(status)` and a name (`order.riderName ?? delivery.riderName`). Mounted by T7 after the timeline card.
- Test timestamps must be taken before the render (`recordedAt = minutesAgo(3)` ahead of `fakeCore`), or the first second reads "2 minutes ago".
- Test-side incident: an amend of my test commit landed on task 6's feat commit (0a275d6). Repaired by moving the branch back to that commit with `reset --mixed` (index was empty; working tree untouched) and re-committing the test fix as 5eedc94. No other worker's commit was rewritten in content.
- Full `npx jest --ci` at the landing: 144 passed, 1 failed: `orders-tracking.test.tsx` › `Tracking fails with nothing held` (task 4, not this lane).
- Design choice taken: "Open in Maps" is a `Button variant="secondary" size="compact"` with `icon={MapPin}` inside a `View` (margin top 12), not a link.
## Requests
None.
## Blockers
None.
