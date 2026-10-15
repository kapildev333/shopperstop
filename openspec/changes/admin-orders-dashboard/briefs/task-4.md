# Worker brief: admin-P2-L5 task 4, the History tab

- LANE-ID: admin-P2-L5 (worker log: `.claude/lanes/admin-P2-L5-T4.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L5` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L5-admin-orders-dashboard` (commit here; never push)
- OpenSpec change: `admin-orders-dashboard`, task 4 in `openspec/changes/admin-orders-dashboard/tasks.md`
- Starts after: task 3 landed and reviewed

## Read first
1. `openspec/changes/admin-orders-dashboard/tasks.md`, the header and section 4.
2. `openspec/changes/admin-orders-dashboard/design.md`, section "Task 4" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-orders-dashboard/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/orders-history.test.tsx` (new)
- `apps/admin/src/order-history.tsx` (new)
- `apps/admin/src/orders.ts` and `apps/admin/src/routes/_staff/orders.tsx` (both replaced whole by their task-4 block)
- `openspec/changes/admin-orders-dashboard/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L5-T4.md` (your log)

## Scenarios covered
- Orders history › Delivered orders listed, Tabs, Cancelled orders, No finished orders, History loading and load failure
- Orders history pager › Pager
- Orders URL values › Unreadable values, Over-large page
- Orders history and the store › Store chosen on History, History after a delivery
- Orders kept on a failed refresh › Failed refresh keeps the history
- Order sheet follows core › Finished order not polled

## Failing tests to start from
`apps/admin/src/orders-history.test.tsx`:
- "the History tab lists delivered orders, newest first, with number, placed, customer, items, total and when delivered"
- "Board and History are tabs held in the URL, and the store stays chosen"
- "Cancelled lists the cancelled orders with when they were cancelled, from page 1, never under the delivered rows"
- "the pager moves between pages and keeps focus; rows kept while the next page loads are marked busy under their own page number"
- "?%s in the URL is read as %s" (5 runs)
- "a page in the URL beyond what core accepts is cut to one it does, then to the last page"
- "a history row opens the order without a cancel, read once and not polled"
- "a failed refresh keeps the history list; the next good answer shows what core then holds"
- "the history shows a skeleton while loading, and a list that cannot be loaded offers a retry that reloads"
- "a store with no cancelled orders shows the empty state"
- "choosing a store on the History tab keeps the tab, starts at page 1 and never shows the other store's rows"
- "a history page kept from before a status change is read again, never shown as it was"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `236 passed (236)` (base + 56).
1. Create `src/orders-history.test.tsx` from design.md. Run the admin tests, see the sixteen fail, record the summary and the names. Commit: `test: orders history tab`. Tick 4.1.
2. Create `src/order-history.tsx`; replace `src/orders.ts` and `src/routes/_staff/orders.tsx` whole with their task-4 blocks from design.md.
3. Run the gates. Commit the three files and the 4.2 tick: `feat: orders history tab with status filter and pager`.

## Expected counts (re-measured on 2026-10-15 on this branch with task 3 landed, base 236 before step 1; first measured in the spike; base 180 = the admin suite on main with admin-stock and admin-P2-L7's fix at 0aa0ab1)
- After step 1: `Tests  16 failed | 236 passed (252)`, all sixteen in `orders-history.test.tsx` (twelve tests, one of them five runs).
- After step 2: `Tests  252 passed (252)`, 22 files.
If the base differs from 180, every number above moves by the same difference; anything else that differs is a stop.

## Notes for this task
- The two tab links keep `activeOptions={{ exact: true }}` and their explicit `aria-current`; the `TabNav` keeps `className="bg-surface px-4"` (without it axe fails on contrast in task 6).
- The pager buttons are `aria-disabled` with `idle` and guarded in their handlers, never `disabled`.
- `OrderBoard` and `OrderHistory` both carry `key={storeId}` in the route. Do not remove either.
- The store selector navigates with `{ store, tab }` only: `status` and `page` are dropped on purpose.
- `go` is wrapped in `useCallback`: the history's effect depends on it.
- `src/orders.ts` of this task is its last version.

- No "Could not refresh" notice in the history: the root's `RefetchNotice` shows it, and this task's failed-refresh test asserts that one.

## Gates before the `feat:` commit
1. `make test-web` exits 0 (ui, admin and web: lint, typecheck, test, build).
2. `git status --short` lists only files in your scope. `apps/admin/src/routeTree.gen.ts` must NOT be listed: this change never alters it. If it is listed, stop and report.
3. `openspec validate admin-orders-dashboard --type change --strict` says valid.
Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. The manager holds the e2e slot.

## Rules
- Commit order is fixed: the `test:` commit(s) first with the tests failing, then one `feat:` commit with the code and the ticks in tasks.md. Commit identity is the repo git config; no attribution or co-author lines.
- Tick the boxes in `openspec/changes/admin-orders-dashboard/tasks.md` with the Edit tool (`- [ ]` to `- [x]`), only the boxes of this task.
- Colours only from the semantic tokens; components only from `@shopperstop/ui`; no new dependency; no `package.json` change. Do not import `lucide-react` (it is not an `apps/admin` dependency).
- Do not edit `apps/admin/src/fake-core.ts`, `apps/admin/src/orders-fake.ts` (after task 1) or any existing test.
- A block that does not compile, a count that differs for any reason other than the base, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself, and never edit a test to make it pass.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
