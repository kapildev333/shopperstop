# rider-P5-L2-R1 - review of T1 (3976bfe test, 510509d feat)
Status: done; verdict approve (two low findings, none blocking)

## Checked
- Spec coverage: availability (online/offline, keeps online_since), offline voids open offer, offline waits for the key, missing/non-bool value, sign-out and deactivation offline, sign-in isOnline false, migrations list. Each has a test.
- Migration 0005: defaults and nullable column satisfy both new checks on existing rows; offers is new. Safe.
- Lock: key `(727102, hashtext(current_schema()))` identical in tick (T3 patch), tests and LockDispatch; xact-scoped; first statement in every offline path (deactivation: before LockRider). Order key -> rider row -> offer rows; no cycle with the tick.
- JSON: Rider.IsOnline has no omitempty, always sent; openapi/rider.d.ts/Postman consistent (isOnline optional by Decision 10).
- Test-first order ok; accepted red (1 seed failure) noted in T1 log.
- Gates in scratch worktree at 510509d: go vet clean, gofmt -l empty, openspec validate --all --strict 20 passed 0 failed. go test not run (T2 owns the DB).

## Findings
1. Low, services/rider/internal/auth/rider.go PutAvailability online branch: error not passed through pg.Map and no lock. A deactivation committing between RequireRider and SetAvailability makes riders_online_active fail, so a 500 instead of 401. Fix: map the check violation to 401, or ignore (narrow race, constraint keeps data honest).
2. Nit, services/rider/internal/app/availability_test.go availabilityCode: hand-rolled body read loop; io.ReadAll is the stdlib. Nothing needs the body beyond a Contains check.
