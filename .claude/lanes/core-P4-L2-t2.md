# core-P4-L2-t2 - password reset (task 2 of core-accounts-security)
Status: ready (after task 1 is committed)
## Brief
- LANE-ID: core-P4-L2 (task 2 of 3). Area: core. Role: worker.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/core-P4-L2. Branch: lane/core-P4-L2-accounts-security. Commit there as kapildev333 <47056817+kapildev333@users.noreply.github.com>, no trailers; never push; never touch the root checkout.
- OpenSpec change: `openspec/changes/core-accounts-security/`, task 2 in `tasks.md`. Every code block is verbatim in `design.md` under "Task 2": save the block to a scratchpad file and split it with `git apply --include='*_test.go'` (test commit) then `git apply --exclude='*_test.go'` (feat commit). A choice neither file settles: stop and report.
- Scope paths: `services/core/queries/auth.sql`, `services/core/internal/auth/db/auth.sql.go` (regenerated only), `services/core/internal/auth/account.go`, `services/core/internal/app/app.go`, `services/core/internal/app/password_reset_test.go` (new), `services/core/openapi.json` (Task 2 script only), generated `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json`, `tasks.md` ticks 2.1 and 2.2, this file.
- Scenarios: accounts "Customers reset a forgotten password" (all five); "Sign-in and registration are rate limited" / Eleventh reset request for one email.
- Failing tests to start from: `internal/app/password_reset_test.go` `TestPasswordReset`, `TestPasswordResetUnknownEmail`, `TestPasswordResetBadInput`, `TestPasswordResetTokenExpires`, `TestPasswordResetRateLimited` (red: 404 on both routes).
- Commits, in order: `test: password reset`, then `feat: password reset ends every session` (queries, `make gen` output, `account.go`, `app.go`, the Task 2 `openapi.json` script result, regenerated `core.d.ts` and Postman, ticks 2.1 and 2.2).
- Expected: `make test-web` as in task 1 (only the mobile TS2741 lines, until the mobile fix is merged here).
- Gates (all pass before the feat commit): from `services/core` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL=postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`: `gofmt -l .` empty, `go vet ./...`, `go test -race -count=1 ./...`. From the worktree root with `PATH=$HOME/.local/node-v22.23.3/bin:$PATH` (`node_modules` installed; `npm ci` if missing): `make gen postman`, then `git status --short` clean after the commit; `make test-web`; `openspec validate --all --strict`.
- Rules: tests only against the per-run schemas of `shopperstop_core_test`; no `docker`, no `make db`/`dev`/`seed`/`e2e`, no `core-admin migrate` or `seed-demo` against any database. Run `openapi.json` scripts from a scratchpad file not named after a stdlib module; never commit them. Write your progress in this file only.
## Doing
- 93ccabe test: password reset (five tests red: 404 on both routes).
- feat commit: queries, make gen, account.go, app.go, openapi script (TestContract green), core.d.ts and Postman regenerated (only the two new routes added), ticks 2.1 and 2.2.
- Gates: gofmt empty; go vet clean; go test -race -count=1 ./... all ok; make gen postman (22 pass); make test-web exit 0; openspec validate --all --strict 20 passed.
## Found
## Requests
## Blockers
