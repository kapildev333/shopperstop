# admin-P2-L2-T4b - review follow-ups, store change cache and pincode guards (OpenSpec change admin-stores, task 4b)
Status: started
## Doing
4b.1 tests written (`store-form.test.tsx`, two tests with `keepsStore()`), both green on the landed code; mutations recorded below. Next: commit 4b.1, then 4b.2.
## Found
- 4b.1 (2026-10-12): both new tests pass on the landed code, so the red is shown by mutation, as the brief says. Vitest 52 passed.
- Mutation 1, `setQueryData` line deleted from `store-form.tsx` onSuccess: RED. "a second save sends only its own change": `AssertionError: expected { isOpen: false, promisedMinutes: 11 } to deeply equal { isOpen: false }`. 1 failed, 7 passed. Reverted.
- Mutation 2, `staleTime: Infinity` added to `storesQuery` in `stores.ts` alone: GREEN (8 passed). Not a test defect: the landed `store-form.tsx` still calls `invalidateQueries` on the list in onSuccess, and that refetches the list on mount whatever its `staleTime`. Reverted.
- Mutation 2 with the invalidation line also removed (the state after 4b.3): RED. "the stores table shows a saved change": `Unable to find an element with the text: 11 min`. 1 failed, 7 passed. Reverted. Re-run after 4b.3 and recorded there.
- Deviation: the brief expects mutation 2 red at commit 1. It is red only once 4b.3 has dropped the invalidation. Commit order kept as briefed; the test is unchanged.
## Requests
- none
## Blockers
None.
