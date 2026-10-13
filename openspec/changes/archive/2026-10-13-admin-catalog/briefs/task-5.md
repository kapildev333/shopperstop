# Worker brief: admin-P2-L3 task 5, product delete with "Deactivate instead"

- LANE-ID: admin-P2-L3 (worker log: `.claude/lanes/admin-P2-L3-T5.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L3` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L3-admin-catalog` (commit here; never push)
- OpenSpec change: `admin-catalog`, task 5 in `openspec/changes/admin-catalog/tasks.md`
- Starts after: task 4 landed and reviewed

## Read first
1. `openspec/changes/admin-catalog/tasks.md`, the header and section 5.
2. `openspec/changes/admin-catalog/design.md`, section "Task 5" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-catalog/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/product-delete.test.tsx` (new)
- `apps/admin/src/routes/_staff/_admin/products/$productId.tsx` (add `DeleteProduct`, its imports, and the `PageHeader` `actions` prop)
- `openspec/changes/admin-catalog/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L3-T5.md` (your log)

## Scenarios covered
- Product delete › Delete a product after confirming
- Ordered product is deactivated instead › Ordered product is deactivated instead

## Failing tests to start from
`apps/admin/src/product-delete.test.tsx`:
- "delete asks first, then removes the product"
- "an ordered product offers to deactivate instead"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
1. Create `src/product-delete.test.tsx` from design.md. Run the admin tests, see the two fail, record them. Commit: `test: product delete with deactivate instead`. Tick 5.1.
2. Bring `products/$productId.tsx` to the task-5 block in design.md: the `DeleteProduct` function, the widened imports, and `actions={<DeleteProduct product={product.data} />}` on the `PageHeader`. If a review changed the file after task 4, keep that change and add only these three things.
3. Run the gates. `src/routeTree.gen.ts` must be unchanged. Commit with the 5.2 tick: `feat: product delete with deactivate instead`.

## Expected counts (measured on this branch by the team lead)
- After the `test:` commit: `npm run test --workspace apps/admin -- --run` ends with `Tests  2 failed | 82 passed (84)`. Paste the summary and the failing test names in your lane log.
- After the code: `Tests  84 passed (84)`.
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
- `DialogFooter` renders Cancel first; pass only the one action button as its child.
- After a 409 the dialog shows "Deactivate instead" in place of "Delete"; it sends `PATCH` with exactly `{ isActive: false }` and then opens `/products`.
- `close()` resets both mutations so a reopened dialog starts clean.
- A block that does not compile, a count that differs, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
