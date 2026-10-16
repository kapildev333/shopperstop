# Tasks

Six worker tasks, in order (task 5 is a fix after the task 2 review, task 6 a test gap found at acceptance; neither is in `design.md`), on branch `lane/core-P5-L1-payments` in `.worktrees/core-P5-L1`. Every code block is verbatim in `design.md` ("Task 1" to "Task 4"); a choice neither file settles is a stop-and-report.

Databases (D26): tests only, on the per-run schemas of `shopperstop_core_test`. No `core-admin migrate`, no `seed-demo`, no `make dev`/`make seed`/`make e2e`, no client on `shopperstop_core` or `shopperstop_core_e2e`, no `docker`. Never run the archived Phase 3 `check-wiring.sh` (it starts a real rider on :8081 against the dev database).

Gates, from `services/core` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL=postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`: `gofmt -l .` empty, `go vet ./...`, `go test -race -count=1 ./...`. From the worktree root with `PATH=$HOME/.local/node-v22.23.3/bin:$PATH` (`npm ci` once if `node_modules` is missing): `make gen postman`, then `git status --short` clean after the last commit; `make test-web`; `openspec validate --all --strict`.

## 1. Payment method on placement and reads

Scope: `services/core/migrations/0011_payments.sql` (new), `services/core/queries/order.sql` (`CreateOrder`), sqlc output (every `services/core/internal/*/db/models.go`, `services/core/internal/order/db/order.sql.go`; regenerated only), `services/core/internal/order/{order.go,place.go,handlers.go,schema_test.go}`, `services/core/internal/app/{orders_test.go,orders_payment_test.go}`, `services/core/openapi.json` (Task 1 script), generated `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json`, this file (ticks). Scenarios: orders "Customers pay cash or online" (all three), "Paying online needs a verified email"; platform "Error envelope" / The contract lists every code (`email_unverified`). Starts from `internal/app/orders_payment_test.go` `TestPlaceOnline` (red: `paymentMethod` `cod`), `TestPlaceCash` (stays green: pins today's cash answer), `TestPlaceOnlineUnverified` (red: 201), `TestPlacePaymentMethodInvalid` (red: 201) and `internal/order/schema_test.go` `TestPaymentStatusMatchesMethod` (red: no `payment_status` column). Commits: `test: cash or online placement and the verified-email rule`, `feat: payment method and status on orders (migration 0011)`.

- [x] 1.1 `git apply --include='*_test.go'` the Task 1 block; run `go test -race -count=1 -run 'TestPlace|TestPaymentStatusMatchesMethod' ./internal/app ./internal/order` and see the four failures above; commit.
- [x] 1.2 `git apply --exclude='*_test.go'` the Task 1 block; `make gen`; run the Task 1 `openapi.json` script; `make gen postman`; run the gates; tick 1.1 and 1.2; commit.

## 2. Payment route, accept guard, service actor table, services per route

Scope: `services/core/queries/order.sql` (`LockOrder`, `SetPayment`), sqlc output (`services/core/internal/order/db/order.sql.go`; regenerated only), `services/core/internal/order/{handlers.go,status.go,payment.go}` (`payment.go` new), `services/core/internal/auth/{auth.go,auth_test.go}`, `services/core/internal/app/{app.go,app_test.go,contract_test.go,service_test.go,orders_payment_test.go}`, `services/core/internal/config/config_test.go`, `services/core/openapi.json` (Task 2 script), generated `core.d.ts` and the Postman collection, this file (ticks). Scenarios: orders "Staff accept only paid online orders" (both), "The payment service marks payments paid or refunded" (all four), "A service moves orders for a rider" (all seven), "Transitions are recorded", "Orders name their rider"; platform "Service tokens are configured" / The Makefile tokens are accepted, "Services reach the rider's admin routes" (all five), "The contract names the service routes" (both), "Error envelope" (`payment_pending`). Starts from `internal/app/orders_payment_test.go` `TestAcceptAwaitsPayment`, `TestPaymentPaidThenRefunded`, `TestPaymentConflicts`, `TestPaymentValidation`, `TestPaymentRouteForServicesOnly`, `TestPaymentTimeoutCancels`, `TestPaymentServiceActorRules`, `TestPendingOnlineOrderCancels`; `internal/app/service_test.go` `TestServiceRoutesByName` (red: 404 on the payment route, payment token admitted on store reads, 403 on the timeout cancel); `internal/auth/auth_test.go` (red: does not compile, `OrService` takes no names); `internal/config/config_test.go` `TestLoadServiceTokens` (stays green: pins the two-entry Makefile value). Commits: `test: payment route, accept guard, payment actor and services per route`, `feat: payment route and the payment service actor`.

- [x] 2.1 `git apply --include='*_test.go'` the Task 2 block; run `go test -race -count=1 ./internal/app ./internal/auth ./internal/config` and see the failures above; commit.
- [x] 2.2 `git apply --exclude='*_test.go'` the Task 2 block; `make gen`; run the Task 2 `openapi.json` script; `make gen postman`; run the gates; tick 2.1 and 2.2; commit.

## 3. Events feed and commit-ordered seq

Scope: `services/core/queries/order.sql` (`LockEvents`, `EventFeed`), sqlc output (`services/core/internal/order/db/order.sql.go`; regenerated only), `services/core/internal/order/{order.go,place.go,status.go,payment.go,events.go}` (`events.go` new), `services/core/internal/app/{app.go,order_events_test.go}` (test new), `services/core/openapi.json` (Task 3 script), generated `core.d.ts` and the Postman collection, this file (ticks). Scenarios: orders "Services tail order events" (all three), "Event numbers follow commit order". Starts from `internal/app/order_events_test.go` `TestEventFeedTailsPlacements`, `TestEventFeedValidation`, `TestEventFeedForServicesOnly` (red: 404) and `TestEventWritesWaitForTheEventsLock` (red: the status change answers 200 while the lock is held). Commits: `test: events feed and commit-ordered seq`, `feat: GET /admin/order-events under the events lock`.

- [x] 3.1 `git apply --include='*_test.go'` the Task 3 block; run `go test -race -count=1 -run 'EventFeed|EventWrites' ./internal/app` and see the four fail; commit.
- [x] 3.2 `git apply --exclude='*_test.go'` the Task 3 block; `make gen`; run the Task 3 `openapi.json` script; `make gen postman`; run the gates; tick 3.1 and 3.2; commit.

## 4. Demo order paid online

Scope: `services/core/internal/seed/{seed.go,seed_test.go,summary.go}`, this file (ticks). Scenarios: orders "The demo order paid online", "Demo orders" (both). Starts from `internal/seed/seed_test.go` `TestResetLoadsDemoOrders` (red: 3 orders, want 4), `TestDemoOrdersThroughTheRouter` (red: total 3) and `TestSummaryMatchesSeed` (red: 12 ids, want 13). Commits: `test: demo order SS-DEMOAAAE paid online`, `feat: seed SS-DEMOAAAE paid online`.

- [x] 4.1 `git apply --include='*_test.go'` the Task 4 block; run `go test -race -count=1 ./internal/seed` and see the three fail; commit.
- [x] 4.2 `git apply --exclude='*_test.go'` the Task 4 block; run the gates (no `openapi.json` change; `make gen postman` stays clean); tick 4.1 and 4.2; commit.

## 5. System cancel only while payment is pending

Scope: `services/core/internal/order/status.go`, `services/core/internal/app/orders_payment_test.go`, `services/core/openapi.json` (the status route's 409 description, one sentence), generated `core.d.ts` and the Postman collection if `openapi.json` changes, this change (`specs/orders/spec.md`, `design.md`, this file). Scenario: orders "The payment service cannot cancel a paid order" (and the existing "Payment timeout"). Starts from `internal/app/orders_payment_test.go` `TestSystemCancelNeedsPendingPayment` (red: a paid order is cancelled with 200). Commits: `test: the payment service cannot cancel a paid or cash order`, `fix: system cancel only while payment is pending`.

- [x] 5.1 Add `TestSystemCancelNeedsPendingPayment`: a paid online order and a cash order are refused 409 `conflict` with status, events and stock unchanged; the pending timeout still cancels 200; run it and see it fail; commit.
- [x] 5.2 In `Transition`, after the table check, refuse a `system` cancel unless the payment is `pending` (409 `conflict`, "only an order awaiting payment can be cancelled by the system"); update the status route's 409 description; `make gen postman`; run the gates; tick 5.1 and 5.2; commit.

## 6. Every answered error code is in the contract

Scope: `services/core/internal/app/{app_test.go,catalog_categories_test.go,orders_payment_test.go}`, this file (ticks). Scenarios: platform "Error envelope" / The contract lists every code (`email_unverified`, `payment_pending`); orders "The payment service cannot cancel a paid order" (events of the cash order). Test-only: the behaviour already holds, so the red is shown by mutation (drop `payment_pending` from the `Error` code enum in `openapi.json`, see `TestAcceptAwaitsPayment` fail, restore). Commit: `test: every error code a test expects is in the contract`.

- [ ] 6.1 Move the `openapi.json` Error enum read out of `TestWrongMethod` into a package-level `errorCodes = sync.OnceValues(...)` in `app_test.go`; `TestWrongMethod` uses it; `expectError` fails when `code` is not in it; in `TestSystemCancelNeedsPendingPayment` assert the cash order still has 1 event after the refused cancel; run the mutation above and see it fail, restore, run the gates; tick 6.1; commit.
