# Worker brief: admin-P2-L7 task 1, a failed refetch keeps the showing admin page

- LANE-ID: admin-P2-L7 (worker log: `.claude/lanes/admin-P2-L7-T1.md`, format in `.claude/lanes/README.md`)
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L7` (work only here, never the root checkout)
- Branch: `lane/admin-P2-L7-keep-data-on-refetch-error` (commit here; never push)
- OpenSpec change: `admin-keep-data-on-refetch-error`, task 1 in `openspec/changes/admin-keep-data-on-refetch-error/tasks.md`

## Read first
1. `openspec/changes/admin-keep-data-on-refetch-error/tasks.md`.
2. `openspec/changes/admin-keep-data-on-refetch-error/design.md`: "The rule, in two parts", then "Code and tests, verbatim". Every block you write is there in full; copy it byte for byte. Do not redesign, rename, reformat or "improve" it.
3. `openspec/changes/admin-keep-data-on-refetch-error/specs/admin-app/spec.md`.

## Scope paths (touch nothing else)
- `apps/admin/src/refetch.test.tsx` (new file, the NEW FILE block)
- `apps/admin/src/refetch-notice.tsx` (new file, the NEW FILE block)
- `apps/admin/src/routes/__root.tsx` (EDIT 1, 2)
- `apps/admin/src/routes/_staff/_admin/stores/index.tsx` (EDIT 3)
- `apps/admin/src/routes/_staff/_admin/stores/$storeId.tsx` (EDIT 4)
- `apps/admin/src/routes/_staff/_admin/products/index.tsx` (EDIT 5)
- `apps/admin/src/routes/_staff/_admin/products/$productId.tsx` (EDIT 6)
- `apps/admin/src/routes/_staff/_admin/products/new.tsx` (EDIT 7)
- `apps/admin/src/routes/_staff/_admin/categories.tsx` (EDIT 8)
- `apps/admin/src/service-areas.tsx` (EDIT 9)
- `apps/admin/src/routes/_staff/stock.tsx` (EDIT 10, 11, 12)
- `openspec/changes/admin-keep-data-on-refetch-error/tasks.md` (tick only boxes 1.1 and 1.2, with the Edit tool)
- `.claude/lanes/admin-P2-L7-T1.md` (your log)

Do NOT edit `src/fake-core.ts`, `src/api.ts`, `src/router.ts`, `src/routeTree.gen.ts`, any existing test, anything under `e2e/`, `packages/ui` or `apps/web`.

## Scenarios covered
All 17 of the delta:
- Admin pages keep data when a refetch fails › Table kept; Store page and its form kept; Product page and its form kept; New product form kept; Stock and its unsaved quantity kept; Store staff stock kept; Category save whose reload fails; First load failure still alerts; Pincodes fail on the first load; Next stock page fails on its first load
- Refetch failure notice › Notice shown once and cleared; Notice leaves with the page; No notice on a first load failure
- Deleted or forbidden on a refetch › Store deleted elsewhere; Product deleted elsewhere; Forbidden on a refetch
- Saved stock shown when its reload fails › Save, then the reload fails

## Failing tests to start from (`apps/admin/src/refetch.test.tsx`)
Red on arrival, 11:
- "a failed refetch keeps the table of /stores", "… of /products", "… of /categories"
- "a failed refetch keeps the store page, what was typed in its form and the unsaved pincodes"
- "a failed refetch keeps the product page and what was typed in its form"
- "a failed refetch keeps the new product form and what was typed in it"
- "a failed refetch keeps the stock table and the unsaved quantity"
- "a failed refetch keeps the stock and the store name of store staff"
- "a save whose reload fails shows the saved quantity, "Stock saved." and the notice"
- "a category save whose reload fails closes the dialog and keeps the table with the notice"
- "the notice leaves with the page it was about"

Green on arrival, 8 pins: the two "deleted elsewhere" runs, "a 403 on a refetch …", the three "a first load of … that fails …" runs, "the pincodes failing on the first load …", "a page of stock that fails on its first load …".

## Steps, in order
Every command from the worktree root with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` in front.

0. `git status --short` is empty; `npm ci` if `node_modules` is missing; `npm run build --workspace packages/ui`; `npm run test --workspace apps/admin -- --run` prints `Tests  160 passed (160)`. If not, stop and report.
1. Create `apps/admin/src/refetch.test.tsx` from the NEW FILE block.
2. `npm run test --workspace apps/admin -- --run` prints `Tests  11 failed | 168 passed (179)`, and the 11 are the ones listed above. `npm run lint --workspace apps/admin` and `npm run typecheck --workspace apps/admin` pass. Paste the Vitest summary into your lane log.
3. Tick 1.1 in tasks.md (Edit tool). Commit both files:
   `test: a failed refetch keeps the showing admin page`
   Body: `11 red (the page's content is replaced by its alert), 8 pins green on arrival (not found and 403 on a refetch, first-load failures).`
4. Create `apps/admin/src/refetch-notice.tsx` from the NEW FILE block.
5. Apply EDIT 1 to EDIT 12 in order. For each: the "Replace" text occurs exactly once in the named file; replace it with the "With" text. If it occurs zero or several times, stop and report.
6. `npm run test --workspace apps/admin -- --run` prints `Tests  179 passed (179)`.
7. Gates: `make test-web` exits 0 with ui `54 passed`, admin `179 passed`, web `91 passed`; `git status --short` lists only scope files and no `src/routeTree.gen.ts`; `openspec validate admin-keep-data-on-refetch-error --type change --strict` is valid. Paste the three summaries into your lane log.
8. Tick 1.2 in tasks.md (Edit tool). Commit:
   `fix: a failed refetch keeps the showing admin page`
9. Set your lane log to `Status: done` and report: the two commit hashes, the Vitest summaries of steps 2 and 6, the `make test-web` counts, anything that differed.

## Rules
- Test first: the `test:` commit must exist before any file of step 4 or 5 is written.
- Never amend a commit; a correction is a new commit. No attribution or co-author trailers. Commit as the repository's configured author. Never push.
- Never run `make e2e`, Playwright, `make db`, `make dev`, `make prod-local` or any docker command.
- No new dependency, no new helper, no change of copy, class names or imports beyond the blocks.
- No real or fake timers in tests; nothing is added to the test file.
- Any open design choice, any count that differs, any block that does not fit: stop and report; do not decide.
