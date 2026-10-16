Every task runs in the worktree `.worktrees/rider-P3-L2` on branch `lane/rider-P3-L2-deliveries`. Order: 1, then 2, then 3, then 4 and 5 in parallel (task 5 touches only `services/rider/internal/seed/`; task 4 never does), then 6 (the manager's). Each worker keeps its log in `.claude/lanes/rider-P3-L2-T<n>.md`, ticks its own boxes here, and never runs `make db`, `make dev`, `make prod-local` or `make seed` (only `make -n`), nor `docker` anything. Node for `make gen` and `make postman`: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`, `npm ci` once at the worktree root if `node_modules` is absent. Single test: `cd services/rider && SHOPPERSTOP_RIDER_TEST_DATABASE_URL='postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable' go test -race -run TestName ./internal/<pkg>`.

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

- [ ] 2.1 Write the tests (design.md Test strategy); red run pasted into the log; commit `test: ...`
- [ ] 2.2 `0003_deliveries.sql` exactly per design.md Data model; `sqlc.yaml` second entry; `queries/deliveries.sql` (all queries named in design.md, so tasks 3 and 4 add none); `make gen`
- [ ] 2.3 `internal/delivery`: `New`, types, `ReadyOrders` (Decision 9), `Claim` (Decisions 3 and 8); `app.New(pool, origins, a, d)` with the two routes (Decision 14); `cmd/rider` builds `delivery.New(pool, c)`
- [ ] 2.4 `openapi.json`: tag `deliveries`, schemas `ReadyOrder`, `ReadyOrderList`, `DeliveryClaim`, `Delivery`, `DeliveryItem`, `DeliveryAddress`, the two operations with every code of the routes table and examples
- [ ] 2.5 Gates green, `make gen postman` clean after the commit; commit `feat: ...`

## 3. A rider's deliveries and marking delivered (worker, after 2)

Scope: `services/rider/internal/delivery/` (not `db/`), `services/rider/internal/app/` (`app.go`, `deliveries_test.go`), `services/rider/openapi.json`, the generated Postman collection.
Scenarios: "Riders list and read their deliveries" (both), "Riders mark a delivery delivered" (both), "Claims and deliveries are logged".
Starts from: `services/rider/internal/app/deliveries_test.go` `TestListDefaultsToAssigned`, `TestListDelivered`, `TestListBadStatus` (400 `status`), `TestGetOtherRidersDelivery` (and unknown id and `not-a-uuid` 404), `TestDeliveredOnce`, `TestDeliveredStaysAssignedWhenCoreFails`, `TestClaimAndDeliveredLogged`.
Commits: `test: rider deliveries list, read and delivered`, then `feat: rider deliveries list, read and delivered`.

- [ ] 3.1 Write the tests; red run pasted into the log; commit `test: ...`
- [ ] 3.2 `List`, `Get`, `Delivered` (Decisions 4 and 11), both log lines (Decision 12; the claim log goes into `Claim` here); the three routes
- [ ] 3.3 `openapi.json`: schema `DeliveryList`, the three operations with every code and examples
- [ ] 3.4 Gates green, `make gen postman` clean; commit `feat: ...`

## 4. Rider location and the customer's view (worker, after 3; parallel with 5)

Scope: `services/rider/internal/delivery/` (not `db/`), `services/rider/internal/auth/` (`auth.go`, `rider.go`, `staff.go`: only the `Bearer` rename, Decision 2), `services/rider/internal/app/` (`app.go`, `deliveries_test.go`), `services/rider/openapi.json`, the generated Postman collection.
Scenarios: "Riders report their location" (both), "Customers see their order's delivery" (all three).
Starts from: `services/rider/internal/app/deliveries_test.go` `TestPutLocationReplaces`, `TestPutLocationRefusals` (missing `lat`, `lat` 91, `lng` -181: 400 naming the field, nothing stored), `TestCustomerFollowsRider` (body has no `phone`, `email` or rider id key), `TestCustomerLocationHiddenAfterDelivery`, `TestCustomerLocationBeforeClaimHidden`, `TestCustomerReadRefusals` (another customer's token 404, no delivery 404, no token 401 without a core call, unknown token 401).
Commits: `test: rider location and customer delivery view`, then `feat: rider location and customer delivery view`.

- [ ] 4.1 Write the tests; red run pasted into the log; commit `test: ...`
- [ ] 4.2 `auth.Bearer` rename; `PutLocation` (Decision 10), `OrderDelivery` (Decisions 6 and 7); the two routes
- [ ] 4.3 `openapi.json`: schemas `LocationUpdate`, `Location`, `CustomerDelivery`, the two operations with every code and examples
- [ ] 4.4 Gates green, `make gen postman` clean; commit `feat: ...`

## 5. Delivery demo seed (worker, after 3; parallel with 4)

Scope: `services/rider/internal/seed/` only.
Scenarios: "Delivery demo seed" (both); rider-service's "Seed needs no core" and "Reset twice leaves the demo riders" stay green.
Starts from: `services/rider/internal/seed/seed_test.go` `TestSeededDeliveryInHistory` (sign in as `rider1-koramangala@shopperstop.local`, `GET /me/deliveries?status=delivered` lists `...0901` with `orderNumber` `SS-DEMOAAAB`, `itemCount` 3, `totalCents` 33900), the extended `TestSummaryMatchesSeed` (id regex `0000000008xx|0000000009xx`, each id line's table `riders` or `deliveries` holds that id, the lines marked `(Postman riderId)` and `(Postman deliveryId)` equal the environment's `riderId` and `deliveryId`, 5 ids), `TestResetTwiceLeavesDemoRiders` also asserts one delivery after two resets and none of a delivery or location inserted before them.
Commits: `test: delivery demo seed`, then `feat: delivery demo seed`.

- [ ] 5.1 Write the tests; `server()` passes `delivery.New(testPool, c)` (c still points at a closed port); red run pasted into the log; commit `test: ...`
- [ ] 5.2 `truncateTables`, the row and the summary per design.md Decision 13 and Data model
- [ ] 5.3 Gates green; commit `feat: ...`

## 6. Verification (area manager)

- [ ] 6.1 Re-run the gates on the lane head; `go test -race -count=1 ./...` in `services/rider`
- [ ] 6.2 Against `make core` and `make rider` (dev env, demo seed): sign in as a demo store's staff in core and move a demo order to `ready`; as `rider1-koramangala` read `/me/ready-orders`, claim it, read it as the demo customer through `/orders/{id}/delivery`, put a location, see it, mark delivered; core's order shows `riderName` and the two rider events with `actorName`
- [ ] 6.3 Team lead's `/opsx:verify` before the PR
