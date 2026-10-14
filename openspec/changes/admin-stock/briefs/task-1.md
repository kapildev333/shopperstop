# Worker brief: admin-P2-L4 task 1, stock table, store, search, filter and pager (and the e2e spec written first)

- LANE-ID: admin-P2-L4 (worker log: `.claude/lanes/admin-P2-L4-T1.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L4` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L4-admin-stock` (commit here; never push)
- OpenSpec change: `admin-stock`, task 1 in `openspec/changes/admin-stock/tasks.md`
- Starts after: nothing (the team lead's documents are committed)

## Read first
1. `openspec/changes/admin-stock/tasks.md`, the header and section 1.
2. `openspec/changes/admin-stock/design.md`, section "Task 1" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-stock/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/e2e/stock.spec.ts` (new)
- `apps/admin/src/stock.test.tsx` (new)
- `apps/admin/src/stock.ts` (new)
- `apps/admin/src/routes/_staff/stock.tsx` (replace the five-line placeholder)
- `openspec/changes/admin-stock/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L4-T1.md` (your log)

## Scenarios covered
- Stock table › Stock listed
- Stock store for admins › Choose a store, Store in the URL, Unknown store in the URL
- Stock store for store staff › Store staff see their own store
- Stock search and low-stock filter › Search and filter from the first page
- Stock pager › Pager, Page past the end
- Stock table states › Search without a match, Stock loading, Stock load failure, No stores, Stores load failure
- Stock against core › Admin sets stock at a store, Store staff set stock at their own store only: you only write the spec file; it is run in task 4

## Failing tests to start from
`apps/admin/src/stock.test.tsx`:
- "the stock table lists a page of the first store and badges quantities below 5"
- "store staff see their own store and no store selector"
- "choosing a store puts it in the URL and loads its stock, never under the other store's rows"
- "a store in the URL is the one shown"
- "a store in the URL that is not a store shows the first store"
- "search and the low-stock filter ask core again from the first page"
- "the pager moves between pages and the pressed button keeps focus"
- "a page past the end shows the last page"
- "a search that matches nothing shows the empty state"
- "the stock table shows a skeleton while loading"
- "stock load failure shows a retry that reloads"
- "an admin with no stores is told to create one"
- "stores load failure shows a retry that reloads"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `52 passed (52)`.
1. Create `apps/admin/e2e/stock.spec.ts` from design.md. Run `npm run lint --workspace apps/admin` and `npm run typecheck --workspace apps/admin`; both must pass. Do not run the spec. Commit: `test: stock page against core`. Tick 1.1.
2. Create `apps/admin/src/stock.test.tsx` from design.md (the task-1 block). Run the admin tests, see the thirteen fail, record the summary and the names in your lane log. Commit: `test: stock table`. Tick 1.2.
3. Create `apps/admin/src/stock.ts` and overwrite `apps/admin/src/routes/_staff/stock.tsx`, both from design.md (the task-1 blocks).
4. Run the gates. Commit the two files and the 1.3 tick: `feat: stock table with store, search, low-stock filter and pager`.

## Expected counts (measured by the team lead on this branch at 503e1ba)
- After step 2: `npm run test --workspace apps/admin -- --run` ends with `Tests  13 failed | 52 passed (65)`.
- After step 3: `Tests  65 passed (65)`.
The test run prints many lines "Not implemented: Window's scrollTo() method": that is jsdom, it is there on main too, ignore it.

## Notes for this task
- The quantity fields are `readOnly` in this task on purpose; task 2 makes them editable. Do not add editing here.
- `src/stock.test.tsx` has a helper `quantity` and a helper `findQuantity` and no `type` helper yet; task 2 appends `type`. Do not add it now (lint fails on an unused function).

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
