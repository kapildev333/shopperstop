Every task runs in the worktree `.worktrees/rider-P3-L2` on branch `lane/rider-P3-L2-deliveries`. Order: 1, then 2, then 3 (opening with the two `fix:` commits task 2's migration made necessary), then 4 and 5 in parallel (task 5 touches only `services/rider/internal/seed/`; task 4 never does), then 7, then 6 (the manager's). Each worker keeps its log in `.claude/lanes/rider-P3-L2-T<n>.md`, ticks its own boxes here, and never runs `make db`, `make dev`, `make prod-local` or `make seed` (only `make -n`), nor `docker` anything. Node for `make gen` and `make postman`: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`, `npm ci` once at the worktree root if `node_modules` is absent. Single test: `cd services/rider && SHOPPERSTOP_RIDER_TEST_DATABASE_URL='postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable' go test -race -run TestName ./internal/<pkg>`.

Gates for every task, from the worktree root: `make test-rider`; `openspec validate --all --strict` (read the totals line). Tasks 2, 3 and 4 also: `make gen` and `make postman`, then `git status --short` shows nothing uncommitted (commit `docs/postman/shopperstop-rider.postman_collection.json` with the `openapi.json` change; commit `packages/ui/src/api/rider.d.ts` only if it already exists in the worktree). Everything follows design.md; a choice design.md does not make is a stop-and-ask, not a decision.

## 1. Core client and fake for orders (worker)

Scope: `services/rider/internal/core/`, `services/rider/internal/coretest/` only.
Scenarios: "Core refusing the service token is a core failure" (client level); the core halves of "Riders claim a ready order", "Claims are exclusive and refusals leave nothing", "Riders mark a delivery delivered" and "Customers see their order's delivery" (each call's success, 404, 409 and 401 mapping).
Starts from: `services/rider/internal/core/core_test.go` `TestStoreOrdersReadsReadyWithServiceToken`, `TestOrderReadsWithServiceToken` (and unknown id → `core.ErrNotFound`), `TestChangeStatusSendsActor` (fake's `StatusChanges` holds `{out_for_delivery, {rider, id, name}}`), `TestChangeStatusConflict` (order `packing` → `core.ErrConflict`), `TestServiceTokenRefusedIs502` (client built with `"wrong-token"`: `StoreOrders`, `Order`, `ChangeStatus` each give a 502 `internal` `*httpx.Error`, not 401, with one `core call failed` line carrying status 401), `TestCustomerOrder` (owner 200, other customer's token 404 `ErrNotFound`, unknown token 401 `ErrUnauthorized`).
Commits: `test: core client order calls and service-token refusal`, then `feat: core client order calls and fake order routes`.

- [x] 1.1 Write the tests; red run pasted into the log; commit `test: ...`
- [x] 1.2 `internal/core` per design.md Interfaces and Decision 5 (types, `ErrConflict`, `service`, the four methods, `do`'s 409 case); `internal/coretest` per design.md (`ServiceToken`, `AddOrder`, `SetOrderStatus`, `OrderStatus`, `StatusChanges`, `FailRoute`, the four routes with core's envelopes); stdlib only; L1's tests stay green unchanged
- [x] 1.3 Gates green; commit `feat: ...`

## 2. Deliveries table, ready orders and claims (worker, after 1)

Scope: `services/rider/` (`migrations/0003_deliveries.sql`, `sqlc.yaml`, `queries/deliveries.sql`, `internal/delivery/` and `internal/delivery/db/`, `internal/auth/db/models.go` (generated), `internal/app/` (`app.go`, `deliveries_test.go`, the `nil` argument in `app_test.go` and `riders_test.go`), `cmd/rider/main.go`, `cmd/rider-admin/main_test.go` and `internal/seed/seed_test.go` (only the extra `nil` argument to `app.New`), `openapi.json`), the generated Postman collection.
Scenarios: "Riders see their store's ready orders" (both), "Riders claim a ready order" (both), "Claims are exclusive and refusals leave nothing" (all three), "Core refusing the service token is a core failure" (route level).
Starts from: `services/rider/internal/app/deliveries_test.go` `TestReadyOrdersOwnStoreOnly`, `TestReadyOrdersDropClaimed`, `TestClaim`, `TestClaimBadOrderID` (400 `orderId`), `TestClaimOtherStore` (404, no row, `Calls("POST /api/core/v1/admin/orders/{id}/status") == 0`), `TestConcurrentClaims`, `TestClaimRolledBackOnCoreConflict`, `TestClaimRolledBackOnCoreFailure`, `TestReadyOrdersWrongServiceToken`; plus `TestContract` and `TestContractSecurity` failing on the new routes once they are served.
Commits: `test: ready orders and exclusive claims`, then `feat: deliveries table, ready orders and claims`.

- [x] 2.1 Write the tests (design.md Test strategy); red run pasted into the log; commit `test: ...`
- [x] 2.2 `0003_deliveries.sql` exactly per design.md Data model; `sqlc.yaml` second entry; `queries/deliveries.sql` (all queries named in design.md, so tasks 3 and 4 add none); `make gen`
- [x] 2.3 `internal/delivery`: `New`, types, `ReadyOrders` (Decision 9), `Claim` (Decisions 3 and 8); `app.New(pool, origins, a, d)` with the two routes (Decision 14); `cmd/rider` builds `delivery.New(pool, c)`
- [x] 2.4 `openapi.json`: tag `deliveries`, schemas `ReadyOrder`, `ReadyOrderList`, `DeliveryClaim`, `Delivery`, `DeliveryItem`, `DeliveryAddress`, the two operations with every code of the routes table and examples
- [x] 2.5 Gates green, `make gen postman` clean after the commit; commit `feat: ...` (at `a64dfa6` the task's own tests, contract and Postman were green; `internal/migrate` and `internal/seed` went red on `0003_deliveries.sql` and were fixed by task 3.0)

## 3. A rider's deliveries and marking delivered (worker, after 2)

Scope: `services/rider/internal/delivery/` (not `db/`), `services/rider/internal/app/` (`app.go`, `deliveries_test.go`), `services/rider/openapi.json`, the generated Postman collection; for 3.0 only: `services/rider/internal/migrate/migrate_test.go` (the want list), `services/rider/internal/seed/seed.go` (`truncateTables`) and `services/rider/internal/seed/seed_test.go` (the literal truncate in `TestLoadTwiceFails`).
Scenarios: "Riders list and read their deliveries" (both), "Riders mark a delivery delivered" (both), "Claims and deliveries are logged".
Starts from: `services/rider/internal/app/deliveries_test.go` `TestListDefaultsToAssigned`, `TestListDelivered`, `TestListBadStatus` (400 `status`), `TestGetOtherRidersDelivery` (and unknown id and `not-a-uuid` 404), `TestDeliveredOnce`, `TestDeliveredStaysAssignedWhenCoreFails`, `TestClaimAndDeliveredLogged`.
Commits: `fix: migrate test lists 0003_deliveries; seed reset truncates delivery tables` and `fix: seed test truncate covers the delivery tables` (manager decision under D13; red proven by the failing suites at `a64dfa6`, so no separate `test:` commit), then `test: rider deliveries list, read and delivered`, then `feat: rider deliveries list, read and delivered`.

- [x] 3.0 `migrate_test.go` want list gains `0003_deliveries`; `truncateTables` becomes `rider_locations, deliveries, sessions, riders`; `seed_test.go`'s literal truncate follows (`1f7d150`, `be0dcfd`)
- [x] 3.1 Write the tests; red run pasted into the log; commit `test: ...`
- [x] 3.2 `List`, `Get`, `Delivered` (Decisions 4 and 11), both log lines (Decision 12; the claim log goes into `Claim` here); the three routes
- [x] 3.3 `openapi.json`: schema `DeliveryList`, the three operations with every code and examples
- [x] 3.4 Gates green, `make gen postman` clean; commit `feat: ...`

## 4. Rider location and the customer's view (worker, after 3; parallel with 5)

Scope: `services/rider/internal/delivery/` (not `db/`), `services/rider/internal/auth/` (`auth.go`, `rider.go`, `staff.go`: only the `Bearer` rename, Decision 2), `services/rider/internal/core/core.go` and `services/rider/internal/coretest/coretest.go` (4.5 only: the R1 nits), `services/rider/internal/app/` (`app.go`, `deliveries_test.go`), `services/rider/openapi.json`, the generated Postman collection.
Scenarios: "Riders report their location" (both), "Customers see their order's delivery" (all three).
Starts from: `services/rider/internal/app/deliveries_test.go` `TestPutLocationReplaces`, `TestPutLocationRefusals` (missing `lat`, `lat` 91, `lng` -181: 400 naming the field, nothing stored), `TestCustomerFollowsRider` (body has no `phone`, `email` or rider id key), `TestCustomerLocationHiddenAfterDelivery`, `TestCustomerLocationBeforeClaimHidden`, `TestCustomerReadRefusals` (another customer's token 404, no delivery 404, no token 401 without a core call, unknown token 401).
Commits: `test: rider location and customer delivery view`, then `feat: rider location and customer delivery view`.

- [x] 4.1 Write the tests; red run pasted into the log; commit `test: ...`
- [x] 4.2 `auth.Bearer` rename; `PutLocation` (Decision 10), `OrderDelivery` (Decisions 6 and 7); the two routes
- [x] 4.3 `openapi.json`: schemas `LocationUpdate`, `Location`, `CustomerDelivery`, the two operations with every code and examples
- [x] 4.4 Gates green, `make gen postman` clean; commit `feat: ...`
- [x] 4.5 R1 nits as one `chore:` (no behaviour the rider relies on changes): the fake documents that its status route checks less than core; an unknown store answers core's 404 (a store is known when `AddStore` registered it or an order names it); `do`'s doc comment trimmed (`6ff1beb`)

## 5. Delivery demo seed (worker, after 3; parallel with 4)

Scope: `services/rider/internal/seed/` only.
Scenarios: "Delivery demo seed" (both); rider-service's "Seed needs no core" and "Reset twice leaves the demo riders" stay green.
Starts from: `services/rider/internal/seed/seed_test.go` `TestSeededDeliveryInHistory` (sign in as `rider1-koramangala@shopperstop.local`, `GET /me/deliveries?status=delivered` lists `...0901` with `orderNumber` `SS-DEMOAAAB`, `itemCount` 3, `totalCents` 33900), the extended `TestSummaryMatchesSeed` (id regex `0000000008xx|0000000009xx`, each id line's table `riders` or `deliveries` holds that id, the lines marked `(Postman riderId)` and `(Postman deliveryId)` equal the environment's `riderId` and `deliveryId`, 5 ids), `TestResetTwiceLeavesDemoRiders` also asserts one delivery after two resets and none of a delivery or location inserted before them.
Commits: `test: delivery demo seed`, then `feat: delivery demo seed`.

- [x] 5.1 Write the tests; `server()` passes `delivery.New(testPool, c)` (c still points at a closed port); red run pasted into the log; commit `test: ...`
- [x] 5.2 The row and the summary per design.md Decision 13 and Data model (`truncateTables` already changed by 3.0)
- [x] 5.3 Gates green; commit `feat: ...`

## 7. Contract examples match the seed, and delivered is rider-scoped (worker, after 4 and 5)

Scope: `services/rider/openapi.json`, `services/rider/internal/app/deliveries_test.go`, the generated Postman collection.
Scenarios: "Riders list and read their deliveries" ("Another rider's delivery", for the delivered route); the rider-service "Rider API contract" (examples are documentation, Spec 1 §11).
Starts from: `services/rider/internal/app/deliveries_test.go` `TestDeliveredOtherRidersDelivery` (rider B posts delivered on rider A's assigned delivery: 404 `not_found`, A's delivery still `assigned`, no core status call). Plus one row in `TestPutLocationRefusals`: `{"lat": null, "lng": 77.5}` is 400 on `lat` (R4). Both pass against the current code: it is a guard for a write path no test covers, so its commit is `test:` alone and the openapi change is `docs:` (no behaviour changes).
Commits: `test: delivered on another rider's delivery is not found; null lat refused`, then `docs: delivery examples match the demo seed`.

- [x] 7.1 Write the test; run it (green is expected; paste the line); commit `test: ...`
- [x] 7.2 `openapi.json`: every delivery example of the claim-to-delivered flow (the claim's 201, `listDeliveries` 200, and the `delivered` 200 answer; path parameter examples stay as they are, since `make postman` replaces them with `{{deliveryId}}`) uses id `00000000-0000-4000-8000-000000000910` for core's placed demo order `00000000-0000-4000-8000-000000000703` `SS-DEMOAAAD` (items Banana Robusta 1 kg x1 and Pomegranate Bhagwa 1 kg x3, `itemCount` 4, `totalCents` 103000, `Demo Customer`, `+919800000000`, `12 80 Feet Rd, Koramangala`, `560034`, `cod`), the claim example's `orderId` included; `getDelivery`'s 200 answer becomes the seeded row as it is (`delivered`, `deliveredAt`, `SS-DEMOAAAB`, `itemCount` 3, `totalCents` 33900, Banana Robusta x2, Shimla Apple x1); the `delivered` 409 example is unchanged
- [x] 7.3 `make test-rider`, `make gen postman` clean, `openspec validate --all --strict`; commit `docs: ...` with the collection

## 6. Verification (area manager)

- [ ] 6.1 Re-run the gates on the lane head; `go test -race -count=1 ./...` in `services/rider`
- [ ] 6.2 Against `make core` and `make rider` (dev env, demo seed): sign in as a demo store's staff in core and move a demo order to `ready`; as `rider1-koramangala` read `/me/ready-orders`, claim it, read it as the demo customer through `/orders/{id}/delivery`, put a location, see it, mark delivered; core's order shows `riderName` and the two rider events with `actorName`
- [ ] 6.3 Team lead's `/opsx:verify` before the PR
