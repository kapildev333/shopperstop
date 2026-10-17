## Why
The owner asked for rider finding "like Uber's algorithm" (PLAN.md D57). Today a ready order waits on the rider app's list until some rider claims it by hand (D32); nobody is told, and the nearest free rider is not preferred. D57 reduces Uber's dispatch to a dark store, where every trip starts at the store: riders say they are online, a dispatcher offers the oldest ready order to the best free online rider for 30 seconds, and an unanswered or declined offer moves on to the next rider. The hand claim stays as the fallback, so the Phase 3 flow, its e2e suites and store self-delivery do not change.

## What Changes
- Availability: a rider is `online` or `offline` (offline by default). `PUT /me/availability {online}` answers the `Rider`, which now carries `isOnline` on every read. Going offline, signing out and staff deactivation take the rider offline and void their open offer.
- Offers: migration `0005_dispatch` adds `riders.is_online`, `riders.online_since` and the `offers` table (snapshots of core's order like `deliveries`, one open offer per order and per rider by partial unique indexes). `GET /me/offer` answers the rider's open offer (200) or nothing (204); `POST /me/offers/{id}/accept` runs the existing claim transaction and answers 201 `Delivery`; `POST /me/offers/{id}/decline` answers 204. An order that left `ready`, or that another rider claimed by hand, voids the offer (409).
- Dispatcher: package `internal/dispatch`, `Tick(ctx, now)` in one transaction under `pg_try_advisory_xact_lock`: expire open offers past their time (or whose order a delivery holds), then per store with an online rider read core's `ready` orders, drop those a delivery or an open offer holds, and offer each, oldest first, to the best candidate: online, a position younger than the location TTL, no assigned delivery, no open offer, no decline or expiry on that order in the last 2 minutes. Ranking: ETA to the store (haversine over a fixed speed, within 100 m is 0) floored to the minute, then longest idle, then id. A store without a location dispatches nothing. `cmd/rider` runs `Tick` every `SHOPPERSTOP_RIDER_DISPATCH_INTERVAL`.
- Config: `SHOPPERSTOP_RIDER_DISPATCH_INTERVAL` (`3s`, `0` turns the loop off), `_OFFER_TTL` (`30s`), `_LOCATION_TTL` (`2m`), `_SPEED_KMH` (`20`); optional, checked at start.
- Staff: `GET /admin/orders/{orderId}/dispatch` answers `{online, dispatch, offers}` for the board line (admin-P5-L2); store staff only for their store's orders.
- Logs: `offer made`, `offer expired`, `offer accepted`, `offer declined`.
- Seed: demo rider `...0801` holds an `expired` offer `00000000-0000-4000-8000-000000000902` on the delivered demo order `SS-DEMOAAAB`, printed by the summary.
- `openapi.json` (tag `dispatch`, availability under `rider-service`), `rider.d.ts` (D19) and the rider Postman collection (D23) regenerated.

## Capabilities
### New Capabilities
- `dispatch`: the offers, the dispatcher tick and its ranking, the rider's offer routes, the staff dispatch read, the dispatch configuration, logs and the offer seed.

### Modified Capabilities
- `rider-service`: ADDED "Riders go online and offline"; MODIFIED "Riders sign in with email and password" (`Rider.isOnline`), "Riders sign out and read themselves" (sign-out goes offline), "Staff read and update a rider" (deactivation goes offline) and "Rider schema migrations" (scenario lists `0005_dispatch`).
- `deliveries`: no delta. The work package named it, but the claim, the ready list and the delivery reads do not change: accept reuses the claim transaction and is specified under `dispatch`, and the ready list keeps showing offered orders so the hand claim stays the fallback (design.md Decision 3).

## Impact
- Area: rider. Files: `services/rider/` only (`migrations/0005_dispatch.sql`, `sqlc.yaml`, `queries/{auth,deliveries,dispatch}.sql`, `internal/{auth,delivery,dispatch,config,core,coretest,app,seed}/`, `cmd/rider/`, `openapi.json`, tests); generated `packages/ui/src/api/rider.d.ts` and `docs/postman/shopperstop-rider.postman_collection.json`. Not `apps/rider/` (rider-P5-L3).
- Contracts relied on: core's `GET /api/core/v1/stores/{id}` gaining `location {lat, lng}`, omitted when unset (core-P5-L2, `services/core/openapi.json`; agreed shape, served by the fake core until it lands); core's `GET /admin/stores/{id}/orders?status=ready`, `GET /admin/orders/{id}` and `POST /admin/orders/{id}/status` with the service token, unchanged; core's `GET /admin/me` for staff, unchanged.
- Out of scope: the rider app's toggle, position watch and offer sheet (rider-P5-L3); the admin store form and board line (admin-P5-L2); core's store location (core-P5-L2); push or SSE (polling only); batching several orders per offer; forward dispatch to a rider still on a delivery; windowed global assignment; a routing API.
