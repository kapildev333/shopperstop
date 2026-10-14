# core-P2-L5-t6 - Part 0 review items from task 5, then the staff dashboard (task 6 of core-orders)
Status: done
## Doing
Part 0 and task 6 landed on `lane/core-P2-L5-orders`: Part 0 A test commit 06bc528 (first run passed), Part 0 B fix commit 525b3d7, Part 0 C docs commit dd546ec (`openapi.json` and the regenerated `core.d.ts` and Postman collection), task 6 test commit b4ea9df (red), task 6 feat commit 6b6d230 (code, `openapi.json`, `core.d.ts`, Postman collection, boxes 6.1 and 6.2 ticked), then this chore. Gates green: `GOFLAGS=-count=1 make test-core` exit 0; `make gen postman` exit 0 and `git status --short` empty after the feat commit; `openspec validate --all --strict` 13 passed. Task 7 (demo orders) is next and starts from its own brief.
## Found
- Part 0 A: all three tests passed on their first run, no product code touched. `TestTransitionLogLine` now compares each `order transition` line's key set with `time`, `level`, `msg`, `orderId`, `number`, `to`, `actorType`, `actorId`, `requestId` plus `from` on the accept line only (helper `requireTransitionKeys`). `TestStoreStaffIsolation` asserts one event after the refused change and adds store staff on an unknown store (404) and on the other store with `?status=lost&page=0` (404). `TestStatusConcurrentSameTransition` (helper `statusAsync`): 10 rounds, each an order accepted through the admin route, then admin and store staff post `packing` at once; exactly one 200, one 409 `conflict`, status `packing`, three events.
- Part 0 B: `staffScope` is `scope{}` for role `admin` and `scope{storeID: &s.StoreID}` for every other role. `StoreList` has no `"store_staff"` literal of its own; it calls `staffScope`, so the one edit covers it. No test went red, as the brief said. Not checked by any test: a non-admin staff user with an empty store id would send `''` to a uuid column (pgx error, 500 rather than "no rows"). The `staff_users_admin_has_no_store` check constraint makes that row impossible today, so it is unreachable; say if a guaranteed "matches nothing" is wanted.
- Part 0 C: the `listStoreOrders` 400 description already named `page` and `pageSize` but gave no bounds. It now reads "an unknown status value, or a page below 1 or a pageSize outside 1 to 100" (the bounds of `httpx.Page`). The example stays.
- Task 6 red run (commit b4ea9df): every dashboard test and `TestAuthGates` failed on the missing route, 404 `not_found` where 200 or 401 was wanted (`TestDashboardToday`, `TestDashboardTwoDaysAgo`, `TestDashboardLowStock`, `TestDashboardStoreStaffOwnStore`, `TestDashboardAdminAllStores`, `TestDashboardCustomerToken401`, `TestAuthGates` on the new admin row). Nothing passed at red.
- Task 6 green: `TestDashboard*` (6 tests) and `TestAuthGates`, `TestContract*` pass.
- Deviation from design.md Decision 12, following the brief: the handler tests `s.Role == "admin"` (admin: `store.All`; any other role: `store.Get(s.StoreID)`), not `== "store_staff"`. Same fail-closed rule as Part 0 B.
- `order.Today(ctx, d db.DBTX, storeID)` and `store.All(ctx, q db.DBTX)` as in design Interfaces. `staff.Dashboard` is in `internal/staff/dashboard.go` with the package comment; no SQL in `staff`.
- A stray scratch redirect went to `/tmp` by mistake during the gate run; it was deleted at once. Later output went to the scratchpad.
## Requests
- none
## Blockers
- none
