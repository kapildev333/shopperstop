# Worker brief: admin-P2-L6 task 3, the stock table's image column, and the staff dialog against the row as the list holds it (review R2-1)

- LANE-ID: admin-P2-L6 (worker log: `.claude/lanes/admin-P2-L6-T3.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L6` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L6-admin-staff-e2e` (commit here; never push)
- OpenSpec change: `admin-staff-e2e`, task 3 in `openspec/changes/admin-staff-e2e/tasks.md`
- Starts after: task 2 landed and reviewed

## Read first
1. `openspec/changes/admin-staff-e2e/tasks.md`, the header and section 3.
2. `openspec/changes/admin-staff-e2e/design.md`, section "Task 3" under "Code and tests per task" (EDIT 1 to EDIT 6 and the two APPEND blocks), and Decision 22. Every edit is there as an "after" text with the lines to insert, or a "Replace" text with its "with" lines.
3. `openspec/changes/admin-staff-e2e/specs/admin-app/spec.md`, the scenarios listed below.

Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run. The test run prints many lines "Not implemented: Window's scrollTo() method": that is jsdom, ignore it.

## Scope paths (touch nothing else)
- `apps/admin/src/stock.test.tsx` (one test appended at the end; nothing above it changes)
- `apps/admin/src/staff-dialog.test.tsx` (EDIT 3 and EDIT 4: two import lines; two tests appended at the end; nothing else changes)
- `apps/admin/src/routes/_staff/stock.tsx` (EDIT 1 and EDIT 2: two inserted lines)
- `apps/admin/src/routes/_staff/_admin/staff.tsx` (EDIT 5: three inserted lines; EDIT 6: two lines replaced)
- `openspec/changes/admin-staff-e2e/tasks.md` (tick only 3.1, 3.2)
- `.claude/lanes/admin-P2-L6-T3.md` (your log)

## Scenarios covered
- Stock product image › Product image tile
- Staff user changed while its dialog is open › Row changed while the dialog is open, Row gone from the list while the dialog is open

## Failing tests to start from
- `apps/admin/src/stock.test.tsx` › "each stock row starts with the product's image as a tile, a placeholder when it has none" (red: no "Image" column)
- `apps/admin/src/staff-dialog.test.tsx` › "a row changed by a refetch while its dialog is open: the save sends what the dialog shows, against the row as it is now" (red at `expect(sent(calls, 'PATCH')).toHaveLength(1)`: no `PATCH` is sent)
- Green when written, and that is expected: `apps/admin/src/staff-dialog.test.tsx` › "a row gone from the list while its dialog is open keeps the dialog on the row as opened" (it guards the fallback EDIT 5 adds)

## Steps, in this order
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `212 passed (212)` (the base, 180, plus 32).
1. From design.md, section "Task 3": append the test to `apps/admin/src/stock.test.tsx` ("APPEND to `src/stock.test.tsx`": one empty line after the file's last line, then the block). In `apps/admin/src/staff-dialog.test.tsx` make EDIT 3 (replace the testing-library import line) and EDIT 4 (insert the `staffUsersQuery` import after the `render-app` import), then append the two tests ("APPEND to `src/staff-dialog.test.tsx`": one empty line after the file's last line, then the block). Run the admin tests, see exactly the two named tests fail, record the summary in your lane log. Commit the three test edits and the 3.1 tick: `test: stock product image; staff row changed while its dialog is open`.
2. Make EDIT 1 and EDIT 2 in `apps/admin/src/routes/_staff/stock.tsx` (one import line, one column line) and EDIT 5 and EDIT 6 in `apps/admin/src/routes/_staff/_admin/staff.tsx` (insert the `user` constant with its two comment lines after the `storeName` line; replace the two `user=` and `self=` prop lines). Each "after" or "Replace" text must be found exactly once. Change nothing else in either file.
3. Run the gates. Commit the two files and the 3.2 tick: `feat: stock image column; the staff dialog edits the row as the list holds it`.

## Expected counts
- After step 1: `Tests  2 failed | 213 passed (215)` (2 failed | base + 33 passed). Measured 2026-10-15 on the branch at ade7525.
- After step 2: `Tests  215 passed (215)` (base + 35).
- `make test-web` after step 2: exit 0, ui 54, admin 215, web 140. Measured.

## Notes for this task
- `ImageTile` comes from `apps/admin/src/image.tsx` (`../../image` from the route file). Do not write a new tile and do not look for one in `@shopperstop/ui`: it is not there yet.
- The staff edit is review R2-1 (design.md Decision 22): the page hands the dialog the row as the list holds it now, and the row as opened only when the list no longer holds it. Do not reset the dialog's form when the row changes, and do not close the dialog when the row goes: both are decided against.
- No existing stock or staff test changes. If one goes red, stop and report.

## Rules
- Commit order is fixed: the `test:` commit(s) first with the tests failing, then one `feat:` commit with the code and the ticks in tasks.md. Never amend a commit. Commit identity is the repo git config; no attribution or co-author lines. Never push.
- Tick the boxes in `openspec/changes/admin-staff-e2e/tasks.md` with the Edit tool (`- [ ]` to `- [x]`), only the boxes of this task.
- Copy every block from design.md byte for byte. Do not redesign, rename, reformat or "improve" it. Colours only from the semantic tokens; components only from `@shopperstop/ui`; no new dependency; no `package.json` change; do not import `lucide-react`.
- Do not edit `apps/admin/src/fake-core.ts`, `apps/admin/src/api.ts` or any file outside your scope paths.
- Counts are "base + n". If the suite did not start at the number step 0 names, note the number you found in your lane log and add the difference to every count.
- A block that does not compile, an "after" text that is not found exactly once, a count that differs for any other reason, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself, and never edit a test to make it pass.
- A password never goes into a log line, a test name, your lane log or a commit message beyond what design.md's blocks already hold.

## Gates before the `feat:` commit
1. `make test-web` exits 0 (ui, admin and web: lint, typecheck, test, build).
2. `git status --short` lists only files in your scope. `apps/admin/src/routeTree.gen.ts` must NOT be listed: this change never alters it. If it is listed, stop and report.
3. `openspec validate admin-staff-e2e --type change --strict` says valid.
Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. The manager holds the e2e slot.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
