# admin-P2-L2 - admin stores pages (OpenSpec change admin-stores)
Status: started
## Doing
Task 0 done on 50af48f; briefs for tasks 1 to 5 (sequential, task 5 needs the e2e slot) are in the report. Waiting for the manager to launch task 1.
## Found
- Change: `openspec/changes/admin-stores/` (proposal; delta `admin-app` with 9 ADDED requirements, 20 scenarios; design with assumptions A1 to A12, verbatim code and the scenario-to-test table; tasks 0 to 5). `openspec validate admin-stores --strict` valid; `--all --strict` 8 passed.
- Task 0 (2026-10-12, branch fast-forwarded by the manager onto origin/main 50af48f): `packages/ui/src/api/core.d.ts` is byte-identical to the file the spike compiled against; `openspec/specs/admin-stores` holds the same ten requirements as the proposed delta; seed `internal/seed/seed.go` matches A12 (stores ...0401/...0402, pincodes, store staff ...0102/...0103 with `staff12345`); `GET /admin/stores` `pageSize` max 100. No edit to delta, code or tasks. `openspec validate admin-stores --type change --strict` valid; `--all --strict` 10 passed.
- Capability: `admin-app` (same call as admin-P2-L1); `admin-stores` stays core's HTTP capability.
- Spike 2026-10-12 (scratchpad copy of f42fb87 plus core-P2-L2's `core.d.ts` and `openapi.json` at 5691d60, Node 22.23.3): tsc and eslint clean, Vitest 8 files / 50 tests (L1's 31 + 19), `vite build` with `routeTree.gen.ts` stable; Playwright on scratch port 25174 with a stateful `page.route` fake core: `e2e/stores.spec.ts` 2 passed, axe clean on table, store page, conflict alert, delete dialog with alert, create form with field errors.
- Core contract as read on core-P2-L2's branch (5691d60): matches every assumption. `StoreCreate` is typed with all eight fields required (defaults), so the form sends all; `PincodeConflict.pincode`/`storeId` are optional (absent in the concurrent-claim race).
- Decisions (design.md): status is a `Select` Open/Closed (no switch in ui); conflict names the other store by `GET /admin/stores/{storeId}` through the query cache, the id when that fails; table asks `pageSize=100`, no pager (ceiling 100 stores); PATCH sends only changed fields with `!==`; the form shows its own per-field messages for core's `validation` fields (core's speak in paise); pincodes rows are a `Table` with "Remove <pincode>" buttons; delete 409 explained in the dialog.
- Found in the spike, L1's shell: at 375 px the seven admin nav links overflow the `surface` strip and axe flags "Products" and "Staff" (`ink-muted` on `canvas`, 4.47:1). Not these pages; the e2e runs at desktop width.
- 2026-10-12 manager decision (a), relayed: task 1 adds `stores/new.tsx` and `stores/$storeId.tsx` as PageHeader-only placeholders (typed `Link` rejected the routes before task 2; my design gap: the spike had every file at once); task 2 overwrites them. design.md Files and tasks 1 and 2 amended.
## Requests
- to ui (via the admin area plan): `TabNav` needs horizontal scrolling (`overflow-x-auto`, no wrap) so the seven admin links stay on the `surface` strip at phone width; or admin adds it in `__root.tsx` in a later admin lane. Owner's call which.
- to core-P2-L2 (information): keep `pincode` and `storeId` on the 409 PincodeConflict and the `pageSize` maximum 100 on `GET /admin/stores`; the admin page relies on both.
## Blockers
