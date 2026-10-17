# rider-P5-L2-T5 - the offer seed (task 5 of rider-dispatch)
Status: done (feat `1ff1c18`; collection blocker resolved by manager decision)

## Brief
- LANE-ID: rider-P5-L2 (task T5). Area: `rider`.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L2`. Branch: `lane/rider-P5-L2-dispatch`. Work and commit only there; never push. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no attribution or co-author trailers. Commit with a pathspec, never amend. Never run docker, `make db`, `make dev`, `make seed`, `make e2e`, or touch containers.
- Change: `openspec/changes/rider-dispatch/`, task 5 (`tasks.md` section 5). Read `design.md` Decisions 13, 15. Every hand-written change is a patch in `openspec/changes/rider-dispatch/code/`; you apply it, you do not write it.
- Scenarios: dispatch "Offer demo seed"; rider-service "Rider demo seed" stays green.
- Scope paths (nothing else): `services/rider/internal/seed/{seed,summary}.go`, test `services/rider/internal/seed/seed_test.go`; `openspec/changes/rider-dispatch/tasks.md` (ticks 5.1, 5.2); this file.
- Failing tests to start from: `services/rider/internal/seed/seed_test.go` `TestSeededOffer`, `TestSummaryMatchesSeed` (6 ids; `riderId`, `deliveryId` and `offerId` tied to the Postman environment).
- Precondition: the lane branch has merged origin/main at or after 503a2a8 (platform-P5-L2 #365); `grep offerId docs/postman/local.postman_environment.json` finds `00000000-0000-4000-8000-000000000902`. If not, stop and report.
- Expected red: `go vet` clean; FAIL lines: `TestSeededOffer`, `TestSummaryMatchesSeed`.

## Steps and commits
0. Setup, from the worktree root: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `test -d node_modules || npm ci`. `git status --short` must be empty and `git log -1` must show task 4 done (tasks.md boxes ticked).
1. `git apply openspec/changes/rider-dispatch/code/T5-test.diff`; red check. Commit `test: seed holds an expired demo offer`.
2. `git apply openspec/changes/rider-dispatch/code/T5-feat.diff`; gates (`make gen postman` changes nothing); tick 5.1 and 5.2. Commit `feat: seed an expired offer for the delivered demo order`.

Gates (every `feat:` commit), from the worktree root: `GOFLAGS=-count=1 make test-rider` (every package `ok`); `make gen postman`, then `git status --short` lists only scope files, and after the commit it is empty; `openspec validate --all --strict` (Totals `0 failed`). Paste each result under Gates.

Red check, from `services/rider`: `go vet ./...` and `SHOPPERSTOP_RIDER_TEST_DATABASE_URL='postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable' go test -count=1 ./internal/... 2>&1 | grep -E '^--- FAIL' | sort -u`. Paste it under Red run.

If a patch does not apply, the red differs from the expected red, a generated file outside the scope changes or a gate fails, stop and write it under Blockers; do not improvise. Never edit `apps/`, other services, `packages/ui` by hand, `docs/postman` by hand, or the lane log `rider-P5-L2.md`.

## Red run
test commit `f09c470` (`test: seed holds an expired demo offer`). Before the feat: `go vet ./...` clean. FAIL lines:
```
--- FAIL: TestSeededOffer (0.02s)
--- FAIL: TestSummaryMatchesSeed (0.97s)
```
Reasons: `seed_test.go:254: summary holds 4 sign-ins and 5 ids, want 4 and 6`; `seed_test.go:298: seeded expired offer rows: 0, want 1`. Both as stated.

## Green run

## Gates
Step 2 applied `T5-feat.diff` (uncommitted): `go vet ./...` clean; `GOFLAGS=-count=1 make test-rider` exit 0, every package `ok` (seed `ok` 31.3s, dispatch `ok`, app `ok`).
`make gen postman` exit 0, but it also rewrites `docs/postman/shopperstop-rider.postman_collection.json` (out of scope, see Blockers). `openspec validate --all --strict`: `Totals: 20 passed, 0 failed (20 items)`.

## Found
- `make gen postman` on the feat tree changes the rider collection: 6 offer request variables move from the literal `00000000-0000-4000-8000-000000000902` to `{{offerId}}` (the `ID_VARS` generator change from platform-P5-L2 503a2a8). The branch's committed collection was generated before that change, so it is stale; origin/main has no offer routes, so the drift is the lane's own T2 routes. The brief expects `make gen postman` to change nothing, and the stop rule names generated files outside scope. No tasks ticked.

## Blockers
1. RESOLVED by manager decision: the collection is in scope (D23); committed in `1ff1c18` with the note "collection picks up platform's offerId variable"; tasks 5.1 and 5.2 ticked in the same commit. Original stop: `make gen postman` modifies `docs/postman/shopperstop-rider.postman_collection.json` (out of the listed scope). Left uncommitted in the worktree with the feat patch applied, for the manager's decision: commit the regenerated collection in the feat commit (it is the lane's own generated artifact and CI diffs it), or re-run it on a later step. Tasks 5.1 and 5.2 remain unticked.
2. Resolved: feat committed, T6 started.

## Commits
- `f09c470` test: seed holds an expired demo offer
- `1ff1c18` feat: seed an expired offer for the delivered demo order (collection regenerated, tasks 5.1 and 5.2 ticked)
