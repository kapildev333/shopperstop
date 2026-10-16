# rider-P3-L1-T2 - riders, sessions, sign-in, sign-out and me (OpenSpec change rider-service-foundation, tasks 2.1 to 2.5)
Status: done (awaiting reviewer)
## Doing
Tasks 2.1 to 2.5 landed: `50be836 test: rider sign-in, sessions, sign-out and me` (red), then the feat commit (0002_riders, sqlc, internal/auth, internal/pg, app routes, cmd/rider, openapi.json, Postman). Gates green. Awaiting reviewer.
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
## Gate evidence
- `make test-rider` (gofmt, vet, `go test -race ./...`): every package `ok` or `no test files`, including T3's `internal/core` (package passing at the time of the run). `internal/app`, `internal/auth`, `internal/pg`, `internal/migrate` also ran with `-count=1 -v` and passed, all named tests among them.
- `make gen`: sqlc writes `internal/auth/db`; core's `core.d.ts` unchanged. `make postman`: `node --test scripts/postman.test.mjs` 17 pass, 0 fail; `shopperstop-rider.postman_collection.json` +506 lines, core's collection unchanged.
- `openspec validate --all --strict`: `Totals: 15 passed, 0 failed (15 items)`.
- `go mod tidy` (offline): `golang.org/x/crypto v0.58.0` moved to the direct requires; nothing else changed.
## Requests
- none
## Blockers
