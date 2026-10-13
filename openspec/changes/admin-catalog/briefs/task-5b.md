# Worker brief: admin-P2-L3 task 5b, follow-ups from the reviews of tasks 1 to 5

- LANE-ID: admin-P2-L3 (worker log: `.claude/lanes/admin-P2-L3-T5b.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L3` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L3-admin-catalog` (commit here; never push)
- OpenSpec change: `admin-catalog`, task 5b in `openspec/changes/admin-catalog/tasks.md`
- Starts after: task 5 landed and reviewed, and the manager says the worktree is free (no `make e2e` running in it)

## Read first
1. `openspec/changes/admin-catalog/tasks.md`, the header and section 5b.
2. `openspec/changes/admin-catalog/design.md`, section "Task 5b" under "Code and tests per task". Every test and every code file you write is there; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-catalog/specs/admin-app/spec.md`, the scenarios listed below.

Unlike tasks 1 to 5, this task was **not built by the team lead**: it was written by reading the code. The counts below are expected, not measured. That makes the stop rule matter more: the first thing that does not match (a block that does not compile, a lint error, a test that is red when it should be green or green when it should be red, a different count), stop, write it under `## Blockers` in your log with the full Vitest or tsc output, and report. Do not repair a test or the code yourself.

## Scope paths (touch nothing else)
- `apps/admin/src/products.test.tsx`, `apps/admin/src/categories.test.tsx`, `apps/admin/src/product-form.test.tsx`, `apps/admin/src/product-delete.test.tsx`, `apps/admin/src/image.test.tsx` (tests appended; the small edits design.md names)
- `apps/admin/src/categories.tsx`, `apps/admin/src/product-form.tsx`, `apps/admin/src/image.tsx`, `apps/admin/src/routes/_staff/_admin/products/$productId.tsx` (overwrite each with its whole-file block)
- `openspec/changes/admin-catalog/tasks.md` (tick only 5b.1, 5b.2, 5b.3)
- `.claude/lanes/admin-P2-L3-T5b.md` (your log)

## Scenarios covered
Already built in tasks 1 to 5, test missing (group A):
- Category create › Create a top-level category
- Category delete › Category in use (the dialog stays open, exactly one `DELETE`)
- Products search and filters › Filter changed on a later page
- Products pager › Pager (the request for `page` 1 on "Previous")
- Product form errors › Product create failure
- Product delete › Other delete failure

Built in this task (group B):
- Catalog field errors clear on edit › Sort order error clears on edit; Category field error from core clears on edit; Amount error clears on edit
- Product form shows the saved product › Saved product shown as core stored it
- Products reload after a delete or a deactivate › Products table after a delete; Deactivated product after returning
- Image upload in progress › Pick while an upload is pending

## Failing tests to start from (group B)
- `apps/admin/src/product-delete.test.tsx`: "after a delete the products table loads afresh", "after deactivate instead the table and the product show it inactive"
- `apps/admin/src/product-form.test.tsx`: "after a save the form shows the product as core stored it", "an amount error clears when its field is edited"
- `apps/admin/src/categories.test.tsx`: "a field error from core clears when its field is edited", "a sort order error clears when the field is edited"
- `apps/admin/src/image.test.tsx`: "a pick while an upload is pending is ignored and the field stays enabled"

## Tests that pass at once (group A): expected, not a test-first violation
"a filter changed on a later page asks for the first page", "create a top-level category sends no parent", "a failing create shows a banner and stays on the new page", "any other delete failure shows a banner in the dialog", and the added assertions in "the pager moves between pages" and "a category in use cannot be deleted". Tasks 1 to 5 built this behaviour; the reviews found it had no test. These tests are green the moment they exist and no code commit follows for them. Say so in your log, so the reviewer does not read commit 1 as a missing red step. If one of them is red, that is a finding: stop and report it, do not change the test or the code.

## Steps, in this order
Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` and run it from the worktree root. If `node_modules` is missing, run `npm ci` once. Run `npm run build --workspace packages/ui` once before the first test run. The test command is `npm run test --workspace apps/admin -- --run`.
1. Run the tests before you change anything: `Tests  84 passed (84)`. Anything else: stop.
2. Group A: make the edits A1 to A4 from design.md (two edits in existing tests, four tests appended). Run the tests: all green. Tick 5b.1 with the Edit tool. Commit: `test: catalog review test gaps`.
3. Group B: make the edits B1 to B4 from design.md (the `banana` import, the trimming line in `keepsProduct`, seven tests appended). Run the tests: exactly the seven tests above are red, each at the place design.md names. Paste the summary and the seven names in your log. Tick 5b.2. Commit: `test: catalog review follow-ups`.
4. Code: overwrite the four files with their whole-file blocks from design.md. Before overwriting each, check that the file in the worktree differs from the block only in the lines the block's heading names; if it differs anywhere else, stop.
5. Run the tests: all green. Run the gates. `src/routeTree.gen.ts` must be unchanged. Tick 5b.3. Commit: `fix: catalog review follow-ups`.

Tick the boxes with the Edit tool (`- [ ]` to `- [x]`); on macOS `sed -i` needs a different form and has broken this file before, do not use it.

## Expected counts (expected by the team lead from reading the code, not measured)
- Before any change: `Tests  84 passed (84)`, `Test Files  14 passed (14)` (measured after task 5).
- After step 2: `Tests  88 passed (88)`.
- After step 3: `Tests  7 failed | 88 passed (95)`, `Test Files  4 failed | 10 passed (14)`.
- After step 4: `Tests  95 passed (95)`, `Test Files  14 passed (14)`.
- `make test-web`: exit 0, ui 54, admin 95, web 20.
A different count means stop and report; do not edit a test to make it pass.

## Gates before the `fix:` commit
1. `make test-web` exits 0 (ui, admin and web: lint, typecheck, test, build).
2. `git status --short` lists only files in your scope; `src/routeTree.gen.ts` is not among them.
3. `openspec validate admin-catalog --type change --strict` says valid.
Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. The manager holds the e2e slot.

## Rules
- Commit order is fixed: `test: catalog review test gaps` (green), `test: catalog review follow-ups` (seven red), `fix: catalog review follow-ups` (the code and the 5b.3 tick, every gate green). Commit identity is the repo git config; no attribution or co-author lines.
- Never edit `src/routeTree.gen.ts` by hand.
- Colours only from the semantic tokens; components only from `@shopperstop/ui`; no new dependency; no `package.json` change.
- The `…` in "Uploading the image…" is one character (U+2026). Copy it from design.md into the test and the code; three dots make the test fail.
- In `$productId.tsx` keep `removeQueries` with `type: 'inactive'` exactly as given. Do not swap it for `invalidateQueries` and do not drop the `type`: design.md Decision 15 says why.
- `key={product.data.id}` on `ImageUpload` has no test on purpose (design.md Decision 19); add none.
- What the reviews raised and this task leaves out is listed under design.md "Accepted ceilings". Fix none of it, even where it looks like one line.

## Report
The three commit hashes, the four Vitest summaries (84, 88, 7 failed of 95, 95), the names and failure lines of the seven red tests, the `make test-web` exit code, `git status --short`, and anything you found.
