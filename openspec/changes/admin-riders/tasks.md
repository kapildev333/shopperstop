# Tasks

Branch `lane/admin-P3-L1-riders` in `.worktrees/admin-P3-L1`. Tasks run in order on the one branch. Each applies its patches from `openspec/changes/admin-riders/patches/` with `git apply` from the worktree root (design.md, "How the code is handed over"). A patch that does not apply, a count that differs, or any open design choice: stop and report. Briefs: `.claude/lanes/admin-P3-L1-T<n>.md`.

Gates, from the worktree root, every command prefixed with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`. Quick loop: `npm run build --workspace packages/ui` once, then `npm run test --workspace apps/admin -- --run`. Before each `feat:`/`refactor:` commit: `make test-web`, `git status --short` (only the task's files), `openspec validate admin-riders --strict`. Workers never run `make e2e`, Playwright, docker or `make db`/`make dev`.

Commits: `test: <scenario>` with the failing tests (the red summary goes in the worker's log), then `feat:` (or `refactor:`) with the code and this file's ticks. No attribution trailers; never push.

## 1. ui swaps and the stacked cancel dialog (e2e written first)
Waits on: nothing (ui-P3-L1 on main). Base `295 passed (295)`.
Scope: `apps/admin/e2e/{riders,orders,auth,staff,stores}.spec.ts`, `apps/admin/src/order-sheet.test.tsx`, `apps/admin/src/order-sheet.tsx`, `apps/admin/src/image.tsx`, `apps/admin/src/idle.ts` (deleted), `apps/admin/src/order-board.tsx`, `apps/admin/src/order-history.tsx`, `apps/admin/src/staff-dialog.tsx`, `apps/admin/src/routes/_staff/stock.tsx`, `apps/admin/src/routes/_staff/_admin/categories.tsx`, `apps/admin/src/routes/_staff/_admin/products/index.tsx`, this file's ticks.
Scenarios: Order cancel with a reason › Order cancelled, Reason missing, Keep order. (Riders against the rider service, Orders against core, Role-based navigation in e2e: written here, run in task 5.)
Failing tests: `src/order-sheet.test.tsx` › "a cancel needs a reason: without one nothing is sent, the field says so, and the message goes when a reason is typed", "Keep order and Escape close only the dialog, without sending, and the keyboard is back on the sheet", "a cancel sends the reason as the note once, takes the order off the board and shows it cancelled with the reason".
- [x] 1.1 `patches/1.1-e2e-specs.diff` (`test: riders, the seeded order's rider and the dashboard's Open against the services`); lint and typecheck pass; not run
- [x] 1.2 `patches/1.2-sheet-tests.diff` (`test: the cancel dialog opens over the order sheet`); `3 failed | 292 passed (295)`
- [x] 1.3 `patches/1.3-sheet-code.diff` (`feat: the cancel dialog stacks over the order sheet; the keyboard lands on the result`); `295 passed (295)`
- [x] 1.4 `patches/1.4-ui-swaps.diff` (`refactor: ui's ImageTile, aria-disabled styling, VisuallyHidden live and compact order buttons`); no new test, the existing ones pin the behaviour (design.md decision 13); `295 passed (295)`; every gate green

## 2. The rider on the card and the sheet
Waits on: task 1 (core-P3-L1 on main).
Scope: `apps/admin/src/orders-board.test.tsx`, `apps/admin/src/order-sheet.test.tsx`, `apps/admin/src/order-board.tsx`, `apps/admin/src/order-sheet.tsx`, this file's ticks.
Scenarios: Orders board › Rider on the card; Order detail sheet › Rider and rider events.
Failing tests: `src/orders-board.test.tsx` › "a card taken out by a rider names the rider; a card without one does not"; `src/order-sheet.test.tsx` › "the sheet names the order's rider, and the rider on the events the rider made".
- [x] 2.1 `patches/2.1-rider-name-tests.diff` (`test: the rider's name on the card and the sheet`); `2 failed | 295 passed (297)`
- [x] 2.2 `patches/2.2-rider-name-code.diff` (`feat: board cards and the order sheet name the rider`); `297 passed (297)`; every gate green

## 3. One active-orders poll; Open or Closed on the dashboard
Waits on: task 2 and core-P3-L2 on main (#215: `active` on `listStoreOrders`, `DashboardStore.isOpen`).
Scope: `apps/admin/src/orders-fake.ts`, `apps/admin/src/orders-board.test.tsx`, `apps/admin/src/orders-status.test.tsx`, `apps/admin/src/order-sheet.test.tsx`, `apps/admin/src/dashboard.test.tsx`, `apps/admin/src/orders.ts`, `apps/admin/src/order-board.tsx`, `apps/admin/src/routes/_staff/index.tsx`, this file's ticks.
Scenarios: Orders board › Board listed, More active orders than one page; Orders board polling › Poll, Hidden tab, Board left; Orders board states › One list fails on the first load; Orders kept on a failed refresh › One list fails on a later poll; Dashboard › Open or closed.
Failing tests: `src/orders-board.test.tsx` › "the board shows a column per active status with each order's number, time since placed, item count, total and pincode", "the board asks core again every 10 seconds and shows an order where it now stands", "a hidden tab is not polled, and showing it again asks core at once", "the poll stops when the board is left", "a store with more active orders than one page says how many the board shows"; `src/orders-status.test.tsx` › "a press sends the next status once, moves the card with core's answer and says so, without listing the orders again", "a poll answer read before a status change never moves the card back"; `src/order-sheet.test.tsx` › "a poll answer read before a cancel never puts the order back on the board"; `src/dashboard.test.tsx` › "each card says whether its store is open". Rewritten and green before and after: "the one list failing on a later poll keeps the whole board, with the notice that it could not refresh", "the one list failing on the first load is a board that could not be loaded".
- [x] 3.1 `patches/3.1-board-dashboard-tests.diff` (`test: one active-orders request per poll; Open or Closed on the dashboard`); `9 failed | 290 passed (299)`
- [x] 3.2 `patches/3.2-board-dashboard-code.diff` (`feat: the board polls core's active orders in one request; dashboard cards say Open or Closed`); `299 passed (299)`; every gate green

## 4. The riders page
Waits on: task 3 and **ui-P3-L2 on main** (`@shopperstop/ui/api/rider`); the manager rebases the branch onto main first.
Scope: `apps/admin/src/riders-fake.ts`, `apps/admin/src/riders.test.tsx`, `apps/admin/src/rider-dialog.test.tsx`, `apps/admin/src/shell.test.tsx`, `apps/admin/vite.config.ts`, `apps/admin/playwright.config.ts`, `apps/admin/e2e/global-setup.ts`, `apps/admin/src/api.ts`, `apps/admin/src/nav.ts`, `apps/admin/src/riders.ts`, `apps/admin/src/rider-dialog.tsx`, `apps/admin/src/routes/_staff/riders.tsx`, `apps/admin/src/routeTree.gen.ts`, this file's ticks.
Scenarios: every `admin-riders` scenario except "Riders against the rider service"; Role-based navigation › both; Core reached through a same-origin proxy › Rider client calls the page's origin.
Failing tests: all of `src/riders.test.tsx` (7 tests, 8 runs) and `src/rider-dialog.test.tsx` (10 tests, 15 runs) as named in design.md "Tests"; `src/shell.test.tsx` › "admin sees every section", "store staff see dashboard, orders and stock".
- [x] 4.1 `patches/4.1-riders-tests.diff` (`test: riders page, rider dialog, Riders in the nav`); `25 failed | 297 passed (322)`; typecheck fails here by design (`Rider` comes with 4.3)
- [x] 4.2 `patches/4.2-rider-service-config.diff` and `patches/4.3-riders-code.diff`, then `npm run build --workspace apps/admin` leaves `routeTree.gen.ts` as the patch wrote it (`feat: riders page against the rider service`); `322 passed (322)`; every gate green

## 3b. Review fix: the board's total after a status change (R2-1), and R1 nit 1
Waits on: tasks 1 to 4 landed (HEAD 752d935, admin `322 passed (322)`). From `.claude/lanes/admin-P3-L1-R2.md` finding 1: a status change rewrote the board's `items` but kept core's old `total`, so delivering or cancelling one of a store's active orders showed "Showing the newest n of n+1 active orders." until the next poll. The fix moves `total` by the change in the item count (also right on the 409 path, where an order joins the board). R1 nit 1 (a double blank line in `routes/_staff/stock.tsx`) is folded into the `fix:` commit.
Scope: `apps/admin/src/orders-status.test.tsx`, `apps/admin/src/order-sheet.test.tsx` (one test appended to each), `apps/admin/src/orders.ts`, `apps/admin/src/routes/_staff/stock.tsx`, this file's ticks.
Scenarios: Orders board › More active orders than one page (no note while every active order is shown, also after a status change).
Failing tests: `src/orders-status.test.tsx` › "an order that leaves the board takes its count with it: no note of orders not shown"; `src/order-sheet.test.tsx` › "a cancel that takes the order off the board takes its count with it: no note of orders not shown".
- [x] 3b.1 `patches/3b.1-board-total-tests.diff` (`test: an order leaving the board takes its count with it`); `2 failed | 322 passed (324)`
- [x] 3b.2 `patches/3b.2-board-total-fix.diff` (`fix: a status change moves the board's total with its items`); `324 passed (324)`; every gate green

## 5. Against core and the rider service (the manager's e2e slot)
Waits on: tasks 1 to 4 landed and reviewed, the e2e slot (D35), and core's seed giving SS-DEMOAAAB the rider "Arjun Rao" (design.md "Requests").
Scope: `apps/admin/e2e/*.spec.ts` (fixes only, after a recorded failure), this file's ticks, the lane log.
Scenarios: Riders against the rider service; Orders against core › both; End-to-end suite with axe › both; Core reached through a same-origin proxy › Preview proxies to the rider service.
- [ ] 5.1 (after 3b) The manager runs `make e2e` (admin expected 15: today's 14 + `riders.spec.ts`) and `curl -s http://localhost:15174/api/rider/v1/healthz` while the preview runs, then walks `/riders` (admin and store staff, 390 px too), the board and a stacked cancel dialog in Chromium against core, rider and the demo seeds. A failure is recorded first and fixed by a worker with `fix:`, never by weakening an assertion.

## Workflow follow-up
- Team lead runs `/opsx:verify admin-riders` after task 5: every scenario in design.md "Tests" has a passing test, every task ticked, nothing extra in `git diff origin/main...HEAD` (the `patches/` folder is part of the change).
- Area manager archives the change by PR after the feature merges.
