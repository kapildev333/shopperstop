# Tasks

One task, one worker, on branch `lane/admin-P2-L7-keep-data-on-refetch-error` in `.worktrees/admin-P2-L7`. Read design.md first: it fixes the rule, every file, every code block and every test name. The counts below were measured on this branch (base 6d9f7b3, admin Vitest `160 passed`) on 2026-10-13. A worker who finds a design choice still open, a "Replace" block that does not occur exactly once, or a count that differs, stops and reports. Brief: `briefs/task-1.md`.

Gates, from the worktree root, Node 22.12+ (D11), every command prefixed with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`. Quick loop: `npm run build --workspace packages/ui` once, then `npm run test --workspace apps/admin -- --run`. Before the `fix:` commit: `make test-web` (ui `54 passed`, admin `179 passed`, web `101 passed` on the rebased base (91 when first measured, before the rebase); ui and web unchanged by this change), `git status --short` shows only files of the task's scope and no `src/routeTree.gen.ts`, and `openspec validate admin-keep-data-on-refetch-error --type change --strict`. Workers never run `make e2e`, Playwright, `make db`, `make dev` or anything with docker.

Commits: `test:` with the failing tests, then `fix:` with the code, each with its tick in this file. Boxes are ticked with the Edit tool. No amended commits, no attribution trailers, never push.

## 1. A failed refetch keeps the showing admin page

Scope: `apps/admin/src/refetch.test.tsx` (new), `apps/admin/src/refetch-notice.tsx` (new), `apps/admin/src/routes/__root.tsx`, `apps/admin/src/routes/_staff/_admin/stores/index.tsx`, `apps/admin/src/routes/_staff/_admin/stores/$storeId.tsx`, `apps/admin/src/routes/_staff/_admin/products/index.tsx`, `apps/admin/src/routes/_staff/_admin/products/$productId.tsx`, `apps/admin/src/routes/_staff/_admin/products/new.tsx`, `apps/admin/src/routes/_staff/_admin/categories.tsx`, `apps/admin/src/service-areas.tsx`, `apps/admin/src/routes/_staff/stock.tsx`, this file's checkboxes, the worker's lane log `.claude/lanes/admin-P2-L7-T1.md`. Not in scope: every other file, among them `src/fake-core.ts`, `src/api.ts`, `src/router.ts`, every existing test, `e2e/`, `packages/ui`.

Scenarios: all 17 of the delta (Admin pages keep data when a refetch fails, 10; Refetch failure notice, 3; Deleted or forbidden on a refetch, 3; Saved stock shown when its reload fails, 1).

Failing tests, all in `src/refetch.test.tsx` (11 red on arrival, each because the content is gone):
- "a failed refetch keeps the table of %s" (3 runs: `/stores`, `/products`, `/categories`)
- "a failed refetch keeps the store page, what was typed in its form and the unsaved pincodes"
- "a failed refetch keeps the product page and what was typed in its form"
- "a failed refetch keeps the new product form and what was typed in it"
- "a failed refetch keeps the stock table and the unsaved quantity"
- "a failed refetch keeps the stock and the store name of store staff"
- "a save whose reload fails shows the saved quantity, "Stock saved." and the notice"
- "a category save whose reload fails closes the dialog and keeps the table with the notice"
- "the notice leaves with the page it was about"

Pins, green on arrival (8; say so in the `test:` commit body): "a %s deleted elsewhere shows not found on the next refetch, without the notice" (2 runs), "a 403 on a refetch shows not found, without the notice", "a first load of %s that fails shows the alert with "Try again" and no notice" (3 runs), "the pincodes failing on the first load show their own alert inside the store page, which stays", "a page of stock that fails on its first load shows the alert and no notice, and the unsaved quantity is still counted".

Easy to get wrong:
- The check is `data === undefined`, never `isPending`, never `!data`, never `isError && !data`.
- The notice is rendered in exactly one place, `src/routes/__root.tsx`. No page imports `RefetchNotice`.
- On the two detail pages the `not_found` line comes before the `data === undefined` line.
- In `stock.tsx` the `const done = …` line moves up; it is not duplicated.
- The test's `refetch` helper keeps its `notifyManager.schedule` line: without it every test passes on the unfixed code.
- No copy, class or import changes anywhere; no existing test is edited.

- [x] 1.1 `src/refetch.test.tsx` per design.md, committed red (`test: a failed refetch keeps the showing admin page`); Vitest `11 failed | 168 passed (179)`; lint and typecheck pass
- [x] 1.2 `src/refetch-notice.tsx` and EDIT 1 to 12 per design.md (`fix: a failed refetch keeps the showing admin page`); Vitest `179 passed (179)`; every gate green; `routeTree.gen.ts` unchanged

## 1b. Product page: the alert only for a read that failed with nothing held (review 1, R1-1)

Base: task 1 landed (87381e8, b31884f), admin Vitest `179 passed`. Measured on that base on 2026-10-13. Brief: `briefs/task-1b.md`. Gates as above with admin `180 passed`, ui `54`, web `101`.

Scope: `apps/admin/src/refetch.test.tsx` (one test appended; nothing above it changes), `apps/admin/src/routes/_staff/_admin/products/$productId.tsx` (EDIT 13), this file's checkboxes, the worker's lane log `.claude/lanes/admin-P2-L7-T1b.md`. Nothing else: the other two-read sites do not have the shape (design.md, Task 1b).
Scenario: Admin pages keep data when a refetch fails › Product opened while cached categories fail to refresh.
Failing test: `src/refetch.test.tsx` › "a product opened while its read is still out shows the skeleton, not the alert, when the cached categories fail to refresh".

- [ ] 1b.1 The test appended per design.md "Task 1b", committed red (`test: a product still loading shows the skeleton when cached categories fail to refresh`); Vitest `1 failed | 179 passed (180)`; lint and typecheck pass
- [ ] 1b.2 EDIT 13 per design.md (`fix: the product page alerts only for a read that failed with nothing held`); Vitest `180 passed (180)`; every gate green

## Workflow follow-up
- [ ] Team lead runs `/opsx:verify admin-keep-data-on-refetch-error` after 1.2 lands.
- Area manager: `make e2e` with the slot before the PR (expected unchanged: admin 10), then archives the change by PR after the fix PR merges.
