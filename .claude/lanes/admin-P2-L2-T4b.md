# admin-P2-L2-T4b - review follow-ups, store change cache and pincode guards (OpenSpec change admin-stores, task 4b)
Status: started
## Doing
4b.1 committed (82ec7c9). 4b.2 test checks written in `service-areas.test.tsx`; mutations recorded below. Next: commit 4b.2, then 4b.3.
## Found
- 4b.1 (2026-10-12): both new tests pass on the landed code, so the red is shown by mutation, as the brief says. Vitest 52 passed.
- Mutation 1, `setQueryData` line deleted from `store-form.tsx` onSuccess: RED. "a second save sends only its own change": `AssertionError: expected { isOpen: false, promisedMinutes: 11 } to deeply equal { isOpen: false }`. 1 failed, 7 passed. Reverted.
- Mutation 2, `staleTime: Infinity` added to `storesQuery` in `stores.ts` alone: GREEN (8 passed). Not a test defect: the landed `store-form.tsx` still calls `invalidateQueries` on the list in onSuccess, and that refetches the list on mount whatever its `staleTime`. Reverted.
- Mutation 2 with the invalidation line also removed (the state after 4b.3): RED. "the stores table shows a saved change": `Unable to find an element with the text: 11 min`. 1 failed, 7 passed. Reverted. Re-run after 4b.3 and recorded there.
- Deviation: the brief expects mutation 2 red at commit 1. It is red only once 4b.3 has dropped the invalidation. Commit order kept as briefed; the test is unchanged.
- 4b.2: the three checks are folded into existing tests (diff against HEAD is only those checks; no new names). Landed code green (7 tests in the file). Mutations on `service-areas.tsx`, each reverted, each turns exactly its test red:
  - M1, `setQueryData` removed from onSuccess: RED "add and remove pincodes, then save the list with one PUT": `expected [ '560034', '560095' ] to deeply equal [ '560034', '560047' ]`. 1 failed, 6 passed.
  - M2, `unsaved` = `draft !== undefined`: RED "the store page lists its pincodes": `expected document not to contain element, found <div` (the "Unsaved changes." note after re-adding 560095). 1 failed, 6 passed.
  - M3, `save.reset()` dropped from `edit`: RED "a pincode served by another store names that store": `expected document not to contain element, found <div` (the alert after removing 560038). 1 failed, 6 passed.
  - `git diff HEAD -- apps/admin/src/service-areas.tsx` empty at the commit.
## Requests
- none
## Blockers
None.
