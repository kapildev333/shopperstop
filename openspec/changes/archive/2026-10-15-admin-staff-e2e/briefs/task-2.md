# Worker brief: admin-P2-L6 task 2, the create and edit dialog

- LANE-ID: admin-P2-L6 (worker log: `.claude/lanes/admin-P2-L6-T2.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L6` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L6-admin-staff-e2e` (commit here; never push)
- OpenSpec change: `admin-staff-e2e`, task 2 in `openspec/changes/admin-staff-e2e/tasks.md`
- Starts after: task 1 landed and reviewed (R1, approve with nits). R1's findings 1 and 2 are part of this task (design.md Decision 21).

## Read first
1. `openspec/changes/admin-staff-e2e/tasks.md`, the header and section 2.
2. `openspec/changes/admin-staff-e2e/design.md`, section "Task 2" under "Code and tests per task". Every new file is there in full; every edit is either an "After" text with the lines to insert, or a "Replace" text with the lines to put in its place (each found exactly once).
3. `openspec/changes/admin-staff-e2e/specs/admin-app/spec.md`, the scenarios listed below.

Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run. The test run prints many lines "Not implemented: Window's scrollTo() method": that is jsdom, ignore it.

## Scope paths (touch nothing else)
- `apps/admin/src/staff-dialog.test.tsx` (new)
- `apps/admin/src/staff-dialog.tsx` (new)
- `apps/admin/src/routes/_staff/_admin/staff.tsx` (replaced whole by its task-2 block)
- `apps/admin/src/staff.test.tsx` (EDIT 1, EDIT 2, the APPEND)
- `apps/admin/src/staff-fake.ts` (one line replaced)
- `apps/admin/src/staff.ts` (one edit)
- `openspec/changes/admin-staff-e2e/tasks.md` (tick only 2.1, 2.2)
- `.claude/lanes/admin-P2-L6-T2.md` (your log)

## Scenarios covered
- Staff users table states › Failed refetch while the stores load
- Staff user create › Create a store-staff user, Create an admin, Created user changed at once
- Staff user change › Change the name, Deactivate and activate, Nothing changed
- Staff user own account › Own dialog, Another user's dialog
- Staff user form errors › Validation error on a field, Store staff without a store, Taken email, Other failure, Unknown staff user on save
- Staff user save in progress › Second press during a save, Edit typed during a save, Cancel and Escape
- Staff user passwords › Password field on create, New password sent alone and not kept

## Failing tests to start from
- `apps/admin/src/staff-dialog.test.tsx`, all 23 of the file (the names are in tasks.md section 2): every one starts by pressing "New staff user" or an "Edit <email>" button, which the task-1 page does not have.
- `apps/admin/src/staff.test.tsx` › "a refetch of the staff users that fails while the stores still load keeps the skeleton, not the alert": red because the task-1 page shows the alert with "Try again" (no `status` named "Loading").

## Steps, in this order
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `188 passed (188)` (the base, 180, plus task 1's 8).
1. Create `apps/admin/src/staff-dialog.test.tsx` from design.md; apply EDIT 1, EDIT 2 and the APPEND to `apps/admin/src/staff.test.tsx` and the EDIT to `apps/admin/src/staff-fake.ts`, all from design.md. Run the admin tests, see the 24 fail (the run is slow: each dialog test waits a second for a button that is not there), record the summary and the failing names in your lane log. Commit the four files: `test: staff user dialog`. Tick 2.1.
2. Create `apps/admin/src/staff-dialog.tsx`, apply the EDIT to `apps/admin/src/staff.ts`, and overwrite `apps/admin/src/routes/_staff/_admin/staff.tsx` with its task-2 block, all from design.md.
3. Run the gates. Commit the three files and the 2.2 tick: `feat: staff user create and edit dialog`.

## Expected counts
- After step 1: `Tests  24 failed | 188 passed (212)` (24 failed | base + 8 passed). Measured 2026-10-15 on this branch.
- After step 2: `Tests  212 passed (212)` (base + 32). `make test-web` measured: ui 54, admin 212 after this task (213 after task 3), web 140.

## Notes for this task
- The submit button uses `aria-disabled` and the label "Saving…". Do not give it `disabled` or `loading`: a test fails on it, and so does keyboard focus.
- `gcTime: 0` on the mutation is there so the password does not stay in memory; do not remove it. Do not add `console` calls anywhere.
- `idle` is a constant inside `staff-dialog.tsx` on purpose. Do not create `src/idle.ts` and do not import one, even if the file exists (another lane owns it).
- `src/staff.test.tsx`, `src/staff-fake.ts` and `src/staff.ts` change only by design.md's task-2 edits. Task 1's eight tests are not edited and stay green.
- The create test types `Jaya@example.test` with a capital on purpose (R1-2): a code-unit sort would put it first; keep it.
- The page's alert test is `(users.isError && list === undefined) || (stores.isError && storeItems === undefined)` (R1-1). The existing admin pattern is `data === undefined ? (isError ? alert : skeleton) : content`; with two reads this is that rule per read. Do not simplify it back to `users.isError || stores.isError`.
- `edit()` calls `save.reset()` only when no save is pending; a failure with no error body reaches the dialog as code `internal` through `src/api.ts` and shows the alert. Both are in the blocks already; do not change them.

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
