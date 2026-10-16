# Tasks

Four worker tasks, in order, on branch `lane/core-P3-L3-hygiene` in `.worktrees/core-P3-L3`. Every change is a verbatim diff in `design.md` ("Code"); a choice neither file settles is a stop-and-report. Workers write their Doing line into `.claude/lanes/core-P3-L3.md` under a `Worker:` prefix.

Databases (D26): tests only, on the per-run schemas of `shopperstop_core_test`. No `core-admin migrate`, no `seed-demo`, no `make dev`/`make seed`/`make e2e`, no client on `shopperstop_core` or `shopperstop_core_e2e`, no `docker`.

Gates, from `services/core` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL=postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`: `gofmt -l .` empty, `go vet ./...`, `go test -race -count=1 ./...`. From the worktree root with `PATH=$HOME/.local/node-v22.23.3/bin:$PATH`: `make gen postman`, then `git status --short` clean after the last commit; `make test-web`; `openspec validate --all --strict`.

## 1. Migration runs do not interleave

Scope: `services/core/internal/migrate/` (`migrate.go`, `migrate_test.go`), `services/core/internal/testdb/testdb.go`, this file (ticks). Scenario: platform "Migration runs do not interleave" / Two runs at once; the existing migrate tests stay green. Starts from `internal/migrate/migrate_test.go` `TestApplyConcurrentRunsSerialise` (fails: SQLSTATE 23505 on `pg_type_typname_nsp_index`). Commits: `test: two migrate runs at once apply each file once`, `feat: migrate holds an advisory lock for the whole run`.

- [x] 1.1 Add `TestApplyConcurrentRunsSerialise` and its imports; run `go test -race -count=1 ./internal/migrate/` and see it fail; commit.
- [x] 1.2 Apply the `migrate.go` and `testdb.go` diffs; run the gates; tick 1.1 and 1.2; commit.

## 2. Expired sessions swept, limiter behind a trusted proxy

Scope: `services/core/queries/auth.sql`, `services/core/internal/auth/db/auth.sql.go` (sqlc output, regenerated only), `services/core/internal/auth/` (`auth.go`, `customer.go`, `limit.go`, `auth_test.go`), `services/core/internal/config/` (`config.go`, `config_test.go`), `services/core/cmd/core/main.go`, `services/core/internal/app/accounts_test.go`, this file (ticks). Scenarios: accounts "Expired sessions are deleted" / Sign-in sweeps expired sessions; "The rate limiter trusts a proxy only when told" (all three; Proxy not trusted is the existing `TestSignInRateLimitedPerIP`). Starts from `internal/auth/auth_test.go` `TestStartSessionSweepsExpired` (fails: expired session still stored), `internal/config/config_test.go` `TestLoadTrustProxy` and `internal/app/accounts_test.go` `TestSignInRateLimitedPerForwardedIP` (both fail to compile: no `TrustProxy`). Commits: `test: sign-in sweeps expired sessions; limiter keys on a trusted proxy's client`, `feat: sweep expired sessions on sign-in; SHOPPERSTOP_CORE_TRUST_PROXY`.

- [ ] 2.1 Apply the Task 2 test diffs; run the auth, config and app packages and see the three fail; commit.
- [ ] 2.2 Apply the `queries/auth.sql` diff, run `make gen` (sqlc writes `auth.sql.go`); apply the `auth.go`, `customer.go`, `limit.go`, `config.go` and `main.go` diffs; run the gates; tick 2.1 and 2.2; commit.

## 3. The delivered demo order names its rider

Scope: `services/core/internal/seed/` (`seed.go`, `seed_test.go`), this file (ticks). Scenario: orders "The delivered demo order names its rider" / Seeded rider; `TestSummaryMatchesSeed` and `TestDemoOrdersThroughTheRouter` stay green. Starts from `internal/seed/seed_test.go` `TestResetLoadsDemoOrders` (fails: "orders with a rider: 0, want 1"). Commits: `test: SS-DEMOAAAB is delivered by the demo rider`, `feat: seed the demo rider on SS-DEMOAAAB`.

- [ ] 3.1 Add the four `assertSQL` lines to `TestResetLoadsDemoOrders`; see it fail; commit.
- [ ] 3.2 Apply the `seed.go` diff; run the gates; tick 3.1 and 3.2; commit.

## 4. A wrong method answers 405

Scope: `services/core/internal/httpx/` (`router.go`, `router_test.go`), `services/core/internal/app/app_test.go`, `services/core/openapi.json`, generated `packages/ui/src/api/core.d.ts`, this file (ticks). Scenarios: platform "A wrong method on a known route answers 405" (all three); "Error envelope" / The contract lists every code; Unknown route stays green. Starts from `internal/httpx/router_test.go` `TestWrongMethodIs405` (fails: 404) and `internal/app/app_test.go` `TestWrongMethod` (fails: 404). Commits: `test: a wrong method answers 405 with Allow`, `feat: 405 method_not_allowed with Allow`.

`make test-web` fails on this task until ui has landed the `core.test.ts` change in design.md "Cross-area" on main and the branch is merged with main. If it fails only with TS2344 in `packages/ui/src/api/core.test.ts`, commit the core work anyway, write it in the lane log and report: that file is not core's.

- [ ] 4.1 Apply the Task 4 test diffs; see both fail; commit.
- [ ] 4.2 Apply the `router.go` diff; run the Task 4 `openapi.json` script; `make gen postman` (only `core.d.ts` changes); run the gates; tick 4.1 and 4.2; commit.
