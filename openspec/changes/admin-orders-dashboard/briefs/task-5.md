# Worker brief: admin-P2-L5 task 5, the dashboard

- LANE-ID: admin-P2-L5 (worker log: `.claude/lanes/admin-P2-L5-T5.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L5` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L5-admin-orders-dashboard` (commit here; never push)
- OpenSpec change: `admin-orders-dashboard`, task 5 in `openspec/changes/admin-orders-dashboard/tasks.md`
- Starts after: task 4 landed and reviewed

## Read first
1. `openspec/changes/admin-orders-dashboard/tasks.md`, the header and section 5.
2. `openspec/changes/admin-orders-dashboard/design.md`, section "Task 5" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-orders-dashboard/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/dashboard.test.tsx` (new)
- `apps/admin/src/routes/_staff/index.tsx` (replace the placeholder)
- `openspec/changes/admin-orders-dashboard/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L5-T5.md` (your log)

## Scenarios covered
- Dashboard › Dashboard cards, Dashboard links, Store staff dashboard
- Dashboard states › Dashboard loading, Dashboard load failure, Failed refresh keeps the dashboard, No stores on the dashboard

## Failing tests to start from
`apps/admin/src/dashboard.test.tsx`:
- "an admin sees a card per store in core's order, with today's orders by status and in all, revenue and the low-stock count"
- "a card links to its store's orders and to its stock filtered to low stock"
- "store staff see the one card core gives them, for their own store"
- "the dashboard shows a skeleton while loading"
- "a dashboard that cannot be loaded offers a retry that reloads"
- "a failed refresh keeps the cards and says it could not refresh; the next good answer clears the notice and shows the new numbers"
- "an admin with no stores is told to create one"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
0. Run `npm run test --workspace apps/admin -- --run` and note the summary: expected `221 passed (221)` (base + 61).
1. Create `src/dashboard.test.tsx` from design.md. Run the admin tests, see the seven fail, record the summary and the names. Commit: `test: dashboard cards`. Tick 5.1.
2. Replace `src/routes/_staff/index.tsx` whole with its block from design.md.
3. Run the gates. Commit the file and the 5.2 tick: `feat: dashboard cards per store with links to orders and low stock`.

## Expected counts (measured by the team lead in the spike; base 160 = the admin suite with admin-stock at d106b53)
- After step 1: `Tests  7 failed | 221 passed (228)`, all seven in `dashboard.test.tsx`.
- After step 2: `Tests  228 passed (228)`, 22 files. `make test-web` in the spike: ui 54, admin 228, web 91.
If the base differs from 160, every number above moves by the same difference; anything else that differs is a stop.

## Notes for this task
- The link to `/stock` is typed: `search={{ store: store.storeId, lowStock: true }}`. If typecheck refuses it, `/stock` on this branch does not have admin-stock's search params: stop and report, do not cast.
- The `<dl>` holds `dt` and `dd` directly, no wrapping `div`s (axe's `definition-list` rule).
- The page keeps its `PageHeader title="Dashboard"`: `e2e/auth.spec.ts`, `src/shell.test.tsx` and `src/sign-in.test.tsx` look for that heading and are not edited.
- The dashboard has no `refetchInterval`.

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
