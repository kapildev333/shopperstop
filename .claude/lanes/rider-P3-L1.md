# rider-P3-L1 - rider service foundation (OpenSpec change rider-service-foundation)
Status: started
## Doing
Team lead: change proposed and valid (`openspec validate rider-service-foundation --strict`; `--all --strict` 15 passed); waiting for the manager to launch task 1. Answers to worker questions go here under Found.
## Found
- Change `openspec/changes/rider-service-foundation/`: proposal, `specs/rider-service/spec.md` (16 ADDED requirements, all under 500 characters, each with WHEN/THEN scenarios), design.md (14 decisions, data model, interfaces, test strategy; no `docs/design/rider-P3-L1.md` needed), tasks.md (5 worker tasks, 1 manager task).
- Copies from core are from `services/core` at `5335efcec70b770ffca2b13b62fca855ce5aaa0b` (design Decision 1). `internal/pg` lands with task 2 because its tests need tables.
- Order: 1, then 2 and 3 in parallel (task 3 touches only `internal/core`, `internal/coretest`), then 4, then 5.
- The first task writes `docs/postman/shopperstop-rider.postman_collection.json` (platform's request); tasks 2 and 4 regenerate it. No `packages/ui/src/api/rider.d.ts` in this lane.
- For rider-P3-L2: core's demo delivered order is `00000000-0000-4000-8000-000000000701` (`SS-DEMOAAAB`); `...0703` is the placed one (core `internal/seed/summary.go`). The work package's "`...0703`, confirm" should read `...0701`.
- For rider-P3-L2: the core client grows by `StoreOrders`, `Order`, `ChangeStatus`, `CustomerFromToken` through the private `do` helper; the fake grows matching routes and a service-token check (design.md Interfaces).
- Node for `make gen`/`make postman`: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; the worktree has no `node_modules`, so `npm ci` once at its root.
## Requests
- to platform (via the area plan): demo `riderId` `00000000-0000-4000-8000-000000000801` confirmed as `rider1-koramangala@shopperstop.local` at store `...0401`; the seed test ties it to `docs/postman/local.postman_environment.json`. `deliveryId` comes with rider-P3-L2.
## Blockers
