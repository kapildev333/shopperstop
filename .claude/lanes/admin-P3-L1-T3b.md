# admin-P3-L1-T3b - admin-riders task 3b: the board's total after a status change (review fix R2-1, R1 nit 1) (worker brief)

- LANE-ID: admin-P3-L1, area `admin`, OpenSpec change `admin-riders`, task 3b in `openspec/changes/admin-riders/tasks.md`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1`, branch `lane/admin-P3-L1-riders`
- Waits on: tasks 1 to 4 landed (HEAD 752d935 or later, admin `322 passed (322)`)

## Read first
`tasks.md` section 3b; `.claude/lanes/admin-P3-L1-R2.md` finding 1; the delta's "Orders board" › More active orders than one page.

## Scope (touch nothing else)
`apps/admin/src/orders-status.test.tsx`, `apps/admin/src/order-sheet.test.tsx`, `apps/admin/src/orders.ts`, `apps/admin/src/routes/_staff/stock.tsx`, `tasks.md` ticks 3b.1 and 3b.2, this file.

## Scenario
Orders board › More active orders than one page: no "Showing the newest" note while the board shows every active order, also right after a delivery or a cancel.

## Failing tests to start from
`src/orders-status.test.tsx` › "an order that leaves the board takes its count with it: no note of orders not shown"; `src/order-sheet.test.tsx` › "a cancel that takes the order off the board takes its count with it: no note of orders not shown".

## Commits, in this order
0. Base: `Tests  322 passed (322)`.
1. `git apply openspec/changes/admin-riders/patches/3b.1-board-total-tests.diff`. Expect `Tests  2 failed | 322 passed (324)`, the two tests above. Tick 3b.1. Commit `test: an order leaving the board takes its count with it`.
2. `git apply openspec/changes/admin-riders/patches/3b.2-board-total-fix.diff`. It changes `useSetStatus` in `src/orders.ts` (`total: list.total + items.length - list.items.length`) and removes the double blank line after the imports in `src/routes/_staff/stock.tsx` (R1 nit 1). Expect `Tests  324 passed (324)`. Gates. Tick 3b.2. Commit `fix: a status change moves the board's total with its items`.

## Steps, rules and gates
- Work only in the worktree above. Never the root checkout, never `.worktrees/admin-P3-L1-review`, never push. Use absolute paths or `git -C <worktree>`; never a relative `cd ..`.
- Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`. If `node_modules` is missing run `npm ci` at the worktree root; run `npm run build --workspace packages/ui` once before the first test run.
- Apply the patches as they are; do not retype or reformat. A patch that does not apply cleanly, or any count that differs: stop.
- Commit identity is the repo's git config; no attribution or co-author lines. Tick boxes with the Edit tool, in the commit that does the box.
- Before the `fix:` commit: `make test-web` exits 0; `git status --short` lists only this task's files; `openspec validate admin-riders --strict` is valid.
- Never run `make e2e`, Playwright, `make db`, `make dev` or docker. Never edit a test to make it pass. Anything open: write it under `## Blockers` below and stop.
- Report the commit hashes, both Vitest summaries, the `make test-web` exit code and `git status --short`.

# Worker log
