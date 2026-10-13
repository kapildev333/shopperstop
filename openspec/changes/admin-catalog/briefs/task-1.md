# Worker brief: admin-P2-L3 task 1, products table (and the e2e spec written first)

- LANE-ID: admin-P2-L3 (worker log: `.claude/lanes/admin-P2-L3-T1.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L3` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L3-admin-catalog` (commit here; never push)
- OpenSpec change: `admin-catalog`, task 1 in `openspec/changes/admin-catalog/tasks.md`
- Starts after: task 0 (done by the team lead)

## Read first
1. `openspec/changes/admin-catalog/tasks.md`, the header and section 1.
2. `openspec/changes/admin-catalog/design.md`, section "Task 1" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-catalog/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/e2e/catalog.spec.ts` (new)
- `apps/admin/src/fake-core.ts` (two type aliases, fixtures appended; change nothing that is already there)
- `apps/admin/src/products.test.tsx` (new)
- `apps/admin/src/catalog.ts` (new)
- `apps/admin/src/image.tsx` (new: the task-1 block, `ImageTile` only)
- `apps/admin/src/routes/_staff/_admin/products/index.tsx` (replace the placeholder)
- `apps/admin/src/routes/_staff/_admin/products/new.tsx` and `apps/admin/src/routes/_staff/_admin/products/$productId.tsx` (new: the five-line placeholders)
- `apps/admin/src/routeTree.gen.ts` (generated)
- `openspec/changes/admin-catalog/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L3-T1.md` (your log)

## Scenarios covered
- Products table › Products listed
- Products search and filters › Search and filters from the first page
- Products pager › Pager
- Products table states › No products
- Products table states › Products loading
- Products table states › Products load failure
- Catalog against core › Admin runs the catalog, Store staff open the catalog pages: you only write the spec file; it is run in task 6

## Failing tests to start from
`apps/admin/src/products.test.tsx`:
- "products table lists a page of products"
- "search and filters ask core again from the first page"
- "the pager moves between pages"
- "no products shows the empty state"
- "products table shows a skeleton while loading"
- "products load failure shows a retry that reloads"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
1. Create `apps/admin/e2e/catalog.spec.ts` from design.md. Run `npm run lint --workspace apps/admin` and `npm run typecheck --workspace apps/admin`; both must pass. Do not run it. Commit: `test: catalog pages against core`. Tick 1.1.
2. Edit `src/fake-core.ts` (the two aliases and the appended fixtures) and create `src/products.test.tsx` from design.md. Run the admin tests, see the six fail, record them. Commit: `test: products table`. Tick 1.2.
3. Create `src/catalog.ts`, `src/image.tsx` (task-1 block), the two placeholders, and overwrite `products/index.tsx`, all from design.md.
4. Run `npm run build --workspace apps/admin` BEFORE typecheck: it regenerates `src/routeTree.gen.ts` with the two new routes. Typecheck fails on `products/new.tsx` until it has run.
5. Run the gates. Commit everything, with `routeTree.gen.ts` and the 1.3 tick: `feat: products table with search, filters and pager`.

## Expected counts (measured on this branch by the team lead)
- After the `test:` commit: `npm run test --workspace apps/admin -- --run` ends with `Tests  6 failed | 52 passed (58)`. Paste the summary and the failing test names in your lane log.
- After the code: `Tests  58 passed (58)`.
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
- `src/image.tsx` in this task holds only `ImageTile` and imports only `cn`. Do not import `lucide-react`: it is not an `apps/admin` dependency (design.md Decision 14).
- The fixture `tonedMilk` has no `description` on purpose. Do not add one.
- Do not build the real product form or page here; the two placeholders are replaced in task 3.
- A block that does not compile, a count that differs, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
