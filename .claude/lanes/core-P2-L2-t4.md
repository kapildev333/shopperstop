# core-P2-L2-t4 - store service areas (tasks 4.1, 4.2) and the create-null review fix from task 3
Status: done (gates green 2026-10-12)
## Doing
Task 4 landed on `lane/core-P2-L2-stores-serviceability`: test commit `bd2afd7` (test: store service areas; create rejects explicit null), feat commit `b9961b0` (feat: service-areas routes with the one-store-per-pincode rule; create rejects null), then the tick commit (chore: tick tasks 4.1 4.2, with this log). Waiting for task 5 brief.
## Found
- Gates: `GOFLAGS=-count=1 make test-core` exit 0 (gofmt and vet clean; `go test -race`: cmd/core 1.3 s, cmd/core-admin 18.8 s, internal/app 50.3 s, auth 9.4 s, config 2.9 s, httpx 2.1 s, migrate 2.6 s, pg 3.3 s, seed 38.6 s, store 2.4 s). `TestContract`, `TestContractSecurity` green with the two new operations. `make gen postman`: 11 of 11 pass, `git status --short` empty afterwards. `openspec validate --all --strict`: 8 passed, 0 failed.
- Routes (`app.New`, `RequireAdmin`): `GET` and `PUT /admin/stores/{id}/service-areas`. Operation ids `getServiceAreas`, `replaceServiceAreas`; tag `admin-stores`; schemas `ServiceAreas` (`{pincodes}`, also the PUT body) and `PincodeConflict`.
- Create (`POST /admin/stores`) now reads its body with `httpx.ReadPatch`: an explicit null is 400 validation naming the member; absent members still take `withDefaults`. Its openapi description says so.
- Replace: `pgx.BeginFunc` with `LockStore` (`for update`, 404 when no row), `PincodeHolder` (lowest pincode another store serves), `DeleteServiceAreas`, `AddServiceAreas`. Serialises two replaces of one store.
- Admin-P2-L2 and web-P2-L1 (for the Service areas screen): `PUT` answers 200 `{pincodes}` sorted and deduplicated; 409 body `{error: {code: "conflict", message, field: "pincodes", pincode, storeId}}`.
- Generated: `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json` are additive except the one create description line.
## Requests
- to core-P2-L5 and core-P2-L4: none new. The one-store-per-pincode rule reads `store_service_areas` only through `store.ForPincode`.
- to the core area plan: none.
## Blockers
- none
## Judgement calls
- Race loser (two admins claim the same new pincode at once): the unique violation goes through `pg.Map` unchanged, so the 409 is `{code: "conflict", message: "already exists"}` with no `field`, `pincode` or `storeId`. The design asks only for "no storeId"; I kept `pg.Map` as it is rather than adding `field: pincodes` on that path. `PincodeConflict` therefore has `code`, `message` required and `field`, `pincode`, `storeId` optional. Tell me if the race answer should also carry `field: "pincodes"`.
- `TestServiceAreasUnknownStore` passes before the handlers exist (the router's own 404 `not_found` for an unregistered path matches its assertions). The red state comes from the other six tests and the two `TestAuthGates` rows (anonymous 404 where 401 is expected) plus the create-null case (201 where 400 is expected).
- The 101-pincode test needs 101 distinct values, which do not fit the `5613xx` block; the list ends at `561400`. The list is refused before any write, so no other test sees it.
- The service-area pincodes are not shared between tests in this file. A collision in the first version of `TestServiceAreasHeldByOtherStore` (it reused `561338` from `TestServiceAreasBadPincode`) was fixed in the test commit `bd2afd7` before any push (fixup and autosquash, history not published).
- `ServiceAreas` answers 404 through `GetStore` before listing, so an unknown id is 404 and a known store with no pincodes is `{"pincodes":[]}`, never null (`TestServiceAreasEmpty` checks the raw bytes).
## Deferred
- No test drives the race-loser path (the unique violation through `pg.Map`): the brief lists seven tests and the race needs two concurrent requests. The mapping is code only so far. Add it when a concurrency test is in scope.
- Task 5 (staff store check, demo stores and store staff) is not started.
