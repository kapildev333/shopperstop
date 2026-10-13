# Worker brief: admin-P2-L3 task 4, image upload

- LANE-ID: admin-P2-L3 (worker log: `.claude/lanes/admin-P2-L3-T4.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L3` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L3-admin-catalog` (commit here; never push)
- OpenSpec change: `admin-catalog`, task 4 in `openspec/changes/admin-catalog/tasks.md`
- Starts after: task 3 landed and reviewed

## Read first
1. `openspec/changes/admin-catalog/tasks.md`, the header and section 4.
2. `openspec/changes/admin-catalog/design.md`, section "Task 4" under "Code and tests per task". Every file you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-catalog/specs/admin-app/spec.md`, the scenarios listed below.

## Scope paths (touch nothing else)
- `apps/admin/src/image.test.tsx` (new)
- `apps/admin/src/image.tsx` (overwrite with the task-4 block: `ImageTile` unchanged, `ImageUpload` added)
- `apps/admin/src/categories.tsx` (add two lines)
- `apps/admin/src/routes/_staff/_admin/products/$productId.tsx` (add one import and one card)
- `openspec/changes/admin-catalog/tasks.md` (tick only this task's boxes)
- `.claude/lanes/admin-P2-L3-T4.md` (your log)

## Scenarios covered
- Catalog image upload › Product image uploaded; Category image uploaded from its dialog
- Image upload errors › File refused before upload; File refused by core; Other upload failure

## Failing tests to start from
`apps/admin/src/image.test.tsx`:
- "upload a product image shows the stored image"
- "a GIF is refused without a request" and "a PNG over 5 MB is refused without a request" (one `test.each`)
- "a file core refuses is flagged on the field"
- "any other upload failure shows a banner"
- "upload a category image from its dialog"

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run.
1. Create `src/image.test.tsx` from design.md. Run the admin tests, see the six fail, record them. Commit: `test: catalog image upload`. Tick 4.1.
2. Overwrite `src/image.tsx` with the task-4 block.
3. In `src/categories.tsx` add the import line and the `{category && <ImageUpload ... />}` line exactly where design.md task 4 says. Change nothing else in the file.
4. In `products/$productId.tsx` add the import and the second `<Card>` exactly where design.md task 4 says. The result must equal the "file after this task" block, unless a review changed the file after task 3; then keep that change.
5. Run the gates. `src/routeTree.gen.ts` must be unchanged. Commit with the 4.2 tick: `feat: catalog image upload`.

## Expected counts (measured on this branch by the team lead)
- After the `test:` commit: `npm run test --workspace apps/admin -- --run` ends with `Tests  6 failed | 76 passed (82)`. Paste the summary and the failing test names in your lane log.
- After the code: `Tests  82 passed (82)`.
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
- Do not import `lucide-react` (design.md Decision 14).
- Keep the cast `file as unknown as string` and the `bodySerializer` as written: the generated types call the binary part a string. Do not set a `Content-Type` header; the browser sets the multipart boundary.
- Keep the `version` counter (`?v=1`, `?v=2`) and `invalidateQueries({ queryKey: ['admin', kind] })`: tests guard both.
- The file input is a native `<input type="file">` inside `FormField`; do not swap it for the ui `Input`.
- A block that does not compile, a count that differs, or any choice design.md leaves open: stop, write it in your lane log under `## Blockers`, and report. Do not decide it yourself.

## Report
The commit hashes, the red and green Vitest summaries, the `make test-web` exit code, `git status --short`, and anything you found.
