# admin-P2-L3-R5b - review of task 5b (follow-ups from reviews 1 to 5)
Status: done
## Doing
Reviewed 6419638, ac3a7ce, bfb3528 and the design (Decisions 15 to 19). Verdict: approve with nits.
## Found
Verdict: approve with nits. No correctness bug on a reachable path; two small items worth a line before the PR.

Findings (most severe first)
1. Spec mismatch, low. `product-form.tsx` `set` and the three `save.reset()` calls in `categories.tsx`: editing any field calls `save.reset()`, which clears core's error on every field, but the requirement says editing clears "the error shown on that field ... and leave the other fields' errors". Failing input: core answers 400 `priceCents`; the admin edits Name; the Price error disappears though Price is unchanged. Client-side errors are correct (per field, tested: MRP stays while Price is edited). Core reports one error per answer, so the effect is only that an untouched field's server error goes early. Fix (small): reset only when `serverField === field`, or reword the requirement to "core's last answer clears on any edit". Accept as ceiling if reworded; otherwise fix before the PR.
2. Ceiling, documented (Decision 16): `setValues(initial(saved))` replaces edits typed while the save is in flight (and `save.reset()` in `set` hides "Product saved." for that save). Not a fight with `setQueryData`: the prop `product` updates through the cache write, so `changed()` diffs the next save against the saved values (the second-save test proves it). Accept as ceiling.
3. Ceiling, documented (Decision 15): back to the deleted product's URL within the cache lifetime renders the kept form until core's 404 arrives. Checked: `ProductPage` tests `product.isError` with `not_found` before `product.data`, so the 404 replaces the form; no stale delete button survives. Accept.
4. Nit, no action: `removeQueries({queryKey:['admin','products'], type:'inactive'})` also drops other cached single-product queries (`['admin','products',id]`), which are inactive on this page. Harmless (they refetch on next open; staleTime 0 anyway). The deleted/deactivated product's own query is active and survives, as intended. Paths walked: list first (list inactive on the product page, removed), direct URL (nothing to remove), back button after deactivate (key holds `saved`, form opens Inactive), a list still mounted (impossible on this route). Create via `/products/new` does not remove lists, so a kept list can flash the old rows until the refetch; same behaviour as before this task and the existing "table shows a saved change" test, out of scope.
5. Nit, no action: "Uploading the image…" is a `StatusMessage` (`role="status"`, polite live region), inserted into the DOM when pending starts; announced without moving focus. Insertion-time live regions are announced less reliably by some screen readers than a persistent empty region; consistent with the existing "Image saved." handling. An ignored second pick is silent beyond that status and the cleared input; acceptable and listed as a ceiling (Decision 18). `key={product.data.id}` on `ImageUpload` is correct and untested by decision.

Tests
- The three held-response tests are deterministic: a promise released by the test, no timers; the list is read only after `release()`. Three further full admin runs: 95 passed each, no flake.
- Red-first: the worker's log shows the 7 reds each failing at the intended assertion (stale table, trimmed value, leftover description text, missing "Uploading the image…"), i.e. for the right reason. Mutations I ran in a throwaway copy outside the worktree: dropping `removeQueries` turns exactly "after a delete the products table loads afresh" and "after deactivate instead ..." red; dropping `if (upload.isPending) return` turns "a pick while an upload is pending ..." red. The other design.md guards were judged by reading and hold (each test asserts the description text or request body the mutation would change).
- The 4 group-A tests assert real things (request body without `parentId`, `page` and filters in the query, banner plus path, dialog buttons and exactly one DELETE); each has a named mutation in design.md that fails it. Commit order test, test, fix is correct.

Scope: only `apps/admin/src` test and source files named in the brief, tasks.md ticks and the worker log. `routeTree.gen.ts`, package.json unchanged by 5b. No Accepted-ceiling item was fixed.

Gates (worktree root, node 22.23.3): `make test-web` exit 0 (ui 54, admin 95, web 20; lint, typecheck, build ran); `openspec validate --all --strict` 14 passed, 0 failed; admin Vitest x3: 95 passed each. No `npm ci` needed. No e2e, Playwright or docker.
## Requests
none
## Blockers
none
