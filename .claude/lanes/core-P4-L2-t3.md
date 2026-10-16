# core-P4-L2-t3 - seed-demo guard (task 3 of core-accounts-security)
Status: ready (after task 2 is committed; touches none of its files)
## Brief
- LANE-ID: core-P4-L2 (task 3 of 3). Area: core. Role: worker.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/core-P4-L2. Branch: lane/core-P4-L2-accounts-security. Commit there as kapildev333 <47056817+kapildev333@users.noreply.github.com>, no trailers; never push; never touch the root checkout.
- OpenSpec change: `openspec/changes/core-accounts-security/`, task 3 in `tasks.md`. Every code block is verbatim in `design.md` under "Task 3": save the block to a scratchpad file and split it with `git apply --include='*_test.go'` (test commit) then `git apply --exclude='*_test.go'` (feat commit). A choice neither file settles: stop and report.
- Scope paths: `services/core/cmd/core-admin/main.go`, `services/core/cmd/core-admin/main_test.go`, `tasks.md` ticks 3.1 and 3.2, this file.
- Scenarios: platform "Seed-demo refuses a database on another machine" (all four); `TestSeedDemoExitCodes` stays green.
- Failing tests to start from: `cmd/core-admin/main_test.go` `TestLocalDatabase`, `TestSeedDemoRefusesRemoteDatabase`, `TestSeedDemoForceSkipsTheGuard`, `TestRunRefusesBadArguments` (red: does not compile, `localDatabase` undefined).
- Commits, in order: `test: seed-demo refuses a remote database`, then `feat: seed-demo guard with --force` (main.go, ticks 3.1 and 3.2). No `openapi.json` change; `make gen postman` must leave the tree clean.
- Gates (all pass before the feat commit): from `services/core` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL=postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`: `gofmt -l .` empty, `go vet ./...`, `go test -race -count=1 ./...`. From the worktree root with `PATH=$HOME/.local/node-v22.23.3/bin:$PATH` (`node_modules` installed; `npm ci` if missing): `make gen postman`, then `git status --short` clean after the commit; `make test-web`; `openspec validate --all --strict`.
- Rules: tests only against the per-run schemas of `shopperstop_core_test`; no `docker`, no `make db`/`dev`/`seed`/`e2e`, no `core-admin migrate` or `seed-demo` against any database. Run `openapi.json` scripts from a scratchpad file not named after a stdlib module; never commit them. Write your progress in this file only.
## Doing
## Found
## Requests
## Blockers
