# Tasks

Six worker tasks, strictly in order, on branch `lane/rider-P5-L2-dispatch` in `.worktrees/rider-P5-L2`. Every hand-written change is a patch in `code/` (design.md, first section). A worker applies the task's patches with `git apply`, regenerates, runs the gates and commits. A patch that does not apply, a red or green that differs from what is written here, or a generated file outside the task's list is a stop-and-report under Blockers in the worker's log; do not improvise. Workers write their own log `.claude/lanes/rider-P5-L2-T<n>.md` (the brief is already in it) and tick this file in their `feat:` commit.

Setup, from the worktree root: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH` (Node 22.11 breaks Vitest); `test -d node_modules || npm ci`.
Databases: tests only, on the per-package schemas of `shopperstop_rider_test`. No `make dev`, `make seed`, `make e2e` or `docker`.
Gates for every task, from the worktree root: `GOFLAGS=-count=1 make test-rider` (every package `ok`); `make gen postman`, then `git status --short` lists only the task's files, and after the commit it is empty; `openspec validate --all --strict` (`0 failed` on the Totals line).
Red check: after applying the test patch (test patches change no SQL, so nothing is regenerated), run from `services/rider`: `go vet ./...` and `SHOPPERSTOP_RIDER_TEST_DATABASE_URL='postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable' go test -count=1 ./internal/... 2>&1 | grep -E '^--- FAIL' | sort -u`. Paste the output into the log.

## 1. Online and offline

Scope: `services/rider/migrations/0005_dispatch.sql`, `services/rider/queries/auth.sql`, `services/rider/internal/auth/{auth,rider,staff}.go`, `services/rider/internal/app/app.go`, `services/rider/internal/seed/seed.go`, `services/rider/openapi.json`; tests `services/rider/internal/app/{availability_test,riders_test}.go`, `services/rider/internal/migrate/migrate_test.go`, `services/rider/internal/seed/seed_test.go`; generated: `services/rider/internal/auth/db/{auth.sql.go,models.go}`, `services/rider/internal/delivery/db/models.go`, `packages/ui/src/api/rider.d.ts`, `docs/postman/shopperstop-rider.postman_collection.json`; this file.
Scenarios: rider-service "Riders go online and offline" (all four), "Riders sign in with email and password" / Sign-in returns a working token, "Riders sign out and read themselves" / Sign-out goes offline, "Staff read and update a rider" / Deactivation goes offline, "Rider schema migrations" / Second run applies nothing; dispatch "One dispatcher tick at a time" (the offline half, via Offline waits for a running tick).
Starts from: `internal/app/availability_test.go` `TestAvailabilityOnlineThenOffline`, `TestOfflineVoidsOpenOffer`, `TestOfflineWaitsForTick`, `TestAvailabilityRefusesMissingValue`, `TestSignOutGoesOffline`, `TestDeactivationGoesOffline`; `riders_test.go` `TestRiderSignIn`; `migrate_test.go` `TestEmbeddedMigrationsApplyOnce`. Red: those eight plus the seed tests that truncate (`TestLoadTwiceFails`, `TestResetTwiceLeavesDemoRiders`, `TestSeededDeliveryInHistory`, `TestSummaryMatchesSeed`; the relation `offers` does not exist yet).
Commits: `test: riders go online and offline, and offline voids the open offer`, then `feat: rider availability, offers table, offline waits for the dispatch lock`.

- [x] 1.1 `git apply openspec/changes/rider-dispatch/code/T1-test.diff`; red check; commit the four test files and the log.
- [x] 1.2 `git apply .../code/T1-feat.diff`; `make gen postman`; gates; tick 1.1 and 1.2; commit.

## 2. The rider's offer: read, accept, decline

Scope: `services/rider/internal/coretest/coretest.go` (fix), `services/rider/queries/deliveries.sql`, `services/rider/internal/delivery/{delivery,offer}.go`, `services/rider/internal/app/app.go`, `services/rider/openapi.json`; test `services/rider/internal/app/offers_test.go`; generated: `services/rider/internal/delivery/db/{deliveries.sql.go,models.go}`, `rider.d.ts`, the rider Postman collection; this file.
Scenarios: dispatch "Riders read their open offer" (both), "Riders accept an offer" (all three), "An offer never beats a claim" (all four), "Riders decline an offer", "Dispatch is logged" (the accepted and declined lines).
Starts from: `internal/app/offers_test.go` `TestMyOffer`, `TestMyOfferNoneWhenExpiredOrClaimed`, `TestAcceptOffer`, `TestAcceptRefusals`, `TestAcceptCoreFails`, `TestHandClaimWhileOffered`, `TestAcceptOrderLeftReady`, `TestAcceptRacesHandClaims`, `TestAcceptRacesDecline`, `TestDeclineOnce`, `TestOfferAnswersLogged`. Red: exactly those 11, because the routes are not served.
Commits: `fix: fake core copies an order under its lock` (`T2-fix.diff`; red is a `-race` report on `TestConcurrentClaims`/`TestAcceptRacesHandClaims`, design.md Race analysis, so no separate test commit), `test: riders read, accept and decline offers; an offer never beats a claim`, `feat: rider offer routes, accept runs the claim`.

- [ ] 2.1 `git apply .../code/T2-fix.diff`; `GOFLAGS=-count=1 make test-rider` green; commit.
- [ ] 2.2 `git apply .../code/T2-test.diff`; red check; commit.
- [ ] 2.3 `git apply .../code/T2-feat.diff`; `make gen postman`; gates; also `cd services/rider && go test -race -count=20 -run 'TestAcceptRaces|TestConcurrentClaims' ./internal/app/` (with the test URL) green; tick 2.1 to 2.3; commit.

## 3. The dispatcher: config, tick, loop

Scope: `services/rider/sqlc.yaml`, `services/rider/queries/dispatch.sql` (new), `services/rider/internal/dispatch/dispatch.go` (new), `services/rider/internal/config/config.go`, `services/rider/cmd/rider/main.go`; tests `services/rider/internal/dispatch/dispatch_test.go` (new), `services/rider/internal/config/config_test.go`; generated: `services/rider/internal/dispatch/db/{db.go,dispatch.sql.go,models.go}` (new); this file.
Scenarios: dispatch "Dispatch configuration" (all three), "One dispatcher tick at a time" (A held lock skips the tick, Concurrent ticks make one offer, The loop ticks), "A tick expires open offers" (both), "A tick offers free ready orders to free candidates" (all four), "Offers hold the order as core showed it", "Dispatch is logged" (the made and expired lines).
Starts from: `internal/dispatch/dispatch_test.go` `TestTickTwoOrdersTwoRiders`, `TestTickSkipsRidersWhoCannotTakeIt`, `TestTickDeclineMovesOnThenRests`, `TestTickExpiresAndCascades`, `TestTickExpiresOfferOfClaimedOrder`, `TestTickSkipsWhileLocked`, `TestConcurrentTicksOneOffer`, `TestTickCoreFailureSkipsStore`, `TestTickSnapshot`, `TestTickLogs`, `TestRunTicks`; `internal/config/config_test.go` `TestDispatchDefaults`, `TestDispatchOff`, `TestDispatchBadValuesNamed`. Red: `go vet` prints `cfg.DispatchInterval undefined` and `undefined: Dispatcher`.
Commits: `test: dispatcher config, tick and loop`, then `feat: dispatcher tick offers ready orders to free online riders`.

- [ ] 3.1 `git apply .../code/T3-test.diff`; red check; commit.
- [ ] 3.2 `git apply .../code/T3-feat.diff`; `make gen postman` (creates `internal/dispatch/db/`; `openapi.json` is untouched, so `rider.d.ts` and Postman do not change); gates; tick 3.1 and 3.2; commit.

## 4. The staff dispatch read

Scope: `services/rider/queries/dispatch.sql`, `services/rider/internal/dispatch/admin.go` (new), `services/rider/internal/app/app.go`, `services/rider/cmd/rider/main.go`, `services/rider/openapi.json`, the extra `nil` argument in `services/rider/internal/app/{app_test,riders_test,deliveries_test,contract_test}.go`, `services/rider/internal/seed/seed_test.go`, `services/rider/cmd/rider-admin/main_test.go`; test `services/rider/internal/app/dispatch_test.go` (new); generated: `services/rider/internal/dispatch/db/dispatch.sql.go`, `rider.d.ts`, the rider Postman collection; this file.
Scenarios: dispatch "Staff read an order's dispatch" (Offers newest first, Store isolation, Dispatch off: the dispatcher-off half).
Starts from: `internal/app/dispatch_test.go` `TestOrderDispatchOffersNewestFirst`, `TestOrderDispatchLatestTen`, `TestOrderDispatchStoreIsolation`, `TestOrderDispatchOffWhenDispatcherOff`. Red: `go vet` prints `too many arguments in call to New`.
Commits: `test: staff read an order's dispatch`, then `feat: staff dispatch read for the board`.

- [ ] 4.1 `git apply .../code/T4-test.diff`; red check; commit.
- [ ] 4.2 `git apply .../code/T4-feat.diff`; `make gen postman`; gates; tick 4.1 and 4.2; commit.

## 5. The offer seed

Scope: `services/rider/internal/seed/{seed,summary}.go`; test `services/rider/internal/seed/seed_test.go`; this file.
Scenarios: dispatch "Offer demo seed".
Starts from: `internal/seed/seed_test.go` `TestSeededOffer`, `TestSummaryMatchesSeed` (now 6 ids and `offerId`). Red: exactly those two.
Commits: `test: seed holds an expired demo offer`, then `feat: seed an expired offer for the delivered demo order`.

- [ ] 5.1 `git apply .../code/T5-test.diff`; red check; commit.
- [ ] 5.2 `git apply .../code/T5-feat.diff`; gates (`make gen postman` changes nothing); tick 5.1 and 5.2; commit.

## 6. Store location and ETA ranking

core-P5-L2 is on main (#360): `Store.location {lat, lng}` on `GET /stores/{id}`, omitted when unset. Before starting, `git log origin/main --oneline | grep -i "core-P5-L2\|store location"` must show it and the lane branch must already have merged origin/main.
Scope: `services/rider/internal/core/core.go`, `services/rider/internal/dispatch/{dispatch,admin}.go`, `services/rider/internal/dispatch/eta.go` (new); tests `services/rider/internal/dispatch/dispatch_test.go`, `services/rider/internal/app/dispatch_test.go`; this file.
Scenarios: dispatch "Candidates rank by ETA to the store" (all four), "Staff read an order's dispatch" / Dispatch off (the no-location half).
Starts from: `internal/dispatch/dispatch_test.go` `TestETA`, `TestTickNearerRiderFirst`, `TestTickSameMinuteLongerIdle`, `TestTickIdleCountsFromLastDelivery`, `TestTickWithin100mIsZero`, `TestTickStoreWithoutLocation`; `internal/app/dispatch_test.go` `TestOrderDispatchOffWithoutLocation`. Red: `go vet` prints `undefined: core.StoreLocation`.
Commits: `test: candidates rank by ETA to the store; no location, no dispatch`, then `feat: store location from core and ETA ranking`.

- [ ] 6.1 `git apply .../code/T6-test.diff`; red check; commit.
- [ ] 6.2 `git apply .../code/T6-feat.diff`; gates (`make gen postman` changes nothing); tick 6.1 and 6.2; commit.

## 7. Verification (manager) and acceptance (team lead)

- [ ] 7.1 Manager: `make e2e` with the lane merged with main (the Phase 3 rider flow and every suite unchanged, with dispatch on at 3 s); live, on throwaway schemas, core with migrations and seed plus the rider service with migrations and seed: two demo riders of Koramangala go online and put positions 500 m and 2 km from 12.9352, 77.6245; staff ready an order; within one tick the nearer rider's `GET /me/offer` is 200; decline moves it to the other; accept answers 201 and core shows `out_for_delivery` with the rider; `GET /admin/orders/{id}/dispatch` shows the offers and `dispatch` `on`; the log carries the four offer lines; no nulls in any body.
- [ ] 7.2 Team lead: `/opsx:verify rider-dispatch`: every scenario in the deltas has a passing test (map below), tasks 1 to 6 ticked, the hand-written files equal the patches, nothing else landed.

Scenario to test map: rider-service: Online, then offline `TestAvailabilityOnlineThenOffline`; Going offline voids the open offer `TestOfflineVoidsOpenOffer`; Offline waits for a running tick `TestOfflineWaitsForTick`; Missing value `TestAvailabilityRefusesMissingValue`; Sign-in returns a working token `TestRiderSignIn`; Refusals look the same `TestRiderSignInRefusalsLookTheSame`; Sign-out ends only that session `TestRiderSignOutEndsOnlyThatSession`; Sign-out goes offline `TestSignOutGoesOffline`; Another store's rider is not found `TestRiderOfAnotherStoreNotFound`; Deactivation ends sessions `TestDeactivationEndsSessions`; Deactivation goes offline `TestDeactivationGoesOffline`; Password reset `TestPatchResetsPassword`; migrations' four scenarios `internal/migrate` (`TestEmbeddedMigrationsApplyOnce` and the existing three). dispatch: Defaults / Dispatcher off / Bad values named `TestDispatchDefaults` / `TestDispatchOff` / `TestDispatchBadValuesNamed`; A held lock skips the tick `TestTickSkipsWhileLocked`; Concurrent ticks make one offer `TestConcurrentTicksOneOffer`; The loop ticks `TestRunTicks`; Expired then offered to the next rider `TestTickExpiresAndCascades`; A claimed order's offer expires `TestTickExpiresOfferOfClaimedOrder`; Two orders, two riders `TestTickTwoOrdersTwoRiders`; Riders who cannot take it `TestTickSkipsRidersWhoCannotTakeIt`; Decline moves on, then a 2-minute rest `TestTickDeclineMovesOnThenRests`; Core failing skips the store `TestTickCoreFailureSkipsStore`; Snapshot kept `TestTickSnapshot`; Nearer rider first `TestTickNearerRiderFirst`; Same minute, longer idle first `TestTickSameMinuteLongerIdle` (with `TestTickIdleCountsFromLastDelivery`); Within 100 metres is zero `TestTickWithin100mIsZero` (and `TestETA`); Store without a location `TestTickStoreWithoutLocation`; Open offer read `TestMyOffer`; Nothing to read `TestMyOfferNoneWhenExpiredOrClaimed` (no offer: `TestMyOffer`); Accept is a claim `TestAcceptOffer`; Refusals `TestAcceptRefusals`; Core fails `TestAcceptCoreFails`; Hand claim while offered `TestHandClaimWhileOffered`; Order left ready `TestAcceptOrderLeftReady`; Accept races hand claims `TestAcceptRacesHandClaims`; Accept races decline `TestAcceptRacesDecline`; Decline once `TestDeclineOnce`; Offers newest first `TestOrderDispatchOffersNewestFirst` (and `TestOrderDispatchLatestTen`); Store isolation `TestOrderDispatchStoreIsolation`; Dispatch off `TestOrderDispatchOffWhenDispatcherOff`, `TestOrderDispatchOffWithoutLocation`; Offer lines `TestTickLogs` (made, expired) and `TestOfferAnswersLogged` (accepted, declined); Seeded offer `TestSeededOffer`, `TestSummaryMatchesSeed`.
