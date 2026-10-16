# core-P5-L1-t4 - demo order paid online (task 4 of core-payments)
Status: ready
## Brief
- LANE-ID: core-P5-L1 (task 4 of 4). Area: core. Role: worker. Starts after task 3 is committed on the branch.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/core-P5-L1. Branch: lane/core-P5-L1-payments. Commit there as kapildev333 <47056817+kapildev333@users.noreply.github.com>, no trailers; never push; never touch the root checkout.
- OpenSpec change: `openspec/changes/core-payments/`, task 4 in `tasks.md`. Every code block is verbatim in `design.md` under "Task 4": save the block to a scratchpad file and split it with `git apply --include='*_test.go'` (test commit) then `git apply --exclude='*_test.go'` (feat commit). A choice neither file settles: stop and report.
- Scope paths: `services/core/internal/seed/seed.go`, `seed_test.go`, `summary.go`, `tasks.md` ticks 4.1 and 4.2, this file. No `openapi.json` change.
- Scenarios: orders "The demo order paid online"; "Demo orders" (both).
- Failing tests to start from: `internal/seed/seed_test.go` `TestResetLoadsDemoOrders` (red: 3 orders, want 4), `TestDemoOrdersThroughTheRouter` (red: total 3), `TestSummaryMatchesSeed` (red: 12 ids, want 13). Run `go test -race -count=1 ./internal/seed`.
- Commits, in order: `test: demo order SS-DEMOAAAE paid online`, then `feat: seed SS-DEMOAAAE paid online` (code, ticks 4.1 and 4.2).
- Note: Postman keeps `orderId` `...0703`; `docs/postman/local.postman_environment.json` does not change (`TestSummaryMatchesSeed` checks it).
- Gates (all pass before the feat commit): from `services/core` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL=postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`: `gofmt -l .` empty, `go vet ./...`, `go test -race -count=1 ./...`. From the worktree root with `PATH=$HOME/.local/node-v22.23.3/bin:$PATH` (`node_modules` installed; `npm ci` if missing): `make gen postman`, then `git status --short` clean after the commit; `make test-web`; `openspec validate --all --strict`.
- Rules: tests only against the per-run schemas of `shopperstop_core_test`; no `docker`, no `make db`/`dev`/`seed`/`e2e`, no `core-admin migrate` or `seed-demo` against any database, and never run the archived Phase 3 `check-wiring.sh` (it starts a real rider on :8081 against the dev database). Run `openapi.json` scripts from a scratchpad file not named after a stdlib module; never commit them. Write your progress in this file only (not in `core-P5-L1.md`).
## Doing
## Found
## Requests
## Blockers
