# admin-P2-L7-R1 - review of task 1 (a failed refetch keeps the showing admin page)
Status: done
## Doing
Verdict: approve with nits.
## Found
Gates (own runs): make test-web exit 0: ui 54, admin 179, web 101. Admin suite run 3 times, 179 each. openspec validate --all --strict: 15 passed, 0 failed.
Red-first: throwaway worktree at 87381e8 (outside the lane, removed): 11 of 19 refetch tests fail (the 11 red-first), 8 pass. With b31884f but the stock setQueriesData removed, exactly "a save whose reload fails shows the saved quantity" fails, so that write is tested. Tests are deterministic (notifyManager.schedule wait, no real timers).
1. apps/admin/src/routes/_staff/_admin/products/$productId.tsx:78-81, nit, fix before the PR (one line): the alert test is `!product.isError && !categories.isError`. If categories (cached, refetched on mount) fails while product is still pending, the page shows "Could not load the product" with Try again instead of the skeleton (before: isPending won first). Use `(product.data === undefined && product.isError) || (categories.data === undefined && categories.isError)` for the alert. Not covered by a test.
2. refetch-notice.tsx, accept as ceiling: the notice is in flow above the page (mb-6), so a failed focus refetch shifts the page down by one line while the user may be about to click. Behind an open dialog it sits under the overlay (portal, fixed) and is announced politely by role=status; nothing steals focus.
3. design.md is 718 lines for a 19-line component and ten mechanical branch swaps; accept (documents only).
Verified without finding: all ten sites and every useQuery in src/ (grep) are covered; the session read uses ensureQueryData without an observer, so it is never "active"; the sign-in page has no queries; ownStore with enabled false is not active; a query that becomes inactive drops out (findAll type active; cache emits observerRemoved, so the snapshot re-evaluates); useSyncExternalStore snapshot is a boolean, so re-render only on change; not_found checked first on store and product pages; 403 goes to the route boundary; mutation error handling untouched; routeTree.gen.ts, fake-core.ts, package.json unchanged; e2e specs only use status locators filtered by text, no clash with the notice.
Stock: `done` comes from the rows actually sent (toRows slices at 500), so the written quantities are exactly what core stored; the write is keyed to sent.store (late answer after a store change cannot touch another store); inactive pages are removed first; placeholder rows are not state.data of a query that errored, and a failed first load of a new page still shows the alert (tested). setQueryData clears a prior error until the reload fails again, which then shows the notice (tested).
## Requests
none
