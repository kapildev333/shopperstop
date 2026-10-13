# admin-P2-L3-R2 - review of task 2 (categories page)
Status: done
## Doing
Verdict: approve with nits. Reviewed c73ad98 (test) and 927e6ca (feat). Gates: `make test-web` exit 0 (ui 54, admin 68, web 20 passed); `openspec validate admin-catalog --type change --strict` valid; `git status` clean.
Test-first: not re-run red in a throwaway worktree; judged from the worker log (10 failed | 58 passed at c73ad98, 68 passed after) and the diff (the route was a placeholder, so every new test fails on missing table/dialogs). Order is correct: test commit touches only categories.test.tsx and tasks.md tick 2.1 (log/tasks aside).
Scope: only brief paths (categories.test.tsx, categories.tsx, route categories.tsx, tasks.md, lane log). routeTree.gen.ts, package.json untouched; no lucide import; components only from `@shopperstop/ui`; no literal colours.
Contract check against core (`catalog.go checkSortOrder` 0..9999, `categories.go` PATCH name/sortOrder only, name trimmed server-side, CategoryCreate parentId optional): client regex `^\d{1,4}$` matches 0..9999 exactly; PATCH body is only changed fields and never carries parentId; create offers only top-level parents so depth and self-parent cannot be chosen; slug not sent. invalidateQueries is awaited before onClose in both mutations, so the table reorders from core's answer (the patch test proves the reorder). 409 -> conflict banner, other errors -> generic banner, validation with a known field -> field error and no banner. Dialogs mount only while open, so state resets between opens.
## Found
No blockers. Nits, all "can ride with the nits task after task 5":
- Nit, test gap: apps/admin/src/categories.test.tsx "create a child category" always picks a parent. Creating a top-level category (parentId omitted from the POST body, `...(parentId && {parentId})` at categories.tsx:31) is untested; flipping that spread would pass the suite. Add a test posting `{name, sortOrder}` with "None (top level)".
- Nit, test gap: only `parentId` is exercised as a server field error. A validation error on `name` or `sortOrder` (messages map, categories.tsx:8-12) and the name-only PATCH body (`{name}`, categories.tsx:29) are unproven. The banner test types in Name but never asserts the PATCH body; add `expect(...json()).toEqual({name: ...})`.
- Nit, test gap: "a category in use" asserts only the alert text and `names()` contains Dairy, which is true before the click too. Also assert the dialog is still open (and ideally that DELETE was called once) so a wrongly closed dialog fails.
- Nit, small behaviour: after a server field error, editing the field leaves the stale message until the next submit (categories.tsx:51-54 reads `save.error`). Call `save.reset()` in the onChange or accept; low impact.
- Nit, small: sort order is compared as `order !== category.sortOrder`, name untrimmed `name !== category.name`; typing a trailing space sends a name core then trims to the same value (harmless no-op PATCH). Submitting with nothing changed sends `{}`; core accepts it. Could skip the request and close instead, optional.
- Nit, a11y: the stack-mode Table plus aria-labelled "Edit X"/"Delete X" buttons whose visible text is "Edit"/"Delete" is fine (label contains visible text). The Delete confirm uses the primary button, same as the existing store delete (`stores/$storeId.tsx:39`), so consistent; no change.
## Requests
None.
## Blockers
None.
