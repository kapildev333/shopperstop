# admin-P3-L1-T1 - admin-riders task 1: ui swaps and the stacked cancel dialog (e2e written first) (worker brief)

- LANE-ID: admin-P3-L1, area `admin`, OpenSpec change `admin-riders`, task 1 in `openspec/changes/admin-riders/tasks.md`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1`, branch `lane/admin-P3-L1-riders`
- Waits on: nothing (ui-P3-L1 is on main)

## Read first
`tasks.md` header and section 1; `design.md` "How the code is handed over" and decisions 12 and 13; the delta `specs/admin-app/spec.md` "Order cancel with a reason".

## Scope (touch nothing else)
`apps/admin/e2e/riders.spec.ts` (new), `apps/admin/e2e/orders.spec.ts`, `apps/admin/e2e/auth.spec.ts`, `apps/admin/e2e/staff.spec.ts`, `apps/admin/e2e/stores.spec.ts`, `apps/admin/src/order-sheet.test.tsx`, `apps/admin/src/order-sheet.tsx`, `apps/admin/src/image.tsx`, `apps/admin/src/idle.ts` (deleted), `apps/admin/src/order-board.tsx`, `apps/admin/src/order-history.tsx`, `apps/admin/src/staff-dialog.tsx`, `apps/admin/src/routes/_staff/stock.tsx`, `apps/admin/src/routes/_staff/_admin/categories.tsx`, `apps/admin/src/routes/_staff/_admin/products/index.tsx`, `tasks.md` ticks 1.1 to 1.4, this file.

## Scenarios
Order cancel with a reason › Order cancelled, Reason missing, Keep order. The e2e scenarios (Riders against the rider service, Orders against core, nav) are written here and run in task 5.

## Failing tests to start from
`apps/admin/src/order-sheet.test.tsx`: "a cancel needs a reason: without one nothing is sent, the field says so, and the message goes when a reason is typed", "Keep order and Escape close only the dialog, without sending, and the keyboard is back on the sheet", "a cancel sends the reason as the note once, takes the order off the board and shows it cancelled with the reason".

## Commits, in this order
0. Record the base: `Tests  295 passed (295)`.
1. `git apply …/patches/1.1-e2e-specs.diff`. `npm run lint --workspace apps/admin` and `npm run typecheck --workspace apps/admin` pass. Do not run the specs. Tick 1.1. Commit `test: riders, the seeded order's rider and the dashboard's Open against the services`.
2. `git apply …/patches/1.2-sheet-tests.diff`. Expect `Tests  3 failed | 292 passed (295)`, the three tests above. Tick 1.2. Commit `test: the cancel dialog opens over the order sheet`.
3. `git apply …/patches/1.3-sheet-code.diff`. Expect `Tests  295 passed (295)`. Gates. Tick 1.3. Commit `feat: the cancel dialog stacks over the order sheet; the keyboard lands on the result`.
4. `git apply …/patches/1.4-ui-swaps.diff` (it deletes `src/idle.ts`). Expect `Tests  295 passed (295)`. Gates. Tick 1.4. Commit `refactor: ui's ImageTile, aria-disabled styling, VisuallyHidden live and compact order buttons`. There is no new test for this step: the existing tests pin the behaviour (design.md decision 13).

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
