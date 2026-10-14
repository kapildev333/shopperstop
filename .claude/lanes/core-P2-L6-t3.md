# core-P2-L6-t3 - tests assert their scenarios (task 3 of core-seed-demo)
Status: done
## Doing
Task 3 landed on `lane/core-P2-L6-seed-demo`: one test commit `fe9862e` (pass first, no feat commit), ticks 3.1. Gates green; the lane has no further task.
## Found
- All four assertion groups passed on their first run; no product code touched, no assertion weakened.
- `TestOrderSnapshotsSurviveProductChange`: the change to the product now goes through `PATCH /api/core/v1/admin/products/{id}` (200, renamed, 6000, 6000, inactive); the image still moves by SQL, as design.md Ceilings says.
- `TestStoreStaffOwnOrder`: the placed fixture order is read in full (store, Asha, phone, Home address, 570000, 2000 + 0 = 2000, one Fixture line of 2 at 1000, one customer `placed` event).
- `TestResetLoadsDemoOrders`: 3 orders carry the Home label, line and pincode of address `...0301`.
- `TestResetTwiceLeavesDemoStores`: 4 open rows, Koramangala `...0401` with 560034 and 560095, Indiranagar `...0402` with 560038 and 560008.
- Nothing in the other lane logs is addressed to this lane.
## Requests
- none
## Blockers
none
