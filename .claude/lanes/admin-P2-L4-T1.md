# admin-P2-L4-T1 - worker log, task 1 of admin-stock (stock table, store, search, filter, pager; e2e spec first)
Status: started
## Doing
Step 1 done (e2e spec written, lint and typecheck green, not run; committed 4b8b4e5). Step 2 done (committed 6e66a13): red run `Tests  13 failed | 95 passed (108)`, `Test Files 1 failed | 14 passed (15)`. Failing names (all in `src/stock.test.tsx`): the 13 named in the brief.
Step 3 and 4 done: `src/stock.ts` and `src/routes/_staff/stock.tsx` copied from design.md task 1. Green run `Tests  108 passed (108)`, 15 files. `make test-web` exit 0 (ui 54, admin 108, web 20). `openspec validate admin-stock --type change --strict`: valid. `git status --short` shows only the two files in scope. `routeTree.gen.ts` unchanged.
## Found
- Rebase check: admin suite at the start of this task is `Tests 95 passed (95)`, 14 files (the brief counted 52). Difference 43 added to every count, as the correction says.
- `make test-web`-relevant counts after this task: admin 108 red-run `13 failed | 95 passed (108)`, green `108 passed (108)`.
## Requests
None.
## Blockers
None.
