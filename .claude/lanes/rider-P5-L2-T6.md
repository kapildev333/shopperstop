# rider-P5-L2-T6 - store location and ETA ranking (task 6 of rider-dispatch)
Status: not started

## Brief
- LANE-ID: rider-P5-L2 (task T6). Area: `rider`.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L2`. Branch: `lane/rider-P5-L2-dispatch`. Work and commit only there; never push. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no attribution or co-author trailers. Commit with a pathspec, never amend. Never run docker, `make db`, `make dev`, `make seed`, `make e2e`, or touch containers.
- Change: `openspec/changes/rider-dispatch/`, task 6 (`tasks.md` section 6). Read `design.md` Decisions 6, 7, 11. Every hand-written change is a patch in `openspec/changes/rider-dispatch/code/`; you apply it, you do not write it.
- Scenarios: dispatch "Candidates rank by ETA to the store" (all four), "Staff read an order's dispatch" / Dispatch off (the no-location half), plus the review items folded in: R3 (candidates before core's ready list, `ponytail:` comments on the lock held across core calls and the 100-order page, `Run` passes `time.Now()`) and R4 (the staff read's error answers pinned). All of them are in the two patches; design.md Decisions 7 and 9 and Ceilings.
- Scope paths (nothing else): `services/rider/internal/core/core.go`, `services/rider/internal/dispatch/{dispatch,admin}.go`, `services/rider/internal/dispatch/eta.go` (new), tests `services/rider/internal/dispatch/dispatch_test.go`, `services/rider/internal/app/dispatch_test.go`; `openspec/changes/rider-dispatch/tasks.md` (ticks 6.1, 6.2); this file.
- Failing tests to start from: `services/rider/internal/dispatch/dispatch_test.go` `TestETA`, `TestTickNearerRiderFirst`, `TestTickSameMinuteLongerIdle`, `TestTickIdleCountsFromLastDelivery`, `TestTickWithin100mIsZero`, `TestTickStoreWithoutLocation`, `TestTickNoCandidateNoCoreCall` (R3: a store with no eligible rider costs no core call); `services/rider/internal/app/dispatch_test.go` `TestOrderDispatchOffWithoutLocation` (must land: promised to admin-P5-L2), `TestOrderDispatchRefusals` (R4: pins the 401, 401, 404 and 502 answers that exist since T4; it passes once the package compiles, which is expected, so say so in the log).
- Expected red: `go vet` prints `undefined: core.StoreLocation` in `internal/dispatch/dispatch_test.go` and `internal/app/dispatch_test.go`.
- Precondition: core-P5-L2 is on main (#360, `Store.location {lat, lng}` on `GET /stores/{id}`, omitted when unset) and the lane branch has merged `origin/main` (`git log --oneline | grep -i 'core-P5-L2\|#360'` shows it). If not, stop and report.

## Steps and commits
0. Setup, from the worktree root: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `test -d node_modules || npm ci`. `git status --short` must be empty and `git log -1` must show task 5 done (tasks.md boxes ticked).
1. `git apply openspec/changes/rider-dispatch/code/T6-test.diff`; red check. Commit `test: candidates rank by ETA to the store; no location, no dispatch`.
2. `git apply openspec/changes/rider-dispatch/code/T6-feat.diff`; gates (`make gen postman` changes nothing); tick 6.1 and 6.2. Commit `feat: store location from core and ETA ranking`.

Gates (every `feat:` commit), from the worktree root: `GOFLAGS=-count=1 make test-rider` (every package `ok`); `make gen postman`, then `git status --short` lists only scope files, and after the commit it is empty; `openspec validate --all --strict` (Totals `0 failed`). Paste each result under Gates.

Red check, from `services/rider`: `go vet ./...` and `SHOPPERSTOP_RIDER_TEST_DATABASE_URL='postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable' go test -count=1 ./internal/... 2>&1 | grep -E '^--- FAIL' | sort -u`. Paste it under Red run.

If a patch does not apply, the red differs from the expected red, a generated file outside the scope changes or a gate fails, stop and write it under Blockers; do not improvise. Never edit `apps/`, other services, `packages/ui` by hand, `docs/postman` by hand, or the lane log `rider-P5-L2.md`.

## Red run

## Green run

## Gates

## Found

## Blockers
None yet.
