# core-P2-L1-t10 - task 10: generated types, Postman collection, full core gate
Status: done
## Doing
Task 10 landed on `lane/core-P2-L1-accounts-auth`: `01a079d` (test: seed load rollback, seed-demo command exit codes), `733990b` (chore: regenerate api types and postman collection), then the tick commit (`chore: tick task 10`). Gates: `GOFLAGS=-count=1 make test-core` exit 0; `make gen postman` leaves `git status` clean; `openspec validate --all --strict` 6 passed; `npm run test --workspace packages/ui` 53 passed (`core.test.ts` 2 passed); `make postman` (`node --test scripts/postman.test.mjs`) 11 of 11 passed.
## Doing
Acceptance follow-up: `98cb6ed` (test: create-admin stores a hash that matches the stdin password) adds a bcrypt compare of the stored hash against `rootpass123` to `TestCreateAdmin`. Mutation (CRLF strip removed) fails it with "does not match"; `go test -race -count=1 ./cmd/core-admin/` ok 17.68 s.
## Found
- Postman collection: 3 folders, 17 requests: `platform` (2), `accounts` (9), `admin-staff` (6). Environment file holds the seven variables (checked by the postman test).
- `make gen` regenerated only `packages/ui/src/api/core.d.ts` (+1525 lines, the five accounts, the staff routes and the schemas); sqlc output unchanged, `sqlc v1.31.1`.
- Platform's postman fix (origin/main 0438165) is in: "Folders follow the contract tags" passes with three folders, so the Phase 1 folder blocker from core-P2-L1 is closed.
- Two tests added (task 9 review follow-up), both green on first run because they pin behaviour that already exists. Red was shown by mutation, then the files were restored:
  - `internal/seed` `TestLoadRollsBackWhenCustomerInsertFails`: the brief's literal setup (delete only the demo customer) does not work. `addresses.customer_id` is `on delete cascade`, so the addresses would go with the customer, and with the admin still present `Load` fails on the admin insert, never reaching the customer or addresses. The test deletes the admin row instead, so the admin insert succeeds in the transaction and the customer insert fails. Asserts the error names `insert demo customer` with `duplicate key`, admin count 0, customer 1, addresses 2. Mutation: `Load` inserts the admin outside the transaction → test fails with `rows in staff_users: 1, want 0`.
  - `cmd/core-admin` `TestSeedDemoExitCodes`: the command runs against the test schema through `search_path` in the URL (`commandURL`, no production change). `seed-demo --reset` exits 0 with `seed-demo: demo accounts loaded`; plain `seed-demo` exits 1 with `seed-demo: insert demo admin` and `duplicate key`. Mutation: the failure path returns 0 → test fails with `second seed-demo: exit 0, want 1`.
- `TestLoadTwiceFails` is unchanged.
## Requests
- none. Grepped every lane file for requests to core-P2-L1 or core-P2-L1-t10: none outstanding.
## Blockers
none
## Judgement calls
- The brief's red expectation for the rollback test could not be met as written (see Found); the test was rewritten to the setup that exercises the rollback, and its green first run is a pin, not a red-first test.
- No code change was needed in `openapi.json`; `make gen` and `make postman` ran clean.
## Deferred
- none in this lane's scope.
