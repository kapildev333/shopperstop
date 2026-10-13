# admin-P2-L2-T3 - store delete with confirmation (OpenSpec change admin-stores, task 3)
Status: done
## Doing
Task 3 done: 3.1 `test: store delete with confirmation` (red), 3.2 `feat: store delete with confirmation` (DeleteStore and the PageHeader actions slot per design.md). Gates green. Waiting for the manager's go on task 4.
## Found
- 3.1 red (Vitest, `src/store-delete.test.tsx` before any code), the failing lines:
  ```
  × delete asks first, then removes the store
  × a store in use cannot be deleted
  FAIL  src/store-delete.test.tsx > delete asks first, then removes the store
  TestingLibraryElementError: Unable to find role="button" and name "Delete store"
  FAIL  src/store-delete.test.tsx > a store in use cannot be deleted
  TestingLibraryElementError: Unable to find role="button" and name "Delete store"
  Test Files  1 failed (1)
  Tests  2 failed (2)
  ```
  The other 41 stay green in that run (`Tests 2 failed | 41 passed (43)` for the full suite). The full output also dumps the rendered DOM for each failure; only these lines are pasted.
- 3.2 code: `DeleteStore` and `actions={<DeleteStore store={store.data} />}` in `stores/$storeId.tsx`, verbatim from design.md. The "Delete store" button is `variant="secondary"`. `ServiceAreas` and its import are left for task 4. `routeTree.gen.ts` unchanged.
- No deviation from design.md. `fake-core.ts` unchanged: design.md adds no fixture for this task.
## Requests
- none
## Blockers
None.
