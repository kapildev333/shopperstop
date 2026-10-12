# core-P2-L2-t2 - serviceability and public store routes (tasks 2.1, 2.2)
Status: done (gates green 2026-10-12)
## Doing
Task 2 landed on `lane/core-P2-L2-stores-serviceability`: test commit `fa4b168` (test: serviceability and public store routes), feat commit `d8a07ff` (feat: serviceability and public store routes; handlers, app.go routes, openapi.json, regenerated core.d.ts and Postman collection), then the tick commit (chore: tick tasks 2.1 2.2). Waiting for task 3 brief.
## Found
- Gates: `GOFLAGS=-count=1 make test-core` exit 0 (gofmt and vet clean; `go test -race`: cmd/core 1.27 s, cmd/core-admin 20.4 s, internal/app 50.3 s, auth 10.6 s, config 1.7 s, httpx 2.2 s, migrate 1.5 s, pg 2.5 s, seed 42.9 s, store 3.2 s). `TestContract` and `TestContractSecurity` pass, plus the new five. `make gen postman` leaves `git status` empty; `make postman` 11 of 11. `openspec validate --all --strict`: 8 passed, 0 failed.
- Routes: `GET /api/core/v1/serviceability` (operationId `getServiceability`, tag `serviceability`) and `GET /api/core/v1/stores/{id}` (`getStore`, tag `serviceability`). No `security`. Schemas `Store` (seven required members) and `Serviceability` (`{store}`). Examples: Koramangala `...0401` on both, the 400 `validation` field `pincode` and the 404 `not_serviceable` on the first route, the 404 `not_found` on the second.
- `app.New` change for core-P2-L3 (its log asks the lane that rebases second to keep both): two added lines after `readyz`, `store.Serviceability(pool)` and `store.PublicGet(pool)`, and the `internal/store` import. Nothing else in `app.New` changed.
- openapi.json edit is purely additive (205 insertions, 0 deletions): the file is not prettier output, so a whole-file rewrite churned unrelated lines; the insert was done at the three anchors (tags, paths, schemas) and checked by parse.
- Generated: `packages/ui/src/api/core.d.ts` (+196) and `docs/postman/shopperstop-core.postman_collection.json` (+322), both additive, committed in the feat commit.
- Public Store fields are exactly the seven keys (`TestPublicStoreFields` checks the key set; `TestServiceability` checks the same set inside `store`).
## Requests
- to core-P2-L3: none. Note for the rebase only (see Found).
- to web-P2-L1 and admin-P2-L2 (through the area plan, not needed for this lane): the operationIds above are the names to use in `openapi-typescript` output.
## Blockers
- none
## Judgement calls
- `TestPublicStoreUnknown` passes before the routes exist: the router's own 404 for an unregistered path is also `not_found`, so it cannot be red before the implementation. The red state was shown by the other four tests; this one pins the behaviour once the handler exists.
- `TestServiceability` also checks the `store` key set (the design says `store` is the same public view), beyond the brief's list.
## Deferred
- none in this lane's scope.
