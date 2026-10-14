# Worker brief: admin-P2-L5 task 2, status actions

- LANE-ID: admin-P2-L5 (worker log: `.claude/lanes/admin-P2-L5-T2.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L5` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L5-admin-orders-dashboard` (commit here; never push)
- OpenSpec change: `admin-orders-dashboard`, task 2 in `openspec/changes/admin-orders-dashboard/tasks.md`
- Starts after: task 1 landed and reviewed

## Read first
1. `openspec/changes/admin-orders-dashboard/tasks.md`, the header and section 2.
2. `openspec/changes/admin-orders-dashboard/design.md`, section "Task 2" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-orders-dashboard/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/orders-status.test.tsx` (new)
- `apps/admin/src/idle.ts` (new)
- `apps/admin/src/orders.ts` and `apps/admin/src/order-board.tsx` (both replaced whole by their task-2 block)
- `openspec/changes/admin-orders-dashboard/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L5-T2.md` (your log)

## Scenarios covered
- Order next status › One button per card, Accept
- Order status change in progress › Second press during a change, Focus after a move
- Order delivered asks first › Mark delivered
- Order status conflict › Accepted by someone else, Cancelled by the customer
- Order status failure › Status change fails, Conflict that cannot be read
- Order status change and a poll in the air › Late poll answer

## Failing tests to start from
`apps/admin/src/orders-status.test.tsx`:
- "each card has one button, for the next status of its order, named with the order number"
- "a press sends the next status once, moves the card with core's answer and says so, without listing the orders again"
- "while a status change runs the pressed button reads Saving…, keeps focus and is never disabled; a second press and another card's button send nothing"
- "after a move the keyboard is on the card's new button"
- "Mark delivered asks first: Cancel sends nothing, confirming takes the order off the board and the keyboard goes to the result"
- "a 409 reads the order again, shows it where it stands and says someone else changed it"
- "a status change that fails says so, leaves the card where it is and can be tried again"
- "a 409 whose order cannot be read again is a failed status change"
- "a poll answer read before a status change never moves the card back"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `184 passed (184)` (base + 24).
1. Create `src/orders-status.test.tsx` from design.md. Run the admin tests, see the nine fail, record the summary and the names. Commit: `test: order status actions`. Tick 2.1.
2. Create `src/idle.ts`; replace `src/orders.ts` and `src/order-board.tsx` whole with their task-2 blocks from design.md.
3. Run the gates. Commit the three files and the 2.2 tick: `feat: next-status buttons with the 409 re-read and the delivered confirmation`.

## Expected counts (measured by the team lead in the spike; base 160 = the admin suite with admin-stock at d106b53)
- After step 1: `Tests  9 failed | 184 passed (193)`, all nine in `orders-status.test.tsx`.
- After step 2: `Tests  193 passed (193)`, 19 files.
If the base differs from 160, every number above moves by the same difference; anything else that differs is a stop.

## Notes for this task
- The next-status button is never `disabled` and never gets `loading`: it is `aria-disabled` with the `idle` class, and `advance` returns early while a change runs. Do not change this.
- The button's name comes from `aria-labelledby` (its own id and the number's id). Do not add an `aria-label` or a hidden copy of the number: a second "SS-…" text breaks task 1's tests.
- In `useSetStatus`, `await queryClient.cancelQueries(...)` comes before `setQueryData`: the order matters (the test "a poll answer read before a status change never moves the card back").
- A 409 resolves the mutation (it reads the order again); it does not throw. Only a failed re-read or another error throws.
- The card's number is still plain text in this task; it becomes a button in task 3. There is no sheet yet.
- `removeQueries` is not in this task's `src/orders.ts`; task 4 adds it with its test.

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
