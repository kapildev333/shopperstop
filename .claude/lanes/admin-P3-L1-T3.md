# admin-P3-L1-T3 - admin-riders task 3: one active-orders poll; Open or Closed on the dashboard (worker brief)

- LANE-ID: admin-P3-L1, area `admin`, OpenSpec change `admin-riders`, task 3
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1`, branch `lane/admin-P3-L1-riders`
- Waits on: task 2 landed; core-P3-L2 on main (#215) and in the branch. Step 0 checks it.

## Read first
`tasks.md` section 3; `design.md` decisions 8, 9 and 11; the delta's "Orders board", "Orders board polling", "Orders board states", "Orders kept on a failed refresh", "Dashboard".

## Scope
`apps/admin/src/orders-fake.ts`, `apps/admin/src/orders-board.test.tsx`, `apps/admin/src/orders-status.test.tsx`, `apps/admin/src/order-sheet.test.tsx`, `apps/admin/src/dashboard.test.tsx`, `apps/admin/src/orders.ts`, `apps/admin/src/order-board.tsx`, `apps/admin/src/routes/_staff/index.tsx`, `tasks.md` ticks 3.1 and 3.2, this file.

## Scenarios
Orders board › Board listed, More active orders than one page; Orders board polling › Poll, Hidden tab, Board left; Orders board states › One list fails on the first load; Orders kept on a failed refresh › One list fails on a later poll; Dashboard › Open or closed.

## Failing tests to start from
The nine named in `tasks.md` section 3 (seven on the request count, "a store with more active orders than one page says how many the board shows", "each card says whether its store is open"). Two tests are rewritten and stay green throughout: "the one list failing on a later poll …" and "the one list failing on the first load …".

## Commits, in this order
0. Check `grep -n 'active?: "true"' packages/ui/src/api/core.d.ts` finds the parameter and `grep -n 'isOpen: boolean' packages/ui/src/api/core.d.ts` finds `DashboardStore.isOpen`. If either is missing, stop: the branch lacks core-P3-L2. Base: `Tests  297 passed (297)`.
1. `git apply …/patches/3.1-board-dashboard-tests.diff`. Expect `Tests  9 failed | 290 passed (299)`. Tick 3.1. Commit `test: one active-orders request per poll; Open or Closed on the dashboard`.
2. `git apply …/patches/3.2-board-dashboard-code.diff`. Expect `Tests  299 passed (299)`. Gates. Tick 3.2. Commit `feat: the board polls core's active orders in one request; dashboard cards say Open or Closed`.

## Steps, rules and gates
- Work only in `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1`, branch `lane/admin-P3-L1-riders`. Never the root checkout, never push. Use absolute paths or `git -C <worktree>`; never a relative `cd ..`.
- Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`. If `node_modules` is missing run `npm ci` at the worktree root; run `npm run build --workspace packages/ui` once before the first test run.
- Apply each patch from the worktree root with `git apply openspec/changes/admin-riders/patches/<name>.diff`. Do not retype, reformat or "improve" what it writes. A patch that does not apply cleanly: stop.
- After each patch, run `npm run test --workspace apps/admin -- --run` and compare the `Tests` line with the expected count. Record every summary in your log. Any other count: stop.
- Commit identity is the repo's git config; no attribution or co-author lines. Tick this task's boxes in `openspec/changes/admin-riders/tasks.md` with the Edit tool (`- [ ]` to `- [x]`), in the commit that does the box.
- Before each `feat:`/`refactor:` commit: `make test-web` exits 0; `git status --short` lists only this task's files; `openspec validate admin-riders --strict` is valid.
- Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. Never edit a test to make it pass. Any open design choice, failure or difference: write it under `## Blockers` in your log and stop.
- Keep your log in this file below `# Worker log` (format in `.claude/lanes/README.md`). Report the commit hashes, every Vitest summary, the `make test-web` exit code and `git status --short`.

# Worker log
