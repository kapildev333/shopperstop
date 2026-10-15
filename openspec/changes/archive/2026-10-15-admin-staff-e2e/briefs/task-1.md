# Worker brief: admin-P2-L6 task 1, the e2e specs written first, then the staff users table

- LANE-ID: admin-P2-L6 (worker log: `.claude/lanes/admin-P2-L6-T1.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L6` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L6-admin-staff-e2e` (commit here; never push)
- OpenSpec change: `admin-staff-e2e`, task 1 in `openspec/changes/admin-staff-e2e/tasks.md`
- Starts after: task 0: the manager rebased the branch onto main with admin-P2-L7

## Read first
1. `openspec/changes/admin-staff-e2e/tasks.md`, the header and section 1.
2. `openspec/changes/admin-staff-e2e/design.md`, section "Task 1" under "Code and tests per task". Every file you write is there in full, every edit as an "after" text and the lines to insert.
3. `openspec/changes/admin-staff-e2e/specs/admin-app/spec.md`, the scenarios listed below.

Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run. The test run prints many lines "Not implemented: Window's scrollTo() method": that is jsdom, ignore it.

## Scope paths (touch nothing else)
- `apps/admin/e2e/staff.spec.ts` (new)
- `apps/admin/e2e/catalog.spec.ts` (two insertions)
- `apps/admin/src/staff-fake.ts` (new)
- `apps/admin/src/staff.test.tsx` (new)
- `apps/admin/src/staff.ts` (new)
- `apps/admin/src/routes/_staff/_admin/staff.tsx` (replace the five-line placeholder)
- `openspec/changes/admin-staff-e2e/tasks.md` (tick only 1.1, 1.2, 1.3)
- `.claude/lanes/admin-P2-L6-T1.md` (your log)

## Scenarios covered
- Staff users table › Staff users listed, Store not among the stores read
- Staff users table states › Staff users loading, First load failure, Failed refetch keeps the table
- Staff users list beyond one page › More than 100 staff users, Whole list shown
- Staff users only for admins › Store staff open /staff
- Staff users against core, Product and stock against core: you only write the spec files; they are run in task 4

## Failing tests to start from
`apps/admin/src/staff.test.tsx`:
- "the staff table lists every staff user by email with role, store and status"
- "the staff table shows a skeleton while loading"
- "a first load in which GET /admin/staff-users fails shows a retry that reloads"
- "a first load in which GET /admin/stores fails shows a retry that reloads"
- "a failed refetch keeps the staff table, with the one notice from the root"
- "more staff users than one page says the list is cut"
- "a staff user whose store is not among the stores read shows as an unknown store"

Green as soon as it is written, on purpose (the admin-only route folder already does it): "store staff who open /staff see not found, and core is not asked for the staff users". Do not change it to make it fail.

## Steps, in this order
0. Check the base: `ls apps/admin/src/refetch-notice.tsx` must list the file (admin-P2-L7 is on the branch). If it is missing, stop and report: the branch was not rebased. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `180 passed (180)`. That number is your base.
1. Create `apps/admin/e2e/staff.spec.ts` and make EDIT 1 and EDIT 2 in `apps/admin/e2e/catalog.spec.ts`, from design.md. Run `npm run lint --workspace apps/admin` and `npm run typecheck --workspace apps/admin`; both must pass. Do not run the specs. Commit: `test: staff users and product stock against core`. Tick 1.1.
2. Create `apps/admin/src/staff-fake.ts` and `apps/admin/src/staff.test.tsx` from design.md. Run the admin tests, see the seven fail, record the summary and the names in your lane log. Commit: `test: staff users table`. Tick 1.2.
3. Create `apps/admin/src/staff.ts` and overwrite `apps/admin/src/routes/_staff/_admin/staff.tsx`, both from design.md (the task-1 blocks; the route file has a second, longer block under task 2: not that one).
4. Run the gates. Commit the two files and the 1.3 tick: `feat: staff users table`.

## Expected counts
- After step 2: `Tests  7 failed | 181 passed (188)` (7 failed | base + 1 passed).
- After step 3: `Tests  188 passed (188)` (base + 8).

## Notes for this task
- The page has no "New staff user" button, no "Actions" column and no dialog in this task; task 2 adds them. Do not add them now.
- After EDIT 2 the catalog spec uses `nav` and `products`, which the test already declares above the inserted lines. If typecheck says otherwise, the lines went to the wrong place: stop and report.

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
