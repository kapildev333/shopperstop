# Worker brief: admin-P2-L4 task 3, store switch dialog, save failures, the 500-row limit, URL values and the store's name for store staff

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
- `apps/admin/e2e/stock.spec.ts` (one line added; written only, never run)
- `apps/admin/src/stock.test.tsx` (replace ONE landed test, then append the task-3 block at the end; change nothing else)
- `apps/admin/src/stock-rules.test.ts` (append the task-3 block at the end; change nothing above it)
- `apps/admin/src/stock.ts` (replace the whole file with the task-3 block)
- `apps/admin/src/routes/_staff/stock.tsx` (replace the whole file with the task-3 block)
- `openspec/changes/admin-stock/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L4-T3.md` (your log)

## Scenarios covered
- Stock store switch with unsaved edits › Switch asks first
- Stock save failures › Save refused for a deleted product, Other save failure
- Stock save › More than 500 edits
- Stock URL values › Unreadable page or filter, Over-large page, Over-long search
- Stock store for store staff › Store staff see their own store (now with the store's name and its request), Store name unavailable
- Stock table › Stock listed (the request list of an admin)
- Stock against core › Store staff set stock at their own store only: one line added to the spec; run in task 4

## Failing tests to start from
`apps/admin/src/stock.test.tsx`:
- "store staff see their own store by name and no store selector" (it replaces the landed "store staff see their own store and no store selector")
- "switching store with unsaved edits asks first"
- "a save refused for a deleted product says so and keeps the edits"
- "any other save failure shows a banner, keeps the edits and can be retried"
- "a page in the URL beyond what core accepts is cut to one it does, then to the last page"
- "a search in the URL loses NUL bytes and is cut to the 100 characters core takes"
- "store staff get the stock without a store name when the name cannot be read"

`apps/admin/src/stock-rules.test.ts`:
- "one save takes the first 500 edits, in the order they were made"

Green as soon as they are written, on purpose (they test what task 1 already built; no code follows for them): "?%s in the URL is read as page 1 with the filter off" (three runs: `page=banana`, `page=1.5`, `lowStock=banana`) and "an admin is not asked for a store name: the selector names the store".

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `127 passed (127)`.
1. In `apps/admin/e2e/stock.spec.ts` add the one line from design.md task 3 (the block shows the three lines that are there and the four they become; the new line is `await expect(page.getByText('Store: Koramangala')).toBeVisible()`). Run `npm run lint --workspace apps/admin` and `npm run typecheck --workspace apps/admin`; both must pass. Do not run the spec. Commit: `test: stock page against core names the store for store staff`. Tick 3.1.
2. In `apps/admin/src/stock.test.tsx`: (a) replace the whole test "store staff see their own store and no store selector", from its `test(` line to its closing `})`, with the test in design.md task 3 headed "replace one test"; (b) append the task-3 block at the end of the file. In `apps/admin/src/stock-rules.test.ts` append its task-3 block. Each appended block starts with one empty line; keep it. Run the admin tests, see the eight fail, record the summary and the names. Commit: `test: stock store switch, save failures, URL values and store name`. Tick 3.2.
3. Replace `src/stock.ts` and `src/routes/_staff/stock.tsx` whole with their task-3 blocks from design.md.
4. Run the gates. Commit the two files and the 3.3 tick: `feat: stock store switch dialog, save failures, URL values and store name`.

## Expected counts (measured by the team lead on this branch on top of tasks 1 and 2, base 127)
- After step 1: still `Tests  127 passed (127)`.
- After step 2: `Tests  8 failed | 130 passed (138)`: seven in `stock.test.tsx`, one in `stock-rules.test.ts`. The four runs named "green as soon as they are written" pass here already.
- After step 3: `Tests  138 passed (138)`; `make test-web`: ui 54, admin 138, web 20.

## Notes for this task
- The dialog's buttons are "Cancel" (from `DialogFooter`) then "Discard and switch", in that order.
- "Discard and switch" calls `discard()` before it navigates. Without it the edits come back when the admin returns to the first store; the test checks that.
- The store's name for store staff is plain text in the filter card, shown only when `GET /stores/{id}` answered. No skeleton, no error, no retry for it: when the request fails the line is just not there.
- `validateSearch` holds a NUL character written as `'\0'` in the source (backslash, zero, inside quotes). Copy it exactly; do not paste a real NUL byte.
- The search form's name becomes "Search stock"; the field and the button keep their names "Search".

## Gates before the `feat:` commit
1. `make test-web` exits 0 (ui, admin and web: lint, typecheck, test, build).
2. `git status --short` lists only files in your scope (`apps/admin/e2e/stock.spec.ts` was committed in step 1). `apps/admin/src/routeTree.gen.ts` must NOT be listed: this change never alters it. If it is listed, stop and report.
3. `openspec validate admin-stock --type change --strict` says valid.
Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. The manager holds the e2e slot.

## Rules
- Commit order is fixed: the `test:` commit(s) first with the tests failing, then one `feat:` commit with the code and the ticks in tasks.md. Commit identity is the repo git config; no attribution or co-author lines.
- Tick the boxes in `openspec/changes/admin-stock/tasks.md` with the Edit tool (`- [ ]` to `- [x]`), only the boxes of this task.
- Colours only from the semantic tokens; components only from `@shopperstop/ui`; no new dependency; no `package.json` change. Do not import `lucide-react` (it is not an `apps/admin` dependency).
- Do not edit `apps/admin/src/fake-core.ts`: the stock fixtures live in `src/stock.test.tsx` on purpose (design.md Decision 15).
- Counts are measured on this branch with tasks 1 and 2 landed (admin suite 127). If the suite does not start at the number step 0 names, stop and report.
- A block that does not compile, a count that differs for any other reason, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself, and never edit a test to make it pass.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
