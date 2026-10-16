# rider-P3-L1-T4 - staff routes through core
Status: done
## Doing
Task 4 complete: red tests (48c38ce, gofmt-amended), feat commit with admin routes, openapi and the regenerated Postman collection. Tasks 4.1 to 4.4 ticked.
## Found
- Red run (before the feat): every admin route answered 404 (not registered), so each new test failed on its own assertion, not on a build error:
  ```
  --- FAIL: TestStaffAdmittedThroughCore: admin_riders_test.go: core staff token: got 404 {"error":{"code":"not_found"...}}, want 200
  --- FAIL: TestStaffRouteCoreFailureIs502: core 500: got 404, want 502 internal
  --- FAIL: TestListRidersRefusesBadStore: store=abc: got 404, want 400 validation
  --- FAIL: TestCreateRiderRefusalsNameTheField: seven-byte password: got 404, want 400 validation
  --- FAIL: TestRiderOfAnotherStoreNotFound: store A staff reads own rider: got 404, want 200
  (and the same for TestAdminListsAndFiltersRiders, TestStoreStaffListsOwnStore, TestAdminCreatesRider, TestStoreStaffCreatesOnlyForOwnStore, TestDeactivationEndsSessions, TestPatchResetsPassword, TestPatchEditsNameAndClearsPhone, TestPatchRefusesNull)
  ```
- `auth.New(pool, pepper, limit, c)`: callers updated in auth_test.go (nil), app_test.go TestMain (startCore's client), riders_test.go (nil) and cmd/rider.
- `CreateRider` order follows design.md Decision 9: core store check first (400 storeId), then email, name, phone, password, hash, insert.
- Postman determinism: the converter writes a random uuid into path and query parameter values unless the parameter has an `example`, and into the response `originalRequest` copies, which `fixRequest` in `scripts/postman.mjs` does not rewrite. Fixed in the spec: `store` and the `id` path parameter carry examples (core does the same). `make postman` runs twice to identical bytes.
- `make gen` regenerates `packages/ui/src/api/core.d.ts` with no change; `rider.d.ts` is not written (ui-P3-L2).
## Requests
- to platform: `scripts/postman.mjs` `fixRequest` should also rewrite `response[].originalRequest.url.variable` (and query) values, so a path parameter without an example cannot make the collection nondeterministic. Not needed while the rider contract gives examples.
## Blockers
- none
