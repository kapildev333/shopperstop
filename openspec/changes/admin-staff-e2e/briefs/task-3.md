# Worker brief: admin-P2-L6 task 3, the stock table's image column

- LANE-ID: admin-P2-L6 (worker log: `.claude/lanes/admin-P2-L6-T3.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L6` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L6-admin-staff-e2e` (commit here; never push)
- OpenSpec change: `admin-staff-e2e`, task 3 in `openspec/changes/admin-staff-e2e/tasks.md`
- Starts after: task 2 landed and reviewed

## Read first
1. `openspec/changes/admin-staff-e2e/tasks.md`, the header and section 3.
2. `openspec/changes/admin-staff-e2e/design.md`, section "Task 3" under "Code and tests per task". Every file you write is there in full, every edit as an "after" text and the lines to insert.
3. `openspec/changes/admin-staff-e2e/specs/admin-app/spec.md`, the scenarios listed below.

Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run. The test run prints many lines "Not implemented: Window's scrollTo() method": that is jsdom, ignore it.

## Scope paths (touch nothing else)
- `apps/admin/src/stock.test.tsx` (one test appended at the end; nothing above it changes)
- `apps/admin/src/routes/_staff/stock.tsx` (two inserted lines)
- `openspec/changes/admin-staff-e2e/tasks.md` (tick only 3.1, 3.2)
- `.claude/lanes/admin-P2-L6-T3.md` (your log)

## Scenario covered
- Stock product image › Product image tile

## Failing test to start from
`apps/admin/src/stock.test.tsx` › "each stock row starts with the product's image as a tile, a placeholder when it has none"

## Steps, in this order
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `211 passed (211)` (the base, 180, plus 31).
1. Append the test to `apps/admin/src/stock.test.tsx` from design.md (task 3, "APPEND"): one empty line after the file's last line, then the block. Run the admin tests, see the one fail, record the summary in your lane log. Commit: `test: stock product image`. Tick 3.1.
2. Make EDIT 1 and EDIT 2 in `apps/admin/src/routes/_staff/stock.tsx` from design.md: one import line, one column line. Each "after" text must be found exactly once. Change nothing else in the file.
3. Run the gates. Commit the file and the 3.2 tick: `feat: stock table shows the product image`.

## Expected counts
- After step 1: `Tests  1 failed | 211 passed (212)` (1 failed | base + 31 passed).
- After step 2: `Tests  212 passed (212)` (base + 32).

## Notes for this task
- `ImageTile` comes from `apps/admin/src/image.tsx` (`../../image` from the route file). Do not write a new tile and do not look for one in `@shopperstop/ui`: it is not there yet.
- No existing stock test changes. If one goes red, stop and report.

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
