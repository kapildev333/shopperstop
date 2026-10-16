# Tasks

Two worker tasks, in order (they touch disjoint code but both tick this file), on branch `lane/rider-P4-L1-hygiene` in `.worktrees/rider-P4-L1`. Every change is a verbatim diff in `design.md` ("Code"); a choice neither file settles is a stop-and-report. Workers write their Doing line into `.claude/lanes/rider-P4-L1.md` under a `Worker:` prefix.

Databases: tests only, on the per-package schemas of `shopperstop_rider_test`. No `rider-admin migrate` or `seed-demo` on any other database, no `make dev`/`make seed`/`make e2e`, no `docker`.

Gates, from the worktree root with `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`: `make test-rider` (gofmt, `go vet`, `go test -race`); `make gen postman`, then `git status --short` clean after the last commit; `openspec validate --all --strict`.

## 1. Concurrent runs serialise

Scope: `services/rider/internal/migrate/` (`migrate.go`, `migrate_test.go`), `services/rider/internal/testdb/testdb.go`, this file (ticks). Scenario: rider-service "Rider schema migrations" / Concurrent runs serialise; the existing migrate tests (Second run applies nothing, A failed file leaves no trace) stay green. Starts from `services/rider/internal/migrate/migrate_test.go` `TestApplyConcurrentRunsSerialise` (fails: SQLSTATE 23505 on `pg_type_typname_nsp_index`). Commits: `test: two rider migrate runs at once apply each file once`, `feat: rider migrate holds an advisory lock for the whole run`.

- [x] 1.1 Apply the "Task 1: migration lock, tests" diff; run `go test -race -count=1 -run TestApplyConcurrentRunsSerialise ./internal/migrate/` from `services/rider` with `SHOPPERSTOP_RIDER_TEST_DATABASE_URL` from the Makefile and see it fail; commit.
- [x] 1.2 Apply the "Task 1: migration lock, code" diff (`migrate.go`, `testdb.go`); run the gates; tick 1.1 and 1.2; commit.

## 2. A wrong method answers 405

Scope: `services/rider/internal/httpx/` (`router.go`, `router_test.go`), `services/rider/internal/app/app_test.go`, `services/rider/openapi.json`, generated `packages/ui/src/api/rider.d.ts`, this file (ticks). Scenarios: rider-service "Rider HTTP conventions match core" / Unknown route and wrong method, Preflight on a known path still answered; NUL byte refused and CORS only for configured origins stay green. Starts from `services/rider/internal/httpx/router_test.go` `TestWrongMethodIs405` (fails: `DELETE /x/1: status 404, want 405`) and `services/rider/internal/app/app_test.go` `TestUnknownRouteAndWrongMethod` (fails: `DELETE /api/rider/v1/healthz: got 404`). Commits: `test: a wrong rider method answers 405 with Allow`, `feat: rider 405 method_not_allowed with Allow`.

`make test-web` (the manager's gate) fails on this task until ui has landed the `api.test.ts` change in design.md "Cross-area" on main and the branch is merged with main. If it fails only with TS2344 in `packages/ui/src/api/api.test.ts`, commit the rider work anyway and write it in the lane log: that file is ui's.

- [ ] 2.1 Apply the "Task 2: 405 method_not_allowed, tests" diff; see both tests fail; commit.
- [ ] 2.2 Apply the "Task 2: 405 method_not_allowed, code" diff (`router.go`, the one-line `openapi.json` enum); `make gen postman` (only `rider.d.ts` changes, one line); run the gates; tick 2.1 and 2.2; commit with `rider.d.ts`.

## 3. Acceptance (team lead) and verification (manager)

- [ ] 3.1 Team lead: `/opsx:verify rider-hygiene`: every scenario in the delta has a passing test, tasks 1 and 2 ticked, nothing outside design.md "Files" landed.
- [ ] 3.2 Manager: re-run the gates on the merged head (with ui's `api.test.ts` fix on main, `make test-web` green); exercise the real rider service: `DELETE /api/rider/v1/healthz` answers 405 `Allow: GET`, and two `rider-admin migrate` runs started together against a throwaway database both exit 0.
