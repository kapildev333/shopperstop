# rider-P3-L1-T2 - riders, sessions, sign-in, sign-out and me (OpenSpec change rider-service-foundation, tasks 2.1 to 2.5)
Status: started
## Doing
Task 2.1 (red) done: tests written for `internal/auth`, `internal/pg`, `internal/app` (riders_test.go, app_test.go wiring) and `internal/migrate` (`TestEmbeddedMigrationsApplyOnce`). Next: commit `test:`, then the feat commit (0002_riders, sqlc, auth, pg, app, cmd/rider, openapi.json, Postman).
## Found
- Copied from core at `5335efc` (design Decision 1): `internal/auth/limit.go`, `password.go` and their tests (`limit_test.go`, `password_test.go`); `internal/pg` (pg.go and pg_test.go, rider tables). `TestStaffRoleMatchesStore` is dropped (no staff tables in rider).
- `TestEmbeddedMigrationsApplyOnce` did not exist in core or in rider task 1; written new in `internal/migrate/migrate_test.go` against the embedded `migrations.FS`.
- `x/crypto` v0.58.0 added to `services/rider/go.mod` in the test commit (the tests import bcrypt); it becomes direct once `internal/auth` imports it.
- Rider `internal/auth` in this task has no staff code: `New(pool, pepper, limit)` as the design's task 2 signature. `app.New(pool, origins, a)` takes the auth service; task 4 adds the admin routes and the core client.
## Red run
Command: `cd services/rider && go test -race ./internal/auth/ ./internal/pg/ ./internal/app/ ./internal/migrate/` (before any non-test code in `internal/auth`, `internal/pg`, `migrations/0002`, `internal/app`):
```
# internal/auth: no non-test Go files (auth_test.go, limit_test.go, password_test.go)
internal/pg/pg_test.go:56:6: undefined: IsUnique
internal/pg/pg_test.go:59:14: undefined: Map
internal/auth/auth_test.go:43:12: undefined: HashPassword
internal/auth/auth_test.go:79:21: undefined: Auth
internal/auth/auth_test.go:82:28: undefined: CurrentRider
internal/auth/auth_test.go:99:7: undefined: New
internal/auth/limit_test.go:18:7: undefined: NewLimiter
FAIL	.../internal/auth [build failed]
FAIL	.../internal/pg [build failed]
FAIL	.../internal/app [build failed]
--- FAIL: TestEmbeddedMigrationsApplyOnce (0.01s)
    migrate_test.go:218: applied [0001_init], want [0001_init 0002_riders]
FAIL	.../internal/migrate	0.351s
```
## Requests
- none
## Blockers
