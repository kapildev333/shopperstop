# core-P2-L2-t3 - admin store list, create, read, change, delete (tasks 3.1, 3.2)
Status: done (gates green 2026-10-12)
## Doing
Task 3 landed on `lane/core-P2-L2-stores-serviceability`: test commit `674118d` (test: admin store routes), feat commit `bd90bff` (feat: admin store list, create, read, change, delete; handlers, validation, five routes under RequireAdmin, openapi.json, regenerated core.d.ts and Postman collection), then the tick and this log. Waiting for task 4 brief.
## Found
- Gates: `GOFLAGS=-count=1 make test-core` exit 0 (gofmt and vet clean; `go test -race`: cmd/core 1.5 s, cmd/core-admin 18.5 s, internal/app 50.7 s, auth 9.0 s, config 2.0 s, httpx 2.4 s, migrate 2.2 s, pg 2.7 s, seed 40.5 s, store 3.3 s). `TestContract` and `TestContractSecurity` pass with the five new operations. `make gen postman` leaves `git status` empty; `make postman` 11 of 11. `openspec validate --all --strict`: 8 passed, 0 failed.
- Routes (`app.New`, after the staff-users routes, all `RequireAdmin`): `GET`/`POST /admin/stores`, `GET`/`PATCH`/`DELETE /admin/stores/{id}`. Operation ids `listStores`, `createStore`, `getAdminStore`, `updateStore`, `deleteStore`; tag `admin-stores`; schemas `AdminStore`, `StoreCreate`, `StorePatch`, `StoreList`.
- Handlers in `internal/store`: `List`, `Create`, `AdminGet`, `Update`, `Delete` (package functions on the pool), with `fields`, `check`, `withDefaults`, `admin` in `store.go`. Create fills absent members with zero values and then checks them all, so a missing `name`, `addressLine`, `pincode` or `promisedMinutes` is 400 naming that field. Update checks only present members.
- Delete: a store with staff users answers 409 `conflict` "still in use" through `pg.Map`; the database refuses the delete (`staff_users_store_id_fkey`), no code names staff. core-P2-L5's orders foreign key will make the same 409 for orders.
- Admin view for admin-P2-L2 and web-P2-L1: `AdminStore` fields `id, name, isOpen, deliveryFeeCents, freeDeliveryAboveCents, minOrderCents, promisedMinutes, addressLine, pincode`. `StoreList` is `{items, page, pageSize, total}`, ordered by name then id. Store staff get 403 on all five routes, before the id is read.
- Demo ids and examples: every store example is Koramangala `...0401`; the POST example body is the design's HSR Layout body (a Postman run creates one store, `seed-demo --reset` removes it); the DELETE example answers 409 because Koramangala has staff.
## Requests
- to admin-P2-L2 and web-P2-L1: none new; the names are as in the Found section (`StoreList`, not `AdminStoreList`).
- to the core area plan: none.
## Blockers
- none
## Judgement calls
- Schema name: the brief said `AdminStoreList`; design.md, tasks.md, the proposal and core-P2-L2's log say `StoreList`. Used `StoreList`.
- `AdminStore` is a flat object, not `allOf` with `Store`: `Store` forbids additional properties, so an `allOf` would reject `addressLine` and `pincode` under strict validation. Same fields as the design.
- The admin tests use pincode `561201` for the created store instead of the spec's `560102`, to keep the `5612xx` namespace of this file.
- Three of the new tests pass before the routes exist (`TestAdminGetUnknownStore`, `TestPatchUnknownStore`, `TestDeleteUnknownStore`): the router's own 404 `not_found` for an unregistered path matches their assertions. The red state comes from the other ten tests and the five `TestAuthGates` rows (the admin-allowed 200 and 400 rows fail).
## Deferred
- none in this lane's scope. Service areas (task 4) and the seed (task 5) are not started.
