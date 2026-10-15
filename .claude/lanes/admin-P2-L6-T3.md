# admin-P2-L6-T3 - admin-staff-e2e task 3: the stock image column, and the staff dialog edits the row as the list holds it (R2-1) (worker)
Status: done

## Doing
Task 3 landed on `lane/admin-P2-L6-admin-staff-e2e`: `test:` `7d08628` (red, ticks 3.1), `feat:` `7e41439` (green, ticks 3.2). This `docs:` log follows. Nothing pushed. No e2e, docker, `make db` or `make dev` run.

## Found
- Step 0 base: admin Vitest `Test Files 19 passed (19)`, `Tests 212 passed (212)`. Matches the brief.
- Step 1 red, commit `7d08628 test: stock product image; staff row changed while its dialog is open`: `apps/admin/src/stock.test.tsx` (one test appended), `apps/admin/src/staff-dialog.test.tsx` (EDIT 3 and EDIT 4 import lines, two tests appended), `openspec/changes/admin-staff-e2e/tasks.md` (3.1). Red run: `Test Files 2 failed | 17 passed (19)`, `Tests 2 failed | 213 passed (215)`. The two failures are the named ones: stock at `expected [ 'Product', 'Unit', 'Price', …(2) ] to deeply equal [ 'Image', 'Product', …]` (no Image column); staff at `expected [] to have a length of 1` on the `PATCH` count. The "row gone from the list" test was green when written, as the brief expects.
- Step 2 green, commit `7e41439 feat: stock image column; the staff dialog edits the row as the list holds it`: `apps/admin/src/routes/_staff/stock.tsx` (EDIT 1 and EDIT 2, two inserted lines), `apps/admin/src/routes/_staff/_admin/staff.tsx` (EDIT 5, three inserted lines; EDIT 6, two lines replaced), `openspec/changes/admin-staff-e2e/tasks.md` (3.2). Green run: `Test Files 19 passed (19)`, `Tests 215 passed (215)`.
- Blocks copied from design.md by `sed` line extraction (the appended blocks and EDIT 3 to EDIT 6 texts) and applied by a script that asserts each anchor occurs exactly once; the stock and staff diffs were checked against design.md after applying. The script and extracts live in the scratchpad, not the repo.
- Gates on `7e41439`: `make test-web` exit 0. ui `Test Files 25 passed (25)`, `Tests 54 passed (54)`; admin `Test Files 19 passed (19)`, `Tests 215 passed (215)`; web `Test Files 25 passed (25)`, `Tests 140 passed (140)`. `openspec validate admin-staff-e2e --type change --strict`: "Change 'admin-staff-e2e' is valid". `git status --short` lists only the two route files (before the commit) and the tree is clean after it. `apps/admin/src/routeTree.gen.ts` not listed and not changed.
- `StockRow.imageUrl` exists in the generated `packages/ui/src/api/core.d.ts` (core's answer to core-P2-L6 is used here as designed).
- No existing stock or staff test changed.

## Requests
None.

## Blockers
None.
