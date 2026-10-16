Every task runs in the worktree `.worktrees/rider-P3-L1` on branch `lane/rider-P3-L1-service-foundation`. Order: task 1 first; tasks 2 and 3 may then run in parallel (disjoint paths; task 3 never touches `go.mod`, `go.sum`, `openapi.json` or `internal/app`), otherwise in order; task 4 after 2 and 3; task 5 after 4. Each worker keeps its log in `.claude/lanes/rider-P3-L1-T<n>.md`, ticks its own boxes here, and never runs `make db`, `make dev`, `make prod-local` or `make seed` (only `make -n`). Node for `make gen` and `make postman`: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`, and `npm ci` once at the worktree root if `node_modules` is absent.

Gates for every task, from the worktree root: `make test-rider` (gofmt, vet, race); `openspec validate --all --strict` (read the totals line). Tasks 1, 2 and 4 also: `make gen` and `make postman`, then `git status --short` shows nothing uncommitted. Copies from core follow design.md Decision 1 (origin `5335efc`).

## 1. Module skeleton, plumbing, health and contract (worker)

Scope: `services/rider/` (`go.mod`, `go.sum`, `cmd/rider`, `cmd/rider-admin`, `internal/config`, `internal/httpx`, `internal/migrate`, `internal/testdb`, `internal/app`, `migrations/0001_init.sql`, `migrations/migrations.go`, `openapi.json`), `docs/postman/shopperstop-rider.postman_collection.json` (generated only).
Scenarios: "Rider service configuration fails fast" (all three), "Rider health and readiness" (both), "Rider HTTP conventions match core" ("Unknown route and wrong method", "CORS only for configured origins", NUL refusal at the `httpx` level), "Rider request log and request id" ("Request id echoed or generated"), "Rider schema migrations" ("A failed file leaves no trace"), "Rider API contract" (both).
Starts from: `services/rider/internal/config/config_test.go` `TestLoadNamesEveryMissingVariable`, `TestLoadRefusesShortPepperAndBadCoreURL`, `TestLoadFullEnvironment`; `services/rider/internal/app/app_test.go` `TestHealthz`, `TestReadyzWhenDatabaseAnswers`, `TestReadyzWhenDatabaseIsDown`, `TestUnknownRouteAndWrongMethod`; `services/rider/internal/app/contract_test.go` `TestContract`, `TestContractSecurity` and the toy tests; plus the copied tests of `httpx` (`TestReadJSONRejectsNUL`, `TestCORSAllowsConfiguredOrigin`, `TestCORSRejectsUnknownOrigin`, `TestRequestIDEchoed`, ...), `migrate` (`TestApplyRollsBackFailedMigration`, ...) and `cmd/rider` (`TestServeDrainsInFlightRequest`), `cmd/rider-admin` `TestRunRefusesBadArguments`.
Commits: `test: rider config, health, http plumbing and contract`, then `feat: rider service skeleton with health, migrations and contract`.

- [x] 1.1 Write the tests above (copies per Decision 1; config tests new); `go test ./...` in `services/rider` fails (build failure is the red); paste the first failing lines into the log; commit `test: ...`
- [ ] 1.2 `go.mod` (module `github.com/kapildev333/shopperstop/services/rider`, `go 1.27`, chi and pgx at core's versions), the copied packages, `internal/config` per design.md Interfaces, `migrations/0001_init.sql` per design.md, `internal/app` with `New(pool, origins)` serving healthz and readyz, `cmd/rider` (no core client or auth yet), `cmd/rider-admin migrate` with the usage `usage: rider-admin migrate`
- [ ] 1.3 `openapi.json`: `openapi` 3.1.0, `info` (title `ShopperStop rider API`, version `0.3.0`, a description naming the envelope and bearer tokens), `servers` `/api/rider/v1`, tag `platform`, `components.securitySchemes.bearer`, schemas `Status` and `Error`, the two health operations with examples on every response
- [ ] 1.4 `make postman` writes `docs/postman/shopperstop-rider.postman_collection.json`; `make gen` prints the rider sqlc skip line and leaves the tree clean
- [ ] 1.5 Gates green; paste `make test-rider` package lines and the validate totals; commit `feat: ...` (including the collection)

## 2. Riders, sessions, sign-in, sign-out and me (worker, after 1)

Scope: `services/rider/` (`go.mod`, `go.sum`, `migrations/0002_riders.sql`, `sqlc.yaml`, `queries/auth.sql`, `internal/auth` and `internal/auth/db`, `internal/app`, `internal/pg` (copied here, design.md Decision 1), `internal/migrate` test, `cmd/rider`, `openapi.json`), the generated Postman collection.
Scenarios: "Rider schema migrations" ("Second run applies nothing", "updated_at follows updates"), "Riders sign in with email and password" (both), "Rider bearer sessions" (all three; the core-staff-token case uses any token the rider database does not know), "Riders sign out and read themselves", "Rider sign-in is rate limited" (both), "Rider request log and request id" ("Route pattern and subject in the log"), "Rider HTTP conventions match core" ("NUL byte refused" on the sign-in route).
Starts from: `services/rider/internal/app/riders_test.go` `TestRiderSignIn`, `TestRiderSignInRefusalsLookTheSame`, `TestRiderSignInRefusesNUL`, `TestRiderBearerRefusals`, `TestRiderSignOutEndsOnlyThatSession`, `TestRiderSignInRateLimited`, `TestRiderRequestLogNamesSubject`; `services/rider/internal/auth/auth_test.go` `TestTokenStoredAsPepperedHash`, `TestRiderSessionExpired`, `TestRiderSessionSlides`, `TestRiderSessionWithinHourUnchanged`; copied `limit_test.go` and `password_test.go`; `services/rider/internal/migrate/migrate_test.go` `TestEmbeddedMigrationsApplyOnce`; `services/rider/internal/pg/pg_test.go` `TestMapUniqueIsConflict`, `TestMapForeignKeyIsConflict`, `TestMapNoRowsIsNotFound`, `TestMapPassesOtherErrors`, `TestUpdatedAtTrigger` (copies on rider tables).
Commits: `test: rider sign-in, sessions, sign-out and me`, then `feat: rider accounts with peppered sliding sessions`.

- [ ] 2.1 Write the tests; red run pasted into the log; commit `test: ...`
- [ ] 2.2 `0002_riders.sql`, `sqlc.yaml` and `queries/auth.sql` per design.md Data model; `make gen` writes `internal/auth/db`
- [ ] 2.3 `internal/auth`: `New(pool, pepper, limit)`, tokens and hashing as core's `auth.go`, `RequireRider` (subject `rider`), `CurrentRider`, `SignIn` (limiter first, dummy hash, inactive is the same 401), `SignOut`, `Me`; limiter and password copied; `golang.org/x/crypto` at core's version
- [ ] 2.4 `app.New(pool, origins, a)` with the three routes; `cmd/rider` builds the limiter `NewLimiter(10, 100, time.Hour, time.Now)`; `openapi.json` gains tag `rider-service`, schemas `Rider`, `RiderSession`, `SignInRequest`, the three operations (sign-out and me with `security` and 401; sign-in with 400, 401, 429 examples; the 200 example has a string `token`)
- [ ] 2.5 Gates green, `make gen postman` clean after the commit; commit `feat: ...`

## 3. Core client and fake (worker, after 1; parallel with 2)

Scope: `services/rider/internal/core/`, `services/rider/internal/coretest/` only.
Scenarios: "Staff authenticate through core" ("Core failure is 502" and "One core call per token within 30 seconds" at the client level; the route-level half is task 4), the store check of "Staff create riders" at the client level (known store, core 404).
Starts from: `services/rider/internal/core/core_test.go` (package `core_test`, against `coretest.New()`) `TestStaffFromTokenForwardsBearer`, `TestStaffFromTokenUnauthorized`, `TestStaffFromTokenCoreFailure` (fake `Fail(500)` and a closed fake both give a 502 `*httpx.Error` with code `internal`, and one `core call failed` log line carrying `requestId`), `TestStaffFromTokenCached` (fake clock: three calls within 30 s and one at 31 s give `Calls("GET /api/core/v1/admin/me") == 2`; a 401 is not cached), `TestStore`, `TestStoreNotFound`.
Commits: `test: core client staff introspection and store read`, then `feat: core client and httptest fake`.

- [ ] 3.1 Write the tests; red run pasted into the log; commit `test: ...`
- [ ] 3.2 `internal/core` and `internal/coretest` exactly per design.md Interfaces (types, `New(baseURL, serviceToken, now)`, `do`, cache with the `ponytail:` pruning comment); the fake's 401, 404 and 500 bodies are core's envelope; stdlib only
- [ ] 3.3 Gates green; commit `feat: ...`

## 4. Staff routes through core (worker, after 2 and 3)

Scope: `services/rider/` (`internal/auth`, `queries/auth.sql`, `internal/auth/db`, `internal/app`, `cmd/rider`, `openapi.json`), the generated Postman collection.
Scenarios: "Staff authenticate through core" ("Staff admitted, others refused", "Core failure is 502" at the route), "Staff list riders" (both, plus `store=abc` 400), "Staff create riders" (all three), "Staff read and update a rider" (all three).
Starts from: `services/rider/internal/app/admin_riders_test.go` `TestStaffAdmittedThroughCore`, `TestStaffRouteCoreFailureIs502`, `TestAdminListsAndFiltersRiders`, `TestStoreStaffListsOwnStore`, `TestListRidersRefusesBadStore`, `TestAdminCreatesRider`, `TestCreateRiderRefusalsNameTheField`, `TestStoreStaffCreatesOnlyForOwnStore`, `TestRiderOfAnotherStoreNotFound`, `TestDeactivationEndsSessions`, `TestPatchResetsPassword`, `TestPatchRefusesNull`.
Commits: `test: staff manage riders through core`, then `feat: admin rider routes with core staff introspection`.

- [ ] 4.1 Write the tests (a `coretest.Fake` in `TestMain` with stores A and B, an admin token and a store-staff token per store); red run pasted; commit `test: ...`
- [ ] 4.2 `auth.New` gains `c *core.Client` (callers updated); `RequireStaff` (401 without a bearer before any core call; subject `staff`), `CurrentStaff`; `CreateRider` per design.md Decision 9 with core's field checks; `ListRiders`, `AdminCreateRider`, `AdminGetRider`, `AdminUpdateRider` per Decisions 7 and 10; the queries of design.md; `cmd/rider` builds `core.New(cfg.CoreURL, cfg.CoreServiceToken, time.Now)`
- [ ] 4.3 `openapi.json`: schemas `RiderCreate`, `RiderPatch`, `RiderList`; the four operations with `security`, 401 and every other code they answer (400, 403, 404, 409, 502) with examples; `page`, `pageSize`, `store` parameters
- [ ] 4.4 Gates green, `make gen postman` clean after the commit; commit `feat: ...`

## 5. Operator commands and demo seed (worker, after 4)

Scope: `services/rider/internal/seed/`, `services/rider/cmd/rider-admin/`.
Scenarios: "Operators create riders from the command line" (both), "Rider demo seed" (all three; "Seed needs no core" is shown by the seed tests running with no client or fake in the package, and `internal/seed` importing neither `internal/core` nor `internal/coretest`).
Starts from: `services/rider/internal/seed/seed_test.go` `TestResetTwiceLeavesDemoRiders`, `TestLoadTwiceFails`, `TestSummaryMatchesSeed` (signs each printed rider in through `app.New` with a `core.New("http://127.0.0.1:1", "unused", time.Now)` client, checks every printed id, and the Postman `riderId`); `services/rider/cmd/rider-admin/main_test.go` `TestCreateRider`, `TestCreateRiderUnknownStore`, `TestCreateRiderRefusesEmptyPassword`, `TestRunRefusesBadArguments` (now with `create-rider a@b.c`, `create-rider a@b.c --shop x`).
Commits: `test: rider demo seed and create-rider`, then `feat: rider-admin seed-demo and create-rider`.

- [ ] 5.1 Write the tests; red run pasted; commit `test: ...`
- [ ] 5.2 `internal/seed` per design.md (Reset, Load, Summary, names, phones, stores); `cmd/rider-admin` `seed-demo [--reset]` (prints `seed.Summary`) and `create-rider <email> --store <id>` per design.md Interfaces, full usage line
- [ ] 5.3 Gates green; commit `feat: ...`

## 6. Manager verification (area manager, not a worker)

- [ ] 6.1 Re-run on the branch: `make test-rider`, `make test-core`, `make gen` and `make postman` (tree clean), `openspec validate --all --strict`
- [ ] 6.2 Runtime: with `RIDER_ENV` from the Makefile, `go run ./cmd/rider-admin migrate` twice (second prints `nothing to apply`) and `seed-demo --reset` against `shopperstop_rider` with core stopped; then with core and rider running, sign in `rider1-koramangala@shopperstop.local` / `rider12345` and read `/me`; sign in `koramangala@shopperstop.local` at core and read `/api/rider/v1/admin/riders` through rider (two riders) and `?store=...0402` (403); stop core and see 502 after the 30 s cache; paste the outputs into the lane status
- [ ] 6.3 Team lead's `/opsx:verify`: every scenario maps to a passing test, every task ticked, nothing outside the scope landed
