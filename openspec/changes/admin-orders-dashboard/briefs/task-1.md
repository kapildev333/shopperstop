# Worker brief: admin-P2-L5 task 1, the board, read-only: store, polling, announcements, states, and the e2e specs written first

- LANE-ID: admin-P2-L5 (worker log: `.claude/lanes/admin-P2-L5-T1.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L5` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L5-admin-orders-dashboard` (commit here; never push)
- OpenSpec change: `admin-orders-dashboard`, task 1 in `openspec/changes/admin-orders-dashboard/tasks.md`
- Starts after: the rebase onto main with admin-stock and admin-keep-data-on-refetch-error (admin-P2-L7) merged (the manager does it)

## Read first
1. `openspec/changes/admin-orders-dashboard/tasks.md`, the header and section 1.
2. `openspec/changes/admin-orders-dashboard/design.md`, section "Task 1" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-orders-dashboard/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/e2e/orders.spec.ts` (new, written only)
- `apps/admin/e2e/catalog.spec.ts` (one test appended, written only)
- `apps/admin/src/orders-fake.ts` (new)
- `apps/admin/src/orders-board.test.tsx` (new)
- `apps/admin/src/orders-rules.test.ts` (new)
- `apps/admin/src/orders.ts` (new)
- `apps/admin/src/order-board.tsx` (new)
- `apps/admin/src/routes/_staff/orders.tsx` (replace the placeholder)
- `openspec/changes/admin-orders-dashboard/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L5-T1.md` (your log)

## Scenarios covered
- Orders board › Board listed
- Orders store for admins › Choose a store, Store in the URL
- Orders store for store staff › Store staff see their own store, Store name unavailable
- Orders board polling › Poll, Hidden tab
- Orders board announcements › New placed order announced once
- Orders time since placed › A minute passes, Wording
- Orders board states › Board loading, Board load failure, No active orders, No stores, Stores load failure
- Orders kept on a failed refresh › Failed poll keeps the board
- Orders against core and Ordered product against core: written here, run in task 6

## Failing tests to start from
`apps/admin/src/orders-board.test.tsx`:
- "the board shows a column per active status with each order's number, time since placed, item count, total and pincode"
- "store staff see the board of their own store by name, with no store selector and no stores request"
- "store staff get the board without a store name when the name cannot be read"
- "a store in the URL is the one shown, and one that is not a store shows the first store"
- "choosing a store puts it in the URL and never shows or announces the other store's orders"
- "the board asks core again every 10 seconds and shows an order where it now stands"
- "a newly placed order is announced once; the first load, an unchanged answer and an order in another status announce nothing"
- "a hidden tab is not polled, and showing it again asks core at once"
- "a failed poll keeps the board and announces nothing; the next good answer shows and announces what is new"
- "the time since placed moves on without core being asked"
- "the board shows a skeleton while loading"
- "a board that cannot be loaded offers a retry that reloads"
- "a store with no active orders shows the empty state"
- "an admin with no stores is told to create one"
- "stores that cannot be loaded offer a retry that reloads"

`apps/admin/src/orders-rules.test.ts` (fails as a file while `src/orders.ts` is absent):
- "an order placed %i seconds ago reads %j" (8 runs)
- "the item count of a card is the quantities added up"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Check the base: `ls apps/admin/src/stock.ts` exists and `grep -c storeNameQuery apps/admin/src/stock.ts` prints at least 1. Also `ls apps/admin/src/refetch-notice.tsx` exists (admin-P2-L7). If either is missing, the branch is not rebased onto both: stop and report. Run `npm run test --workspace apps/admin -- --run` and write the summary in your log as the base: expected `180 passed (180)`. If it is another number, go on, and read every count below as moved by the difference.
1. Create `e2e/orders.spec.ts` from design.md. Append the block for `e2e/catalog.spec.ts` at the end of that file, after one empty line; change nothing above it. Run `npm run lint --workspace apps/admin` and `npm run typecheck --workspace apps/admin`: both pass. Do not run the specs. Commit: `test: orders, dashboard and the ordered product against core`. Tick 1.1.
2. Create `src/orders-fake.ts`, `src/orders-board.test.tsx` and `src/orders-rules.test.ts` from design.md. Run the admin tests, see the fifteen fail and `orders-rules.test.ts` fail to load, record the summary and the names. `npm run typecheck --workspace apps/admin` fails at this point (two files import `./orders`, which does not exist yet): expected for the red commit. Commit: `test: orders board`. Tick 1.2.
3. Create `src/orders.ts` and `src/order-board.tsx` and replace `src/routes/_staff/orders.tsx` whole, from design.md task 1.
4. Run the gates. Commit the three files and the 1.3 tick: `feat: orders board with store, polling and new-order announcements`.

## Expected counts (measured by the team lead in the spike; base 180 = the admin suite on main with admin-stock and admin-P2-L7's fix at 0aa0ab1)
- Base: `Tests  180 passed (180)`, 17 files.
- After step 2: `Test Files  2 failed | 17 passed (19)`, `Tests  15 failed | 180 passed (195)`: the fifteen of `orders-board.test.tsx`; `orders-rules.test.ts` is the second failed file, with `Error: Failed to resolve import "./orders"` and no test counted.
- After step 3: `Tests  204 passed (204)`, 19 files.
If the base differs from 180, every number above moves by the same difference; anything else that differs is a stop.

## Notes for this task
- In this task a card has no button at all: the next-status button is task 2 and the number becomes a button in task 3. Do not add them.
- `src/orders-fake.ts` already has the `POST …/status` and `GET /admin/orders/{id}` routes that tasks 2 and 3 use. Write the file once, exactly as in design.md; no later task changes it.
- The route has no tabs in this task and reads only `store` from the URL; task 4 replaces it.
- Five tests start with `useFakeClock()` (fake timers with `shouldAdvanceTime: true`); the `afterEach` at the top of the file restores real timers. Do not move fake timers into `beforeEach` or into other tests, and do not add `vi.runAllTimers`.
- The announcement is worked out during render under the `heard?.from !== board.data` check, not in a `useEffect`: keep it so (lint forbids state set in an effect).
- The page shows no "Could not refresh" notice of its own: `RefetchNotice` at the root of the app (admin-P2-L7, already on the branch) shows it, and the failed-poll test asserts that one. Do not add a notice to the board.
- `refreshFailed` in `src/orders-fake.ts` waits twice on purpose (the query's state, then `notifyManager.schedule`): keep both waits.
- `src/shell.test.tsx` and `src/sign-in.test.tsx` are untouched and stay green.
- The e2e files are written, never run: no `npx playwright`, no `make e2e`.

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
