# Worker brief: admin-P2-L5 task 5, the past-the-end fix (step A), then the dashboard (step B)

- LANE-ID: admin-P2-L5 (worker log: `.claude/lanes/admin-P2-L5-T5.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L5` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L5-admin-orders-dashboard` (commit here; never push)
- OpenSpec change: `admin-orders-dashboard`, task 5 in `openspec/changes/admin-orders-dashboard/tasks.md`
- Starts after: task 4 landed and reviewed (R4, approve with nits). The manager may rebase the branch onto main (admin-staff-e2e merged) first; both cases are counted below.

## Read first
1. `openspec/changes/admin-orders-dashboard/tasks.md`, the header and section 5.
2. `openspec/changes/admin-orders-dashboard/design.md`, Decisions 36 and 37, and section "Task 5" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-orders-dashboard/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/orders-history.test.tsx` (step A: one test appended at the end)
- `apps/admin/src/order-history.tsx` (step A: two hunks)
- `apps/admin/src/dashboard.test.tsx` (step B: new)
- `apps/admin/src/routes/_staff/index.tsx` (step B: replace the placeholder)
- `openspec/changes/admin-orders-dashboard/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L5-T5.md` (your log)

## Scenarios covered
- Step A: Orders URL values › Page past the end
- Step B: Dashboard › Dashboard cards, Dashboard links, Store staff dashboard; Dashboard states › Dashboard loading, Dashboard load failure, Failed refresh keeps the dashboard, No stores on the dashboard

## Failing tests to start from
Step A, `apps/admin/src/orders-history.test.tsx`:
- "a page past the end shows a skeleton, never the empty state, until the last page answers"

Step B, `apps/admin/src/dashboard.test.tsx`:
- "an admin sees a card per store in core's order, with today's orders by status and in all, revenue and the low-stock count"
- "a card links to its store's orders and to its stock filtered to low stock"
- "store staff see the one card core gives them, for their own store"
- "the dashboard shows a skeleton while loading"
- "a dashboard that cannot be loaded offers a retry that reloads"
- "a failed refresh keeps the cards; the next good answer shows the new numbers"
- "an admin with no stores is told to create one"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: `252 passed (252)` on the branch as task 4 left it, `287 passed (287)` if the manager rebased onto main first. Anything else: stop.
1. Append design.md's step-A test block to the end of `src/orders-history.test.tsx` (the block starts with one empty line). Run the admin tests, see the one fail (`Unable to find an accessible element with the role "status" and name "Loading"`), record the summary. Commit the test file: `test: a page past the end shows a skeleton until the last page answers`. Tick 5.1 in the same commit or the next, before step 2's code.
2. Apply design.md's step-A diff to `src/order-history.tsx`: two hunks, the `-` lines replaced by the `+` lines (Edit tool, or save the block to a file outside the repository and `git apply` it). Run the gates. Commit the file and the 5.2 tick: `fix: a page past the end is a skeleton, never the empty state`.
3. Create `src/dashboard.test.tsx` from design.md (step B). Run the admin tests, see the seven fail, record the summary and the names. Commit: `test: dashboard cards`. Tick 5.3.
4. Replace `src/routes/_staff/index.tsx` whole with its block from design.md (step B). Run the gates. Commit the file and the 5.4 tick: `feat: dashboard cards per store with links to orders and low stock`.

## Expected counts (measured by the team lead in the re-spike of 2026-10-15)
| After | Branch as task 4 left it | Rebased onto main (admin-staff-e2e) |
|---|---|---|
| step 0 | `252 passed (252)`, 22 files | `287 passed (287)`, 24 files |
| step 1 | `1 failed \| 252 passed (253)` | `1 failed \| 287 passed (288)` |
| step 2 | `253 passed (253)` | `288 passed (288)` |
| step 3 | `7 failed \| 253 passed (260)`, all seven in `dashboard.test.tsx` | `7 failed \| 288 passed (295)` |
| step 4 | `260 passed (260)`, 23 files | `295 passed (295)`, 25 files |
| `make test-web` after step 4 | exit 0, ui 54, admin 260, web 140 | exit 0, ui 54, admin 295, web 149 |

Any count other than these: stop.

## Notes for this task
- Step A's test holds core's list answers twice on purpose (`hold`, `release`, `hold` right after the first request): page 9 answers, the move to page 2 waits, and the test looks at the page in between. Do not change the order of those lines.
- The link to `/stock` is typed: `search={{ store: store.storeId, lowStock: true }}`. If typecheck refuses it, stop and report, do not cast.
- While it shows cards the page renders no level-2 heading but the store names: `e2e/orders.spec.ts` expects exactly the two. Do not add a section heading.
- The `<dl>` holds `dt` and `dd` directly, no wrapping `div`s (axe's `definition-list` rule).
- The page keeps its `PageHeader title="Dashboard"`: `e2e/auth.spec.ts`, `src/shell.test.tsx` and `src/sign-in.test.tsx` look for that heading and are not edited.
- The dashboard has no `refetchInterval`.
- No "Could not refresh" notice in the dashboard: the root's `RefetchNotice` shows it, and the failed-refresh test asserts that one.

## Gates before each `fix:`/`feat:` commit
1. `make test-web` exits 0 (ui, admin and web: lint, typecheck, test, build).
2. `git status --short` lists only files in your scope. `apps/admin/src/routeTree.gen.ts` must NOT be listed: this change never alters it. If it is listed, stop and report.
3. `openspec validate admin-orders-dashboard --type change --strict` says valid.
Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. The manager holds the e2e slot.

## Rules
- Commit order is fixed: step A `test:` then `fix:`, then step B `test:` then `feat:`; each `test:` commit with its tests failing. Commit identity is the repo git config; no attribution or co-author lines.
- Tick the boxes in `openspec/changes/admin-orders-dashboard/tasks.md` with the Edit tool (`- [ ]` to `- [x]`), only the boxes of this task.
- Colours only from the semantic tokens; components only from `@shopperstop/ui`; no new dependency; no `package.json` change. Do not import `lucide-react` (it is not an `apps/admin` dependency).
- Do not edit `apps/admin/src/fake-core.ts`, `apps/admin/src/orders-fake.ts` or any existing test (appending the one step-A test is not an edit of an existing one).
- A block that does not compile, a count that differs, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself, and never edit a test to make it pass.

## Report
The commit hashes, the four Vitest summaries (red, green, red, green), the `make test-web` exit code, `git status --short`, and anything you found.
