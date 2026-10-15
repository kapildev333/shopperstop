# Worker brief: admin-P2-L5 task 2, review fixes (step A) then status actions (step B)

- LANE-ID: admin-P2-L5 (worker log: `.claude/lanes/admin-P2-L5-T2.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L5` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L5-admin-orders-dashboard` (commit here; never push)
- OpenSpec change: `admin-orders-dashboard`, task 2 in `openspec/changes/admin-orders-dashboard/tasks.md`
- Starts after: task 1 landed and reviewed

## Read first
1. `openspec/changes/admin-orders-dashboard/tasks.md`, the header and section 2 (revised after the review of task 1): it lists the scenarios and every test name of both steps.
2. `openspec/changes/admin-orders-dashboard/design.md`, section "Task 2" under "Code and tests per task": step A, then step B. Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-orders-dashboard/specs/admin-app/spec.md`, the scenarios tasks.md section 2 names.

## Scope paths (touch nothing else)
- `apps/admin/src/orders-board.test.tsx` (step A: one block appended at the end; nothing above it changes)
- `apps/admin/src/order-board.tsx` (replaced whole in step A, and again in step B)
- `apps/admin/src/orders-status.test.tsx` (step B, new)
- `apps/admin/src/idle.ts` (step B, new)
- `apps/admin/src/orders.ts` (step B, replaced whole)
- `openspec/changes/admin-orders-dashboard/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L5-T2.md` (your log)

## Failing tests to start from
Step A, `apps/admin/src/orders-board.test.tsx`, red:
- "coming back to a store announces nothing for an order placed while its board was away"
- "leaving the orders page and coming back announces nothing for an order placed meanwhile"
- "orders kept from an earlier visit are no baseline when the first refresh after coming back fails"
- "cards are in the order the orders were placed, also within one second and whatever the digits core trimmed"
- "a column is named by its status and how many orders it holds"

Step A, green when written (they pin what task 1 built; no code follows for them):
- "an order placed while the tab was hidden is announced when the tab shows again"
- "one of the five requests failing on a later poll keeps the whole board, with the notice that it could not refresh"
- "one of the five requests failing on the first load is a board that could not be loaded"
- "the poll stops when the board is left"

Step B, `apps/admin/src/orders-status.test.tsx`, red: the nine tests named in tasks.md section 2, step B.

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `204 passed (204)`.
1. Step A tests: append the step-A block for `src/orders-board.test.tsx` from design.md at the end of the file. The block starts with one empty line and then the comment `// From the review of task 1.`; keep both. Run the admin tests: five fail, the other four new ones pass. Record the summary and the names. Commit: `test: orders board after coming back, card order, column names, one failing list, poll on leaving`. Tick 2.1.
2. Step A code: replace `src/order-board.tsx` whole with its step-A block. Run the gates. Commit the file and the 2.2 tick: `fix: no announcement from orders kept before the board opened; cards by time; columns named with their count`.
3. Step B tests: create `src/orders-status.test.tsx` from design.md. Run the admin tests, see the nine fail. Commit: `test: order status actions`. Tick 2.3.
4. Step B code: create `src/idle.ts`; replace `src/orders.ts` and `src/order-board.tsx` whole with their step-B blocks. Run the gates. Commit the three files and the 2.4 tick: `feat: next-status buttons with the 409 re-read and the delivered confirmation`.

## Expected counts (measured by the team lead on this branch with task 1 landed, 204)
- After step 1: `Tests  5 failed | 208 passed (213)`, all five in `orders-board.test.tsx`.
- After step 2: `Tests  213 passed (213)`, 19 files.
- After step 3: `Tests  9 failed | 213 passed (222)`, all nine in `orders-status.test.tsx`.
- After step 4: `Tests  222 passed (222)`, 20 files.
Anything else is a stop.

## Notes for this task
- Step A changes three things in `src/order-board.tsx` and nothing else: the announcement block's condition gains `board.isFetchedAfterMount && !board.isError`; the cards are sorted with `Date.parse`; the column's `h2` gets an `aria-label`. Step B's block already contains all three: do not lose them when you replace the file again.
- Both parts of the condition are needed (`isFetchedAfterMount` is also true after a failed fetch); each has its own test.
- The heading keeps its visible text and its count badge; only the `aria-label` is new. Task 1's tests and the e2e find the columns by `/^Placed/` and still pass.
- The next-status button is never `disabled` and never gets `loading`: it is `aria-disabled` with the `idle` class, and `advance` returns early while a change runs.
- The button's name comes from `aria-labelledby` (its own id and the number's id). Do not add an `aria-label` or a hidden copy of the number.
- In `useSetStatus`, `await queryClient.cancelQueries(...)` comes before `setQueryData`: the order matters.
- A 409 resolves the mutation (it reads the order again); it does not throw.
- The card's number is still plain text in this task; there is no sheet yet. `removeQueries` is task 4.
- Do not edit `src/orders-fake.ts`: the one-status failure is a small wrapper inside the appended test block.

## Gates before the `feat:` commit
1. `make test-web` exits 0 (ui, admin and web: lint, typecheck, test, build).
2. `git status --short` lists only files in your scope. `apps/admin/src/routeTree.gen.ts` must NOT be listed: this change never alters it. If it is listed, stop and report.
3. `openspec validate admin-orders-dashboard --type change --strict` says valid.
Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. The manager holds the e2e slot.

## Rules
- Commit order is fixed: the `test:` commit(s) first with the tests failing, then the `fix:` or `feat:` commit with the code and the ticks in tasks.md, per step. Commit identity is the repo git config; no attribution or co-author lines.
- Tick the boxes in `openspec/changes/admin-orders-dashboard/tasks.md` with the Edit tool (`- [ ]` to `- [x]`), only the boxes of this task.
- Colours only from the semantic tokens; components only from `@shopperstop/ui`; no new dependency; no `package.json` change. Do not import `lucide-react` (it is not an `apps/admin` dependency).
- Do not edit `apps/admin/src/fake-core.ts`, `apps/admin/src/orders-fake.ts` (after task 1) or any existing test.
- A block that does not compile, a count that differs for any reason other than the base, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself, and never edit a test to make it pass.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
