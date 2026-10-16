# rider-P4-L2-T2 - The sign-in limiter trusts a proxy only when told (task 2 of rider-hygiene-carryover)
Status: in progress (test commit made; code next)

## Brief
- LANE-ID: rider-P4-L2 (task T2). Area: `rider`.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P4-L2`. Branch: `lane/rider-P4-L2-hygiene-carryover`. Work and commit only there; never push. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no attribution or co-author trailers.
- Change: `openspec/changes/rider-hygiene-carryover/`, task 2 (`tasks.md` 2.1, 2.2). Read `design.md` Decisions 2 and 5 and "Code" first.
- Scenarios: rider-service "The rider sign-in limiter trusts a proxy only when told" / Clients behind a trusted proxy (`TestRiderSignInRateLimitedPerForwardedIP`), Empty forwarded address falls back to the connection (`TestRiderSignInEmptyForwardedForFallsBackToConnection`), Proxy not trusted (`TestRiderSignInRateLimitedPerIP`), Unknown value refused (`TestLoadTrustProxy`).
- Scope paths (nothing else): `services/rider/internal/config/config.go`, `services/rider/internal/config/config_test.go`, `services/rider/internal/auth/limit.go`, `services/rider/internal/auth/rider.go`, `services/rider/cmd/rider/main.go`, `services/rider/internal/app/riders_test.go`, `openspec/changes/rider-hygiene-carryover/tasks.md` (ticks 2.1, 2.2), this file.
- Failing tests to start from: `services/rider/internal/config/config_test.go` `TestLoadTrustProxy` and `services/rider/internal/app/riders_test.go` `TestRiderSignInRateLimitedPerForwardedIP` (from design.md "Task 2: trusted proxy, tests"). Expected red: compile errors `cfg.TrustProxy undefined` and `limit.TrustProxy undefined`. `TestRiderSignInRateLimitedPerIP` pins the existing default and passes once the package compiles. Tests run against the real `shopperstop_rider_test` database; no mocks.

## Steps and commits
1. `git apply` the "Task 2: trusted proxy, tests" diff. From `services/rider`: `go vet ./internal/config/ ./internal/app/` and see both undefined-field errors. Paste them below. Commit `test: rider sign-in limiter trusts a proxy only when told` (config_test.go, riders_test.go, this file).
2. `git apply` the "Task 2: trusted proxy, code" diff. From `services/rider`: `SHOPPERSTOP_RIDER_TEST_DATABASE_URL='postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable' go test -race -count=1 -run 'TestLoadTrustProxy|TestRiderSignInRateLimited|TestRiderSignInEmptyForwardedFor' ./internal/config/ ./internal/app/` (green). Check parity: `diff services/core/internal/auth/limit.go services/rider/internal/auth/limit.go` prints nothing.
3. Gates, from the worktree root with `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`: `GOFLAGS=-count=1 make test-rider` (exit 0); `make gen postman` then `git status --short` shows only your files; `openspec validate --all --strict` (all pass). Tick 2.1 and 2.2 in tasks.md. Commit `feat: SHOPPERSTOP_RIDER_TRUST_PROXY keys the rider limiter on X-Forwarded-For` (config.go, limit.go, rider.go, main.go, tasks.md, this file).

Stop and report here (under Blockers) on anything design.md does not settle; do not improvise. Do not touch `apps/`, `packages/`, other services, the Makefile or the lane log `rider-P4-L2.md`.

## Doing
- Applied "Task 2: trusted proxy, tests" (riders_test.go, config_test.go); red confirmed.

## Red run
```
go vet ./internal/config/ ./internal/app/ (services/rider)
vet: internal/config/config_test.go:110:24: cfg.TrustProxy undefined (type config.Config has no field or method TrustProxy)
vet: internal/app/riders_test.go:309:8: limit.TrustProxy undefined (type *auth.Limiter has no field or method TrustProxy)
```
## Green run
## Gates
## Found
## Blockers
