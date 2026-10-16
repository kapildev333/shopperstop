# rider-P3-L2-T3 - rider deliveries list, read and delivered (task 3 of rider-deliveries)
Status: done (tasks 3.1 to 3.4 ticked; gates green on the feat commit; reviewer pending)
## Doing
Done. Waiting for the reviewer and the manager's landing.
## Found
- Precondition commits, as the manager asked: `1f7d150 fix: migrate test lists 0003_deliveries; seed reset truncates delivery tables`, then `fix: seed test truncate covers the delivery tables` (one line in `services/rider/internal/seed/seed_test.go` line 117, `truncate rider_locations, deliveries, sessions, riders`). `make test-rider` green after it.
- Red commit `test: rider deliveries list, read and delivered`. Red run (`go test -race -count=1 -run 'TestListDefaultsToAssigned|TestListDelivered|TestListBadStatus|TestGetOtherRidersDelivery|TestDeliveredOnce|TestDeliveredStaysAssignedWhenCoreFails|TestClaimAndDeliveredLogged' ./internal/app/`), before any product code:
```
--- FAIL: TestListDefaultsToAssigned (2.46s)
    deliveries_test.go:446: list: got 404 {"error":{"code":"not_found","message":"not found"}}
--- FAIL: TestListDelivered (0.02s)
    deliveries_test.go:472: list delivered: got 404 {"error":{"code":"not_found","message":"not found"}}
--- FAIL: TestListBadStatus (0.01s)
    deliveries_test.go:495: list with status=packing: got 404 {"error":{"code":"not_found","message":"not found"}}
--- FAIL: TestGetOtherRidersDelivery (0.03s)
    deliveries_test.go:507: own delivery: got 404 {"error":{"code":"not_found","message":"not found"}}
--- FAIL: TestDeliveredOnce (0.02s)
    deliveries_test.go:530: delivered: got 404 {"error":{"code":"not_found","message":"not found"}}
--- FAIL: TestDeliveredStaysAssignedWhenCoreFails (0.02s)
    deliveries_test.go:564: delivered with core failing: got 404 {"error":{"code":"not_found","message":"not found"}}
--- FAIL: TestClaimAndDeliveredLogged (0.02s)
    deliveries_test.go:594: delivered: got 404 {"error":{"code":"not_found","message":"not found"}}
```
- Implemented in `internal/delivery/delivery.go`: `List` (Decision 11: `httpx.Page`, status default `assigned`, else 400 on `status`, `NewList`, newest claim first via the query), `Get` (`httpx.PathID` then `RiderDelivery` with the rider filter; another rider, unknown and non-uuid are 404), `Delivered` (Decision 4: one `pgx.BeginFunc`, `LockRiderDelivery` for update, 409 `delivery is not assigned` unless assigned, `ChangeStatus(delivered)` with the rider actor, `MarkDelivered`; log `delivery delivered` after commit). The claim log already landed in T2 and is unchanged. Routes in `internal/app/app.go`.
- `openapi.json`: schema `DeliveryList`; operations `listDeliveries`, `getDelivery`, `markDelivered` with every code of the routes table and examples; `GET /me/deliveries` and `POST /me/deliveries` share the path key.
- Gates (worktree root): `make test-rider` exit 0, all packages ok (app, seed and migrate included). `make gen` exit 0 (only `core.d.ts`, rider sqlc unchanged). `make postman` exit 0, `# pass 17 # fail 0`. `openspec validate --all --strict`: `Totals: 16 passed, 0 failed (16 items)`. `packages/ui/src/api/rider.d.ts` does not exist in the worktree, so it is not committed.
- Not in design.md, a small ordering I picked and the reviewer may change: `List` validates `page`/`pageSize` (via `httpx.Page`) before `status`, so a request with both wrong reports `page`. No other choice beyond design.md.
## Requests
- to rider-P3-L2 (the lead): task 4 needs `internal/auth` `Bearer` rename (Decision 2), still open in T2's Requests.
## Blockers
- none
