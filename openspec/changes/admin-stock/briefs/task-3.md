# Worker brief: admin-P2-L4 task 3, store switch dialog, save failures and the 500-row limit

- LANE-ID: admin-P2-L4 (worker log: `.claude/lanes/admin-P2-L4-T3.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L4` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L4-admin-stock` (commit here; never push)
- OpenSpec change: `admin-stock`, task 3 in `openspec/changes/admin-stock/tasks.md`
- Starts after: task 2 landed and reviewed

## Read first
1. `openspec/changes/admin-stock/tasks.md`, the header and section 3.
2. `openspec/changes/admin-stock/design.md`, section "Task 3" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-stock/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/stock.test.tsx` (append the task-3 block at the end; change nothing above it)
- `apps/admin/src/stock-rules.test.ts` (append the task-3 block at the end; change nothing above it)
- `apps/admin/src/stock.ts` (replace the whole file with the task-3 block)
- `apps/admin/src/routes/_staff/stock.tsx` (replace the whole file with the task-3 block)
- `openspec/changes/admin-stock/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L4-T3.md` (your log)

## Scenarios covered
- Stock store switch with unsaved edits › Switch asks first
- Stock save failures › Save refused for a deleted product, Other save failure
- Stock save › More than 500 edits

## Failing tests to start from
`apps/admin/src/stock.test.tsx`:
- "switching store with unsaved edits asks first"
- "a save refused for a deleted product says so and keeps the edits"
- "any other save failure shows a banner, keeps the edits and can be retried"

`apps/admin/src/stock-rules.test.ts`:
- "one save takes the first 500 edits, in the order they were made"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `82 passed (82)`.
1. Append the two task-3 test blocks from design.md, one at the end of `src/stock.test.tsx`, one at the end of `src/stock-rules.test.ts`. Each block starts with one empty line; keep it. Run the admin tests, see the four fail, record the summary and the names. Commit: `test: stock store switch, save failures and row limit`. Tick 3.1.
2. Replace `src/stock.ts` and `src/routes/_staff/stock.tsx` whole with their task-3 blocks from design.md.
3. Run the gates. Commit the two files and the 3.2 tick: `feat: stock store switch dialog, save failures and row limit`.

## Expected counts (measured by the team lead on this branch at 503e1ba)
- After step 1: `Tests  4 failed | 82 passed (86)`.
- After step 2: `Tests  86 passed (86)`; `make test-web`: ui 54, admin 86, web 20.

## Notes for this task
- The dialog's buttons are "Cancel" (from `DialogFooter`) then "Discard and switch", in that order.
- "Discard and switch" calls `discard()` before it navigates. Without it the edits come back when the admin returns to the first store; the test checks that.

## Gates before the `feat:` commit
1. `make test-web` exits 0 (ui, admin and web: lint, typecheck, test, build).
2. `git status --short` lists only files in your scope. `apps/admin/src/routeTree.gen.ts` must NOT be listed: this change never alters it. If it is listed, stop and report.
3. `openspec validate admin-stock --type change --strict` says valid.
Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. The manager holds the e2e slot.

## Rules
- Commit order is fixed: the `test:` commit(s) first with the tests failing, then one `feat:` commit with the code and the ticks in tasks.md. Commit identity is the repo git config; no attribution or co-author lines.
- Tick the boxes in `openspec/changes/admin-stock/tasks.md` with the Edit tool (`- [ ]` to `- [x]`), only the boxes of this task.
- Colours only from the semantic tokens; components only from `@shopperstop/ui`; no new dependency; no `package.json` change. Do not import `lucide-react` (it is not an `apps/admin` dependency).
- Do not edit `apps/admin/src/fake-core.ts`: the stock fixtures live in `src/stock.test.tsx` on purpose (design.md Decision 15).
- Counts are measured on a branch based on main (admin suite 52 before task 1). If the suite did not start at the number this brief names, the branch was rebased: note the number you found in your lane log and add the difference to every count below.
- A block that does not compile, a count that differs for any other reason, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself, and never edit a test to make it pass.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
