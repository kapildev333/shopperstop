# rider-P3-L2-T2 - deliveries table, ready orders and claims (task 2 of rider-deliveries)
Status: blocked (feature committed, tasks 2.1 to 2.4 ticked; 2.5 open because make test-rider is red in two packages caused by 0003, see Blockers)
## Doing
Stopped after the feat commit for the lead to decide the two out-of-scope fixes below. Task 3 and 4 wait on this landing; task 5 touches the seed package that is now red.
## Found
- Commits: `1c3982f test: ready orders and exclusive claims` (red), then the `feat:` commit on this branch.
- Red run before any code (`go test -race -count=1 ./internal/app/`), setup failed on the missing package:
```
internal/app/app_test.go:18:2: no required module provides package github.com/kapildev333/shopperstop/services/rider/internal/delivery; to add it:
	go get github.com/kapildev333/shopperstop/services/rider/internal/delivery
FAIL	github.com/kapildev333/shopperstop/services/rider/internal/app [setup failed]
```
- Tests added: `internal/app/deliveries_test.go` with the nine named tests plus `TestClaimLogsClaim` (the "delivery claimed" log line, Decision 12). Shared fake: tests use a fresh store uuid and rider per test so the ready list is isolated; `TestReadyOrdersDropClaimed` inserts the delivery row by SQL because a real claim moves the order out of `ready` in the fake, so only the list's filter is exercised. The status-call check diffs `Calls` before and after, since the fake's counters are global.
- `TestMain` in `app` passes `delivery.New(testPool, coreClient)`; the `readyz` and limited-server callers pass `nil` (Decision 14).
- Implemented: migration 0003 exactly as design.md Data model; `sqlc.yaml` second entry; `queries/deliveries.sql` with all nine queries (tasks 3 and 4 add none); `internal/delivery` (`New`, `Item`, `Address`, `Delivery`, `ReadyOrder`, `ReadyOrders`, `Claim`); routes `GET /api/rider/v1/me/ready-orders` and `POST /api/rider/v1/me/deliveries` behind `RequireRider`; `cmd/rider` builds `delivery.New(pool, c)`; `openapi.json` tag `deliveries`, schemas `ReadyOrder`, `ReadyOrderList`, `DeliveryClaim`, `DeliveryItem`, `DeliveryAddress`, `Delivery`, and the two operations (`listReadyOrders`, `claimOrder`) with 200/201, 400, 401, 404, 409, 502 and examples. `models.go` regenerated (sqlc writes the whole schema into each package).
- Claim ordering as Decision 3: core `Order` with the service token; another store (case-insensitive) or unknown is 404 without a status call; one `pgx.BeginFunc` inserts the snapshot then calls `ChangeStatus(out_for_delivery, rider actor)`; unique violation is 409 "order already claimed", `core.ErrConflict` is 409 "order is not ready for pickup", other core errors pass through.
- Design choice made by the code, not stated in design.md: `items` marshals core's lines with `null` replaced by `[]`; `item_count` is the sum of quantities. Both as Decision 8 says.
- Gates run: `gofmt -l` clean; `go vet ./...` clean; `make test-rider` (see Blockers: two packages red); `make gen` (only core.d.ts unchanged, rider sqlc regenerated); `make postman` (17 pass, collection +574 lines); `openspec validate --all --strict`: `Totals: 16 passed, 0 failed (16 items)`.
- Not done, because it is outside this brief's scope: design Decision 2 (rename `auth.bearer` to exported `Bearer`) is needed by task 4's customer route. `tasks.md` lists no `internal/auth/auth.go`, `rider.go` or `staff.go` in task 2, so it is not in this commit. Task 4's scope needs them added, or the lead says so.
## Requests
- to rider-P3-L2 (the lead): decide the two fixes in Blockers. Either widen task 2 to the two lines below, or land task 5's `truncateTables` change first.
- to rider-P3-L2 (the lead): task 4's scope must include `internal/auth/auth.go`, `rider.go`, `staff.go` for the `Bearer` rename (design Decision 2), or the lead names another way to read the customer's bearer.
## Blockers
- `make test-rider` is red in two packages, both caused by `0003_deliveries.sql`, both outside this task's scope:
  1. `internal/migrate` `TestEmbeddedMigrationsApplyOnce`: `applied [0001_init 0002_riders 0003_deliveries], want [0001_init 0002_riders]`. The test hard-codes the migration list. Fix: add `"0003_deliveries"` to `want` in `services/rider/internal/migrate/migrate_test.go`.
  2. `internal/seed` `TestResetTwiceLeavesDemoRiders`, `TestLoadTwiceFails`, `TestSummaryMatchesSeed`: `truncate demo tables: cannot truncate a table referenced in a foreign key constraint`. `truncateTables` in `services/rider/internal/seed/seed.go` must add `rider_locations` and `deliveries` (design Decision 13 and task 5). Until that lands, `make seed` and `make dev` fail on any database that already has the demo riders.
  The second one is task 5's file (`internal/seed/`), so I did not touch it. The first is a test file in a package no task lists. Neither is mine to decide.
- Task 2.5 stays open until those two are fixed and `make test-rider` is green.
