# Tasks

One worker task on branch `lane/core-P2-L7-last-admin` in `.worktrees/core-P2-L7`. Every code block is verbatim in `design.md`; a choice neither file settles is a stop-and-report.

Databases (D26): tests only, on the per-run schema of `shopperstop_core_test`. No `core-admin migrate`, no `seed-demo`, no `make dev`/`make seed`/`make e2e`, no client on `shopperstop_core` or `shopperstop_core_e2e`, no `docker`.

Gates, from the worktree root: `GOFLAGS=-count=1 make test-core` exit 0; `PATH=$HOME/.local/node-v22.23.3/bin:$PATH make gen postman`, then `git status --short` clean after the last commit; `PATH=$HOME/.local/node-v22.23.3/bin:$PATH openspec validate --all --strict` passes.

## 1. Refuse deactivating the last active admin

Scope: `services/core/queries/auth.sql`, `services/core/internal/auth/db/auth.sql.go` (regenerated only), `services/core/internal/auth/staff.go`, `services/core/internal/app/staff_test.go`, `services/core/openapi.json`, generated `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json`, this file (ticks). Scenarios: all four new scenarios of `admin-staff` "Admins manage staff users". Starts from `internal/app/staff_test.go` `TestDeactivateLastActiveAdmin` (fails with 200) and `TestAdminsDeactivateEachOtherAtOnce`. Commits: `test: the last active admin cannot be deactivated`, then `feat: refuse deactivating the last active admin`.

- [ ] 1.1 Add `onlyActiveAdmins`, `activeAdmins` and the four tests of design.md "Tests" to `internal/app/staff_test.go`. Run `go test -count=1 -run 'LastActiveAdmin|OneOfTwoAdmins|EachOtherAtOnce|DeactivatesStaffAndInactive' ./internal/app` from `services/core`: `TestDeactivateLastActiveAdmin` fails with 200; the others as the table's "At red" column. Commit.
- [ ] 1.2 Add `LockActiveAdmins` to `queries/auth.sql`, `errLastAdmin` and the transaction in `UpdateStaffUser` (design Decision 1 to 3), the two `openapi.json` edits; run `make gen postman` and commit what it writes. Run the gates, tick 1.1 and 1.2, commit.
