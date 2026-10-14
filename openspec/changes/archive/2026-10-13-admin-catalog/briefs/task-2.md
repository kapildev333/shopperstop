# Worker brief: admin-P2-L3 task 2, categories page

- LANE-ID: admin-P2-L3 (worker log: `.claude/lanes/admin-P2-L3-T2.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L3` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L3-admin-catalog` (commit here; never push)
- OpenSpec change: `admin-catalog`, task 2 in `openspec/changes/admin-catalog/tasks.md`
- Starts after: task 1 landed and reviewed

## Read first
1. `openspec/changes/admin-catalog/tasks.md`, the header and section 2.
2. `openspec/changes/admin-catalog/design.md`, section "Task 2" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-catalog/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/categories.test.tsx` (new)
- `apps/admin/src/categories.tsx` (new: the task-2 block)
- `apps/admin/src/routes/_staff/_admin/categories.tsx` (replace the placeholder)
- `openspec/changes/admin-catalog/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L3-T2.md` (your log)

## Scenarios covered
- Categories table › Categories listed
- Categories table states › No categories; Categories load failure
- Category create › Create a child category
- Category change › Change sends only the changed fields and reorders the tree
- Category form errors › Sort order the form cannot send; Category field error from core; Other category save failure
- Category delete › Delete a category after confirming; Category in use

## Failing tests to start from
`apps/admin/src/categories.test.tsx`:
- "the categories table lists parents, each followed by its children"
- "no categories shows the empty state"
- "categories load failure shows a retry that reloads"
- "create a child category"
- "a change sends only the changed fields and reorders the tree"
- "a sort order the form cannot send is flagged without a request"
- "a validation error from core is shown on its field"
- "any other category save error shows a banner"
- "delete asks first, then removes the category"
- "a category in use cannot be deleted"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
1. Create `src/categories.test.tsx` from design.md. Run the admin tests, see the ten fail, record them. Commit: `test: categories page`. Tick 2.1.
2. Create `src/categories.tsx` (the task-2 block) and overwrite the route `categories.tsx`, both from design.md.
3. Run the gates. `src/routeTree.gen.ts` must be unchanged. Commit with the 2.2 tick: `feat: categories table, create, change and delete`.

## Expected counts (measured on this branch by the team lead)
- After the `test:` commit: `npm run test --workspace apps/admin -- --run` ends with `Tests  10 failed | 58 passed (68)`. Paste the summary and the failing test names in your lane log.
- After the code: `Tests  68 passed (68)`.
A different count means stop and report; do not edit a test to make it pass.

## Gates before the `feat:` commit
1. `make test-web` exits 0 (ui, admin and web: lint, typecheck, test, build).
2. `git status --short` lists only files in your scope.
3. `openspec validate admin-catalog --type change --strict` says valid.
Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. The manager holds the e2e slot.

## Rules
- Commit order is fixed: `test:` commit(s) first with the tests failing, then one `feat:` commit with the code and the ticks in tasks.md. Commit identity is the repo git config; no attribution or co-author lines.
- Never edit `src/routeTree.gen.ts` by hand; `npm run build --workspace apps/admin` (part of `make test-web`) writes it.
- Colours only from the semantic tokens; components only from `@shopperstop/ui`; no new dependency; no `package.json` change.
- The task-2 `src/categories.tsx` has no `ImageUpload` import and no image line in the dialog. Task 4 adds them; `ImageUpload` does not exist yet.
- Two files are named `categories.tsx`: `src/categories.tsx` (the dialogs) and the route under `src/routes/_staff/_admin/`. Do not mix them up.
- Both mutations must keep `await queryClient.invalidateQueries(...)` before `onClose()`: the table reorders from core's answer.
- A block that does not compile, a count that differs, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
