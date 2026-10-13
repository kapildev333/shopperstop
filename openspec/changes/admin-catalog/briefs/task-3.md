# Worker brief: admin-P2-L3 task 3, product form: create and change

- LANE-ID: admin-P2-L3 (worker log: `.claude/lanes/admin-P2-L3-T3.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L3` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L3-admin-catalog` (commit here; never push)
- OpenSpec change: `admin-catalog`, task 3 in `openspec/changes/admin-catalog/tasks.md`
- Starts after: task 2 landed and reviewed

## Read first
1. `openspec/changes/admin-catalog/tasks.md`, the header and section 3.
2. `openspec/changes/admin-catalog/design.md`, section "Task 3" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-catalog/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/product-form.test.tsx` (new)
- `apps/admin/src/product-form.tsx` (new)
- `apps/admin/src/routes/_staff/_admin/products/new.tsx` (overwrite the placeholder)
- `apps/admin/src/routes/_staff/_admin/products/$productId.tsx` (overwrite the placeholder with the task-3 block)
- `openspec/changes/admin-catalog/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L3-T3.md` (your log)

## Scenarios covered
- Product create › Create a product
- Product change › Change sends only the changed fields; A second product save sends only its own change; Saved product shows in the table
- Unknown product shows not found › Unknown product
- Product form errors › Amount the form cannot send; Product field error from core; Other product save failure

## Failing tests to start from
`apps/admin/src/product-form.test.tsx`:
- "create a product and open it"
- "edit sends only the changed fields and confirms"
- "a value the form cannot send is flagged without a request"
- "a validation error from core is shown on its field"
- "any other product save error shows a banner"
- "an unknown product shows not found"
- "a second product save sends only its own change"
- "the products table shows a saved change"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
1. Create `src/product-form.test.tsx` from design.md. Run the admin tests, see the eight fail, record them. Commit: `test: product create and change`. Tick 3.1.
2. Create `src/product-form.tsx`; overwrite `products/new.tsx` and `products/$productId.tsx` with the task-3 blocks from design.md.
3. Run the gates. `src/routeTree.gen.ts` must be unchanged. Commit with the 3.2 tick: `feat: product create and change`.

## Expected counts (measured on this branch by the team lead)
- After the `test:` commit: `npm run test --workspace apps/admin -- --run` ends with `Tests  8 failed | 68 passed (76)`. Paste the summary and the failing test names in your lane log.
- After the code: `Tests  76 passed (76)`.
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
- The task-3 `$productId.tsx` has no `DeleteProduct` and no `ImageUpload`; tasks 4 and 5 add them. Use the block under "Task 3", not the later ones.
- `toCents` and `toRupees` are imported from `./stores`. Do not copy or move them.
- Keep `queryClient.setQueryData(...)` in `onSuccess` and keep `changed()` diffing against `parse(initial(product))`: two tests guard exactly these.
- Do not add a client-side "price at most MRP" check: core answers 400 on `priceCents` and the form shows it on the field.
- A block that does not compile, a count that differs, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
