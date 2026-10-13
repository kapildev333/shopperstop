# admin-P2-L2-T4 - store pincode editor and conflict naming the other store (OpenSpec change admin-stores, task 4)
Status: done
## Doing
Task 4 done: 4.1 `test: store pincode editor` (red), 4.2 `feat: store pincode editor with conflict naming the other store` (ServiceAreas and the card per design.md). Gates green. Waiting for the manager's go on task 5 (needs the e2e slot).
## Found
- 4.1 red (Vitest, `src/service-areas.test.tsx` before any code). The failing lines:
  ```
  ❯ src/service-areas.test.tsx (7 tests | 7 failed)
  × the store page lists its pincodes
  × add and remove pincodes, then save the list with one PUT
  × a pincode that is not 6 digits is not added
  × a pincode served by another store names that store
  × the conflict shows the store id when its name cannot be read
  × a pincode save failure with an error answer asks to try again
  × a pincode save failure with no answer asks to try again
  FAIL  src/service-areas.test.tsx > the store page lists its pincodes
  TestingLibraryElementError: Unable to find role="heading" and name "Delivery pincodes"
  Test Files  1 failed | 8 passed (9)
  Tests  7 failed | 43 passed (50)
  ```
- No fixture added: `fake-core.ts` already holds `admin`, `koramangala`, `indiranagar`, `apiError`, `json` and `fakeCore`, which the design's test block needs.
- 4.2 code: `src/service-areas.tsx` verbatim from design.md; `ServiceAreas` card (`Card className="p-6"`) and its import added to `stores/$storeId.tsx`. `routeTree.gen.ts` unchanged.
- Core's 409 body (`pincode`, `storeId`, `field: "pincodes"`) matches design.md, as core-P2-L2-t4 records.
- No deviation from design.md.
## Requests
- none
## Blockers
None.
