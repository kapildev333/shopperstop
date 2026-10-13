# admin-P2-L2-T2 - store create and change (OpenSpec change admin-stores, task 2)
Status: started
## Doing
Task 2 done: 2.1 test commits `e314076` (red) and `4bc11b5` (fixture, red); 2.2 `feat: store create and change`. Next: task 3 (store delete) after the manager's go.
## Found
- 2.1 red (Vitest, `src/store-form.test.tsx` before any code): `Tests 6 failed | 35 passed (41)`:
  - create a store and open it: `Unable to find a label with the text of: Status`
  - edit sends only the changed fields and confirms: `Unable to find role="heading" and name "Koramangala"`
  - a validation error from core is shown on its field: `Unable to find a label with the text of: Name`
  - a value the form cannot send is flagged without a request: `Unable to find a label with the text of: Delivery fee (₹)`
  - any other save error shows a banner: `Unable to find a label with the text of: Promised minutes`
  - an unknown store shows not found: `Unable to find role="heading" and name "Page not found"`
- Fixture gap (found on 2.2, fixed in `4bc11b5 test: created store is readable after create`): after a create the form writes the new store into the cache and navigates to `/stores/<new id>`; the page refetches on mount (default `staleTime` 0). design.md's fake had no `GET /admin/stores/<created id>`, so the fake answered 404 and "create a store and open it" failed on the "HSR Layout" heading in the full run (1 of 41). The fix adds that one route answering `created`. Red on the placeholders confirmed after the fixture (6 failed). With the fixture and the feat code: `src/store-form.test.tsx` 6 passed in 3 of 3 runs.
- Team lead's `b2cf82f` already holds the 2.1 and 2.2 ticks in `tasks.md`, identical to this lane's; no openspec edit from this lane beyond that.
- Feat code: `src/store-form.tsx` and `stores/new.tsx` extracted verbatim from design.md; `stores/$storeId.tsx` in the task-2 shape (no `actions`, no `DeleteStore`, no `ServiceAreas`). `routeTree.gen.ts` unchanged.
- Gates on the feat (Node 22.23.3): `build packages/ui` exit 0; `lint apps/admin` exit 0; `typecheck` clean; `test apps/admin -- --run` Test Files 7 passed (7), Tests 41 passed (41); `build apps/admin` ok; `openspec validate admin-stores --type change --strict` valid.
## Requests
- none
## Blockers
None.
