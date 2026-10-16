# rider-P3-L2-T3 - rider deliveries list, read and delivered (task 3 of rider-deliveries)
Status: blocked (precondition fix committed; make test-rider still red in internal/seed; task 3 not started)
## Doing
Stopped after the precondition commit. Waiting for the lead to decide the one-line seed test fix below before the T3 red run.
## Found
- Precondition commit `1f7d150 fix: migrate test lists 0003_deliveries; seed reset truncates delivery tables`: `services/rider/internal/migrate/migrate_test.go` want list now `0001_init 0002_riders 0003_deliveries`; `services/rider/internal/seed/seed.go` `truncateTables` is now `rider_locations, deliveries, sessions, riders`. `internal/migrate` is green.
- `make test-rider` after the commit: every package ok except `internal/seed`:
```
--- FAIL: TestLoadTwiceFails (0.00s)
    seed_test.go:118: ERROR: cannot truncate a table referenced in a foreign key constraint (SQLSTATE 0A000)
FAIL	github.com/kapildev333/shopperstop/services/rider/internal/seed
make: *** [test-rider] Error 1
```
- Cause: `services/rider/internal/seed/seed_test.go` line 117 runs its own `truncate sessions, riders` in `TestLoadTwiceFails`. The brief's precondition named only the two files above and said to touch nothing else in them, and this file is not in task 3's scope. Not edited.
## Requests
- to rider-P3-L2 (the lead): either widen the precondition to `services/rider/internal/seed/seed_test.go` line 117 (`"truncate rider_locations, deliveries, sessions, riders"`), or land it under task 5; then the T3 red run can start.
## Blockers
- `make test-rider` red in `internal/seed` (see Found). Task 3 red run waits on it.
