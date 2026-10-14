# Worker brief: admin-P2-L5 task 3, the detail sheet and the cancel with a reason

- LANE-ID: admin-P2-L5 (worker log: `.claude/lanes/admin-P2-L5-T3.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L5` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L5-admin-orders-dashboard` (commit here; never push)
- OpenSpec change: `admin-orders-dashboard`, task 3 in `openspec/changes/admin-orders-dashboard/tasks.md`
- Starts after: task 2 landed and reviewed

## Read first
1. `openspec/changes/admin-orders-dashboard/tasks.md`, the header and section 3.
2. `openspec/changes/admin-orders-dashboard/design.md`, section "Task 3" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-orders-dashboard/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/order-sheet.test.tsx` (new)
- `apps/admin/src/order-sheet.tsx` (new)
- `apps/admin/src/orders.ts` and `apps/admin/src/order-board.tsx` (both replaced whole by their task-3 block)
- `openspec/changes/admin-orders-dashboard/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L5-T3.md` (your log)

## Scenarios covered
- Order detail sheet › Order opened from its card, Sheet closed
- Order sheet follows core › Order changed since the last poll, Open sheet polled
- Orders kept on a failed refresh › Failed refresh keeps the sheet
- Order cancel with a reason › Cancel offered, Order cancelled, Reason missing, Keep order
- Order cancel in progress and refused › Second press during a cancel, Cancel fails, Cancel refused once packing
- Order status badges › Badge of an order under way and of a cancelled one

## Failing tests to start from
`apps/admin/src/order-sheet.test.tsx`:
- "a card's number opens the order: status, items, totals, customer with phone, address and events"
- "the sheet shows the order as core holds it, not as the card did: a second address line, no phone, a note"
- "an open sheet follows the order every 10 seconds"
- "a failed refresh keeps the order on the sheet and says it could not refresh"
- "only a placed or an accepted order can be cancelled from the sheet"
- "closing the sheet puts the keyboard back on the card"
- "a cancel needs a reason: without one nothing is sent, the field says so, and the message goes when a reason is typed"
- "Keep order and Escape close the dialog without sending and bring the sheet back"
- "a cancel sends the reason as the note once, takes the order off the board and shows it cancelled with the reason"
- "while a cancel runs the button reads Cancelling…, keeps focus and is never disabled; a second press sends nothing and the dialog stays"
- "a cancel that fails says so in the dialog, keeps the reason and can be tried again"
- "a cancel refused with 409 shows where the order stands instead, on the sheet and on the board"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `213 passed (213)` (base + 33).
1. Create `src/order-sheet.test.tsx` from design.md. Run the admin tests, see the twelve fail, record the summary and the names. Commit: `test: order detail sheet and cancel`. Tick 3.1.
2. Create `src/order-sheet.tsx`; replace `src/orders.ts` and `src/order-board.tsx` whole with their task-3 blocks from design.md.
3. Run the gates. Commit the three files and the 3.2 tick: `feat: order detail sheet with cancel and its reason`.

## Expected counts (measured by the team lead in the spike; base 180 = the admin suite on main with admin-stock and admin-P2-L7's fix at 0aa0ab1)
- After step 1: `Tests  12 failed | 213 passed (225)`, all twelve in `order-sheet.test.tsx`.
- After step 2: `Tests  225 passed (225)`, 21 files.
If the base differs from 180, every number above moves by the same difference; anything else that differs is a stop.

## Notes for this task
- The sheet and its dialog are never open together: `<Sheet open={!asking}>`. Do not render the `Dialog` inside the `Sheet`.
- The dialog's first button is "Keep order" (`cancelLabel`), then "Cancel order". Its button is `aria-disabled` with `idle` while the cancel runs, never `disabled` or `loading`; `closeDialog` returns early while it runs.
- The sheet carries the one notice this lane renders itself, worded like the root's ("Could not refresh. Showing what was loaded last."): the sheet is a modal over the root's notice. Keep it; add none elsewhere.
- The status badge takes its variant from `statusBadge` (D28: `accent`, `success`, `neutral`). Never `danger` or `warning` for a status.
- `orderQuery` in this task has `refetchInterval: pollMs`; task 4 changes that line with its test. `historyQuery`, `maxPage` and `removeQueries` are task 4 too.
- `show(order)` in the board writes the card's order into the order's query before opening the sheet; keep both lines.
- `src/order-board.tsx` of this task is its last version: no later task changes it.

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
