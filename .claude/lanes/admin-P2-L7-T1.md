# admin-P2-L7-T1 - admin-keep-data-on-refetch-error task 1: a failed refetch keeps the showing admin page (worker)
Status: blocked

## Doing
Stopped at step 7 of the brief, before the `fix:` commit. The `test:` commit `87381e8` is in. The fix (`refetch-notice.tsx` and EDIT 1 to 12) is applied in the worktree and uncommitted: admin is green, but `make test-web` reports web 101, not the brief's 91. Tick 1.2 is not made. Waiting for the team lead's call.

## Found
- Base before any change: admin Vitest `Test Files 16 passed (16)`, `Tests 160 passed (160)`, on the rebased HEAD `2868aa3`. Matches the brief.
- Commit `87381e8 test: a failed refetch keeps the showing admin page`: `apps/admin/src/refetch.test.tsx` (new, byte-identical to design.md's NEW FILE block, checked with diff) and tasks.md box 1.1 ticked. Body names 11 red and 8 pins green on arrival.
- Red run on that commit: `Test Files 1 failed | 16 passed (17)`, `Tests 11 failed | 168 passed (179)`. The 11 failing names are the ones the brief lists: three "a failed refetch keeps the table of %s" runs, the store page, product page, new product, stock table, store staff stock, "a save whose reload fails …", "a category save whose reload fails …", "the notice leaves with the page it was about". Nothing else failed.
- Lint (`eslint .`) and typecheck (`tsc -p tsconfig.json`) for apps/admin: exit 0 on the red commit and on the fixed tree.
- Fix, uncommitted: `apps/admin/src/refetch-notice.tsx` (new, 19 lines, copied from design.md's NEW FILE block). The 12 EDIT blocks were applied by a script in `$TMPDIR` that reads each "Replace" and "With" block from design.md and requires the "Replace" text to occur exactly once in its file. All 12 occurred exactly once; no retyping. Files touched: `routes/__root.tsx`, `routes/_staff/_admin/stores/index.tsx`, `routes/_staff/_admin/stores/$storeId.tsx`, `routes/_staff/_admin/products/index.tsx`, `routes/_staff/_admin/products/$productId.tsx`, `routes/_staff/_admin/products/new.tsx`, `routes/_staff/_admin/categories.tsx`, `service-areas.tsx`, `routes/_staff/stock.tsx`. `git status --short` lists only those and the new notice file.
- Admin after the fix: `Test Files 17 passed (17)`, `Tests 179 passed (179)`. Lint and typecheck exit 0.
- `make test-web`: exit 0. Counts: ui `Test Files 25 passed (25)`, `Tests 54 passed (54)`; admin `Test Files 17 passed (17)`, `Tests 179 passed (179)`; web `Test Files 21 passed (21)`, `Tests 101 passed (101)`.
- `openspec validate admin-keep-data-on-refetch-error --type change --strict`: valid.
- `apps/admin/src/routeTree.gen.ts`: unchanged.
- Why web is 101 and not 91: the brief's counts were measured at `6d9f7b3`. Web changed since then (`8558d68` web-P2-L8 #152 added tests; `619a057` core-P2-L6 touched web's sources). This lane's diff touches only `apps/admin/` and `openspec/`, and no file under `apps/web` or `packages/ui`. So web's 101 is the count of the rebased base, not a result of this change. ui is 54, as the brief says.

## Requests
- to admin-P2-L7 (team lead): decide whether the fix commits with web at 101. Options: (a) accept web 101 as the new base count for this lane and let me commit the fix (`fix: a failed refetch keeps the showing admin page`) and tick 1.2; (b) re-measure the web count on the rebased base before anything else. The fix diff is ready in the worktree, uncommitted.

## Blockers
- Step 7 of `briefs/task-1.md` expects `make test-web` to print `web 91 passed`. It prints `web 101 passed (101)` on the rebased base, with exit 0. The brief's count was measured at `6d9f7b3`, before web tests were added on main. Per the brief's stop rule I did not commit the fix (step 8) and did not tick 1.2. Nothing was repaired or adapted.
