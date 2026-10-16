# rider-P3-L1 - rider service foundation (OpenSpec change rider-service-foundation)
Status: done (acceptance pass on cbac655; task 6 is the manager's)
## Doing
Team lead: /opsx:verify re-run on cbac655 after 4b: pass. Uncached `go test -race -count=1 ./...` 10 packages ok; `TestCreateRiderChecksFieldsBeforeCore` passes (400 on `email`, no store call); request schemas without `additionalProperties`, response schemas keep it; `make gen` and `make postman` (17 pass) clean; strict 15 passed; tasks 1 to 5 and 4b ticked; 4b diff only in its scope.
## Found
- Change `openspec/changes/rider-service-foundation/`: proposal, `specs/rider-service/spec.md` (16 ADDED requirements, all under 500 characters, each with WHEN/THEN scenarios), design.md (14 decisions, data model, interfaces, test strategy; no `docs/design/rider-P3-L1.md` needed), tasks.md (5 worker tasks, 1 manager task).
- Copies from core are from `services/core` at `5335efcec70b770ffca2b13b62fca855ce5aaa0b` (design Decision 1). `internal/pg` lands with task 2 because its tests need tables.
- Order: 1, then 2 and 3 in parallel (task 3 touches only `internal/core`, `internal/coretest`), then 4, then 5.
- The first task writes `docs/postman/shopperstop-rider.postman_collection.json` (platform's request); tasks 2 and 4 regenerate it. No `packages/ui/src/api/rider.d.ts` in this lane.
- For rider-P3-L2: core's demo delivered order is `00000000-0000-4000-8000-000000000701` (`SS-DEMOAAAB`); `...0703` is the placed one (core `internal/seed/summary.go`). The work package's "`...0703`, confirm" should read `...0701`.
- For rider-P3-L2: the core client grows by `StoreOrders`, `Order`, `ChangeStatus`, `CustomerFromToken` through the private `do` helper; the fake grows matching routes and a service-token check (design.md Interfaces).
- Node for `make gen`/`make postman`: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; the worktree has no `node_modules`, so `npm ci` once at its root.
- Acceptance (opsx:verify on HEAD 10cac32): `make test-rider` all packages ok; `make gen` and `make postman` (17 pass) leave the tree clean; `openspec validate --all --strict` 15 passed; tasks 1 to 5 ticked; every scenario in the delta maps to a passing test (config 3, health 4, app/httpx conventions, request log, migrate, riders_test, auth_test, limit_test, core_test, admin_riders_test, cmd/rider-admin, seed_test, contract tests); files changed since the base are only `services/rider/`, the rider Postman collection, this change and rider-P3-L1 lane logs.
- Reviewer nits decided: (1) core 404 on admin/me as 502 and the prune-every-insert cache: design.md Decision 6 now says what the code does. (2) field checks before the store call: fix task 4b plus a new scenario "Fields are checked before the store". (3) `additionalProperties: false` on request schemas: removed in 4b (core's request schemas have none), Decision 10 says so. (4) seed reaching `core` only through `auth`: accepted, Decision 13 clarified. (5) T2 nits and R5's dropped argument cases: no action.
## Requests
- to platform (via the area plan): demo `riderId` `00000000-0000-4000-8000-000000000801` confirmed as `rider1-koramangala@shopperstop.local` at store `...0401`; the seed test ties it to `docs/postman/local.postman_environment.json`. `deliveryId` comes with rider-P3-L2.
## Blockers
