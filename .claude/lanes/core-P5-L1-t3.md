# core-P5-L1-t3 - events feed and commit-ordered seq (task 3 of core-payments)
Status: done (3.1 test 7bfb011, 3.2 feat)
## Brief
- LANE-ID: core-P5-L1 (task 3 of 4). Area: core. Role: worker. Starts after task 2 is committed on the branch.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/core-P5-L1. Branch: lane/core-P5-L1-payments. Commit there as kapildev333 <47056817+kapildev333@users.noreply.github.com>, no trailers; never push; never touch the root checkout.
- OpenSpec change: `openspec/changes/core-payments/`, task 3 in `tasks.md`. Every code block is verbatim in `design.md` under "Task 3": save the block to a scratchpad file and split it with `git apply --include='*_test.go'` (test commit) then `git apply --exclude='*_test.go'` (feat commit). A choice neither file settles: stop and report.
- Scope paths: `services/core/queries/order.sql`, sqlc output (`services/core/internal/order/db/order.sql.go`; regenerated only), `services/core/internal/order/order.go`, `place.go`, `status.go`, `payment.go`, `events.go` (new), `services/core/internal/app/app.go`, `order_events_test.go` (new), `services/core/openapi.json` (Task 3 script only), generated `core.d.ts` and the Postman collection, `tasks.md` ticks 3.1 and 3.2, this file.
- Scenarios: orders "Services tail order events" (all three); "Event numbers follow commit order".
- Failing tests to start from: `internal/app/order_events_test.go` `TestEventFeedTailsPlacements`, `TestEventFeedValidation`, `TestEventFeedForServicesOnly` (red: 404) and `TestEventWritesWaitForTheEventsLock` (red: the status change answers 200 while the lock is held). Run `go test -race -count=1 -run 'EventFeed|EventWrites' ./internal/app`.
- Commits, in order: `test: events feed and commit-ordered seq`, then `feat: GET /admin/order-events under the events lock` (code, `make gen` output, the Task 3 script result, regenerated `core.d.ts` and Postman, ticks 3.1 and 3.2).
- Gates (all pass before the feat commit): from `services/core` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL=postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`: `gofmt -l .` empty, `go vet ./...`, `go test -race -count=1 ./...`. From the worktree root with `PATH=$HOME/.local/node-v22.23.3/bin:$PATH` (`node_modules` installed; `npm ci` if missing): `make gen postman`, then `git status --short` clean after the commit; `make test-web`; `openspec validate --all --strict`.
- Rules: tests only against the per-run schemas of `shopperstop_core_test`; no `docker`, no `make db`/`dev`/`seed`/`e2e`, no `core-admin migrate` or `seed-demo` against any database, and never run the archived Phase 3 `check-wiring.sh` (it starts a real rider on :8081 against the dev database). Run `openapi.json` scripts from a scratchpad file not named after a stdlib module; never commit them. Write your progress in this file only (not in `core-P5-L1.md`).
## Doing
- 3.1 committed 7bfb011 (four red: 404, 404, 404, status 200 under lock).
- 3.2 feat: make gen, Task 3 openapi script (additions only), make gen postman, gates green (go vet, go test -race ./... all ok; test-web 4 workspaces green; openspec validate 20 passed).
## Found
## Requests
## Blockers
