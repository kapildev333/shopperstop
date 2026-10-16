# admin-P3-L1-T2 - admin-riders task 2: the rider on the card and the sheet (worker brief)

- LANE-ID: admin-P3-L1, area `admin`, OpenSpec change `admin-riders`, task 2
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1`, branch `lane/admin-P3-L1-riders`
- Waits on: task 1 landed (and reviewed). core-P3-L1 (`riderName`, `actorName`) is on main.

## Read first
`tasks.md` section 2; `design.md` decision 10; the delta's "Orders board" and "Order detail sheet".

## Scope
`apps/admin/src/orders-board.test.tsx`, `apps/admin/src/order-sheet.test.tsx`, `apps/admin/src/order-board.tsx`, `apps/admin/src/order-sheet.tsx`, `tasks.md` ticks 2.1 and 2.2, this file.

## Scenarios
Orders board › Rider on the card; Order detail sheet › Rider and rider events.

## Failing tests to start from
`src/orders-board.test.tsx` › "a card taken out by a rider names the rider; a card without one does not"; `src/order-sheet.test.tsx` › "the sheet names the order's rider, and the rider on the events the rider made".

## Commits, in this order
0. Base: `Tests  295 passed (295)`.
1. `git apply …/patches/2.1-rider-name-tests.diff`. Expect `Tests  2 failed | 295 passed (297)`. Tick 2.1. Commit `test: the rider's name on the card and the sheet`.
2. `git apply …/patches/2.2-rider-name-code.diff`. Expect `Tests  297 passed (297)`. Gates. Tick 2.2. Commit `feat: board cards and the order sheet name the rider`.

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
