# admin-P3-L1 - riders page, rider names, one active-orders poll, ui swaps (OpenSpec change admin-riders)
Status: started
## Doing
2026-10-15: change proposed and committed; tasks 1 to 3 can start now (main has ui-P3-L1, core-P3-L1, core-P3-L2). Task 4 waits on ui-P3-L2 (`@shopperstop/ui/api/rider`). Task 5 waits on the e2e slot and core's seed request.
## Found
- Change `openspec/changes/admin-riders/`: proposal.md; deltas `specs/admin-app/spec.md` (11 MODIFIED requirements) and `specs/admin-riders/spec.md` (11 ADDED requirements, new capability); design.md (gates, 14 decisions, ceilings, scenario-to-test map, requests, risks); tasks.md (5 tasks); `patches/` (11 patches, applied in order with `git apply`). `openspec validate admin-riders --strict` valid; `--all --strict` 16 passed.
- Spiked on this branch rebased onto 56aacc6 (#211, #215 in), then everything under `apps/admin` and `packages/ui` restored. Each patch was built step by step and the full sequence re-applied on a clean tree. Admin Vitest: base 295; 1.2 red 3 / 295; 1.3 and 1.4 295; 2.1 red 2 / 297; 2.2 297; 3.1 red 9 / 299; 3.2 299 (on the real core-P3-L2 types); 4.1 red 25 / 322 (lint passes, typecheck fails by design); 4.3 322. Lint, typecheck and `vite build` clean on the final tree. Task 4 was spiked against a `rider.d.ts` generated locally by `openapi-typescript` and a temporary `./api/rider` export in `packages/ui/package.json`, both removed.
- core-P3-L2 types `active` as the string `"true"` (`active?: "true"`), so the board sends `active: 'true'`.
- A MODIFIED requirement cannot drop a scenario (the CLI refuses). The two "One list fails …" scenarios keep their names, reworded for the one request, and their tests are rewritten, not deleted.
- `fakeCore` strips only `/api/core/v1`, so the rider service is faked in the same `fetch` stub under keys `METHOD /api/rider/v1/...` (`src/riders-fake.ts`); `fake-core.ts` is unchanged.
- e2e specs not run (no slot): `riders.spec.ts` new; `orders.spec.ts` asserts the dashboard's "Open" and SS-DEMOAAAB's "Rider: Arjun Rao" / "Delivered by Arjun Rao" (needs core's seed, below); auth/staff/stores nav arrays gain "Riders".
- Incident, reported to the manager: during the spike a chained command whose first step failed ran `cd ../..` from the worktree root into the root checkout, applied the task 3 code edit to root's `apps/admin/src/orders.ts` and `order-board.tsx`, and the same chain's `git checkout -- .` restored them. Checked afterwards: root `git status` clean at HEAD, and no other root file changed in that window (mtime scan). Since then every command uses absolute paths.
- Read at start and before finishing: the admin area plan, admin-P2-L5 and its briefs, ui-P3-L1, core-P3-L1, core-P3-L2, rider-P3-L1. The requests to admin there are answered: the `rider` actor label (#200) and the fixtures (#211). The optional `riderName`/`actorName` display is task 2.
## Requests
- to core (via the area plan; gates task 5's run): demo seed SS-DEMOAAAB (`…0701`) gets `rider_name` "Arjun Rao" (rider `…0801`, the rider-service seed's rider for that order's delivery `…0901`), and its `ready → out_for_delivery` and `out_for_delivery → delivered` events `actor_type` `rider`, `actor_id` `…0801`, `actor_name` "Arjun Rao".
- to ui (ui-P3-L2, via the area plan): export `@shopperstop/ui/api/rider` (`exports["./api/rider"] = { "types": "./src/api/rider.d.ts" }`) with `paths` and `components` as `openapi-typescript` writes them; patch 4.3 imports exactly those names.
- to platform (low): `openspec/config.yaml` context lists capabilities; `rider-service` and `admin-riders` are missing.
- to the manager: rebase this branch onto main before task 4 (ui-P3-L2). Task 5 needs the e2e slot and core's seed change.
## Blockers
None for tasks 1 to 3.
