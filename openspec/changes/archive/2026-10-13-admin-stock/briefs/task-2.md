# Worker brief: admin-P2-L4 task 2, edits, the batched save, rows kept while the next list loads, the search field following the URL

- LANE-ID: admin-P2-L4 (worker log: `.claude/lanes/admin-P2-L4-T2.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L4` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L4-admin-stock` (commit here; never push)
- OpenSpec change: `admin-stock`, task 2 in `openspec/changes/admin-stock/tasks.md`
- Starts after: task 1 landed and reviewed

## Read first
1. `openspec/changes/admin-stock/tasks.md`, the header and section 2.
2. `openspec/changes/admin-stock/design.md`, section "Task 2" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-stock/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/stock.test.tsx` (append the task-2 block at the end; change nothing above it)
- `apps/admin/src/stock-rules.test.ts` (new)
- `apps/admin/src/stock.ts` (replace the whole file with the task-2 block)
- `apps/admin/src/routes/_staff/stock.tsx` (replace the whole file with the task-2 block)
- `openspec/changes/admin-stock/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L4-T2.md` (your log)

## Scenarios covered
- Stock edits › Edit typed back, Discard
- Stock save › Edits on two pages saved with one PUT, Kept page read again, Edit typed during a save
- Stock quantity the page cannot send › Unsendable quantity, Quantity as typed
- Stock store switch with unsaved edits › Store changed in the URL
- Stock rows while the next list loads › Rows kept while the next page loads
- Stock search and low-stock filter › Back and Forward

## Failing tests to start from
`apps/admin/src/stock.test.tsx`:
- "edits made on two pages and under a filter are saved with one PUT"
- "a page kept from before a save is read again, never shown with the old quantity"
- "an edit typed back to the saved quantity is no change, and nothing is sent"
- "discard puts every quantity back to what core holds"
- "a quantity the page cannot send is marked, named on save and not sent"
- "an edit typed while a save is in flight stays unsaved"
- "unsaved edits never follow a store changed in the URL"
- "while the next page loads, the rows on screen are marked busy, keep their own page number and cannot be edited"
- "Back and Forward move the search field and the list with the URL, and unsaved edits stay"

`apps/admin/src/stock-rules.test.ts`:
- "quantity %j is read as %j" (one `test.each`, nine runs)
- "a value that is not a quantity is never sent as a number"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `108 passed (108)`.
1. Append the task-2 block for `src/stock.test.tsx` from design.md at the end of the file. The block starts with one empty line and then the comment `// Replaces what a quantity field holds, as a user selecting it and typing would.`; keep both. Create `src/stock-rules.test.ts` from design.md. Run the admin tests, see the nineteen fail, record the summary and the names. `npm run typecheck --workspace apps/admin` fails at this point (the rules test imports what `src/stock.ts` does not export yet): that is expected for the red commit. Commit: `test: stock edits and batched save`. Tick 2.1.
2. Replace `src/stock.ts` and `src/routes/_staff/stock.tsx` whole with their task-2 blocks from design.md.
3. Run the gates. Commit the two files and the 2.2 tick: `feat: stock edits saved with one PUT`.

## Expected counts (measured by the team lead on this branch on top of task 1, base 108)
- After step 1: `Tests  19 failed | 108 passed (127)`: nine in `stock.test.tsx`, ten in `stock-rules.test.ts` (`parseQuantity is not a function`, `toRows is not a function`).
- After step 2: `Tests  127 passed (127)`.

## Notes for this task
- In this task the "Store" selector switches at once, also with unsaved edits, and a failed save shows nothing: the dialog and the failure alerts are task 3. Do not add them here.
- `toRows` in this task has no `.slice(0, maxRows)` and there is no `maxRows`; task 3 adds them with their test.
- The search form is still named "Stock" and `validateSearch` is unchanged from task 1 in this task; task 3 changes both with their tests.
- From the review of task 1 (design.md Decisions 20 and 21), all in the task-2 block of the route, do not change them: the quantity fields are `readOnly={stale}` (never `disabled`); the table's `Card` carries `aria-busy={stale}` and `opacity-50` while stale; the pager text prints `stock.data.page`; the search field is set from the URL's `q` during render with the `shownQ` state, not in a `useEffect` and not with a `key`.
- `stockCore` in `src/stock.test.tsx` already has the `PUT` handler and the `puts` log from task 1; this task's tests are what use them. Do not add or remove anything there.

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
- Counts are measured on this branch with task 1 landed (admin suite 108). If the suite does not start at the number step 0 names, stop and report.
- A block that does not compile, a count that differs for any other reason, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself, and never edit a test to make it pass.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
