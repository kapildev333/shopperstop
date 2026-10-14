# admin-P2-L6-T1 - admin-staff-e2e task 1: e2e written first, then the staff users table (worker)
Status: done

## Doing
Task 1 landed on `lane/admin-P2-L6-admin-staff-e2e`: `test:` `d8d98d6` (e2e specs, not run), `test:` `6c0cc9e` (red staff tests), `feat:` `83838c9` (staff.ts and the staff page, ticks 1.1 to 1.3). This `docs:` log follows. Nothing pushed. Nothing running.

## Found
- Step 0 base: `apps/admin/src/refetch-notice.tsx` present (rebase onto main done). Admin Vitest at base `Test Files 17 passed (17)`, `Tests 180 passed (180)`. Matches the brief.
- Commit `d8d98d6 test: staff users and product stock against core`: `apps/admin/e2e/staff.spec.ts` (new, 80 lines, extracted from design.md's NEW FILE block) and two insertions in `apps/admin/e2e/catalog.spec.ts` (EDIT 1: the `koramangala` constant after the `png` line; EDIT 2: the 25-line stock stretch between the upload check and the Delete click). Insertions applied by a script in `$TMPDIR` that took the text from design.md and required each anchor to occur exactly once; `git diff` shows 27 insertions and no deletion. Lint and typecheck exit 0 (both cover `e2e/`). Specs not run.
- Commit `6c0cc9e test: staff users table`: `apps/admin/src/staff-fake.ts` (50 lines) and `apps/admin/src/staff.test.tsx` (140 lines), extracted byte for byte from design.md. Every name they import from `fake-core.ts`, `session.ts` and `render-app.tsx` exists.
- Red run on `6c0cc9e`: `Test Files 1 failed | 17 passed (18)`, `Tests 7 failed | 181 passed (188)`. The seven failing tests are the ones the brief names: "the staff table lists every staff user by email with role, store and status" (Unable to find role="table" and name "Staff users"), "the staff table shows a skeleton while loading" (Unable to find role="status" and name "Loading"), "a first load in which GET /admin/staff-users fails shows a retry that reloads" and "... GET /admin/stores ..." (Unable to find role="alert"), "a failed refetch keeps the staff table, with the one notice from the root", "more staff users than one page says the list is cut", "a staff user whose store is not among the stores read shows as an unknown store" (both: Unable to find role="table" and name "Staff users"). The store-staff test passed as the brief predicts.
- Green run on `83838c9`: `Test Files 18 passed (18)`, `Tests 188 passed (188)`. `staff.ts` is the task-1 block (lines 509-536); `routes/_staff/_admin/staff.tsx` is the task-1 REPLACE WHOLE block (lines 541-606), replacing the five-line placeholder; the task-2 block was not used.
- Gates on `83838c9`: `make test-web` exit 0. ui `Test Files 25 passed (25)`, `Tests 54 passed (54)`; admin `Test Files 18 passed (18)`, `Tests 188 passed (188)`; web `Test Files 21 passed (21)`, `Tests 101 passed (101)`. `git status --short` before the log: clean (the changes were committed). `apps/admin/src/routeTree.gen.ts` unchanged. `openspec validate admin-staff-e2e --type change --strict`: "Change 'admin-staff-e2e' is valid", exit 0.
- Nothing from the brief's stop list was hit: base, admin counts, the seven red names, typecheck, lint, the route file and `routeTree.gen.ts` all matched. No e2e was run, and no docker command was run.
- Not checked by this worker: the e2e specs themselves (task 4, the manager's slot). The `catalog.spec.ts` stretch depends on task 3's image column in the stock row, as the tasks say.

## Requests
None.

## Blockers
None.
