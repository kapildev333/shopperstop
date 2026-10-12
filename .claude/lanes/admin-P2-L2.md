# admin-P2-L2 - admin stores pages (OpenSpec change admin-stores)
Status: blocked
## Doing
Change proposed and valid; worker briefs ready (tasks 1 to 5, sequential). Waiting for core-P2-L2 on origin/main, the manager's rebase, then task 0 (team lead).
## Found
- Change: `openspec/changes/admin-stores/` (proposal; delta `admin-app` with 9 ADDED requirements, 20 scenarios; design with assumptions A1 to A12, verbatim code and the scenario-to-test table; tasks 0 to 5). `openspec validate admin-stores --strict` valid; `--all --strict` 8 passed.
- Capability: `admin-app` (same call as admin-P2-L1); `admin-stores` stays core's HTTP capability.
- Spike 2026-10-12 (scratchpad copy of f42fb87 plus core-P2-L2's `core.d.ts` and `openapi.json` at 5691d60, Node 22.23.3): tsc and eslint clean, Vitest 8 files / 50 tests (L1's 31 + 19), `vite build` with `routeTree.gen.ts` stable; Playwright on scratch port 25174 with a stateful `page.route` fake core: `e2e/stores.spec.ts` 2 passed, axe clean on table, store page, conflict alert, delete dialog with alert, create form with field errors.
- Core contract as read on core-P2-L2's branch (5691d60): matches every assumption. `StoreCreate` is typed with all eight fields required (defaults), so the form sends all; `PincodeConflict.pincode`/`storeId` are optional (absent in the concurrent-claim race).
- Decisions (design.md): status is a `Select` Open/Closed (no switch in ui); conflict names the other store by `GET /admin/stores/{storeId}` through the query cache, the id when that fails; table asks `pageSize=100`, no pager (ceiling 100 stores); PATCH sends only changed fields with `!==`; the form shows its own per-field messages for core's `validation` fields (core's speak in paise); pincodes rows are a `Table` with "Remove <pincode>" buttons; delete 409 explained in the dialog.
- Found in the spike, L1's shell: at 375 px the seven admin nav links overflow the `surface` strip and axe flags "Products" and "Staff" (`ink-muted` on `canvas`, 4.47:1). Not these pages; the e2e runs at desktop width.
## Requests
- to ui (via the admin area plan): `TabNav` needs horizontal scrolling (`overflow-x-auto`, no wrap) so the seven admin links stay on the `surface` strip at phone width; or admin adds it in `__root.tsx` in a later admin lane. Owner's call which.
- to core-P2-L2 (information): keep `pincode` and `storeId` on the 409 PincodeConflict and the `pageSize` maximum 100 on `GET /admin/stores`; the admin page relies on both.
## Blockers
- Workers wait for core-P2-L2 (`core-stores-serviceability`) on origin/main: routes, regenerated `packages/ui/src/api/core.d.ts`, store-staff seed (D22). Then task 0.
