## ADDED Requirements

### Requirement: Dispatch configuration
The rider service SHALL read four optional variables: `SHOPPERSTOP_RIDER_DISPATCH_INTERVAL` (default `3s`; `0` turns the dispatcher off), `SHOPPERSTOP_RIDER_DISPATCH_OFFER_TTL` (default `30s`), `SHOPPERSTOP_RIDER_DISPATCH_LOCATION_TTL` (default `2m`) and `SHOPPERSTOP_RIDER_DISPATCH_SPEED_KMH` (default `20`). Durations SHALL use Go duration syntax; the interval SHALL be zero or more, the others more than zero. Every invalid value SHALL be named in the one load error.

#### Scenario: Defaults
- **WHEN** the configuration is loaded with every required variable set and none of the four
- **THEN** the interval is 3 s, the offer TTL 30 s, the location TTL 2 minutes and the speed 20 km/h

#### Scenario: Dispatcher off
- **WHEN** `SHOPPERSTOP_RIDER_DISPATCH_INTERVAL` is `0`
- **THEN** loading succeeds with the dispatcher off

#### Scenario: Bad values named
- **WHEN** the interval is `3`, the offer TTL `-1s`, the location TTL `0` and the speed `fast`
- **THEN** loading fails with one error naming all four variables

### Requirement: One dispatcher tick at a time
The rider service SHALL run a dispatcher tick every interval while the dispatcher is on. A tick SHALL run in one database transaction holding `pg_try_advisory_xact_lock` on the dispatch key, and SHALL do nothing when another transaction holds that key. Every path that takes a rider offline SHALL first wait for that key, so a tick never offers to a rider who went offline during it.

#### Scenario: A held lock skips the tick
- **WHEN** another transaction holds the dispatch key and a tick runs with a free ready order and a free candidate
- **THEN** the tick returns without error and makes no offer, and a tick after the key is released makes the offer

#### Scenario: Concurrent ticks make one offer
- **WHEN** two ticks run at once for one free ready order and two free candidates
- **THEN** both return without error and exactly one offer exists

#### Scenario: The loop ticks
- **WHEN** the dispatcher runs with a 10 ms interval, a free ready order and a free candidate
- **THEN** an offer appears within 2 seconds, and the loop stops when its context ends

### Requirement: A tick expires open offers
A tick at time `now` SHALL first mark `expired`, with `answeredAt` `now`, every `offered` offer whose expiry is at or before `now` or whose order a delivery now holds.

#### Scenario: Expired then offered to the next rider
- **WHEN** a tick offers an order to rider A, A does not answer, and a tick 31 seconds later runs with rider B also free
- **THEN** A's offer is `expired` and B holds a new open offer for the order

#### Scenario: A claimed order's offer expires
- **WHEN** an open offer's order has a delivery and a tick runs
- **THEN** the offer is `expired`

### Requirement: A tick offers free ready orders to free candidates
For each store with an online rider a tick SHALL read core's `ready` orders, drop those a delivery or an open offer holds, and offer each remaining order, oldest `placedAt` first, to the best candidate: an online rider of the store with a position recorded after `now` minus the location TTL, no `assigned` delivery, no open offer, and no `declined` or `expired` offer of that order answered in the last 2 minutes. A rider gets at most one offer per tick; an order without one is left alone.

#### Scenario: Two orders, two riders
- **WHEN** two ready orders and two free candidates are at a store
- **THEN** one tick makes two offers, the older order to the better-ranked rider

#### Scenario: Riders who cannot take it
- **WHEN** the only riders at a store are offline, or have a position older than the location TTL, or have an assigned delivery
- **THEN** a tick makes no offer

#### Scenario: Decline moves on, then a 2-minute rest
- **WHEN** rider A declines an offer and a tick runs with rider B free, then B declines and a tick runs, then a tick runs 2 minutes and 1 second after B's decline
- **THEN** the first tick offers to B, the second makes no offer, and the third offers the order again

#### Scenario: Core failing skips the store
- **WHEN** core answers 500 to the store's ready orders
- **THEN** the tick returns without error and makes no offer

### Requirement: Offers hold the order as core showed it
A new offer SHALL be `offered`, `offeredAt` the tick's time and `expiresAt` that plus the offer TTL, and SHALL keep core's order id, number, store, placement time, item count (sum of line quantities), total, payment method, payment status when core has one, the delivery pincode and the rider's ETA in seconds, so the offer is read without core.

#### Scenario: Snapshot kept
- **WHEN** a tick offers a ready online order whose payment core holds as `paid`
- **THEN** the offer row holds the order's number, item count, total, `online`, `paid`, pincode, placement time, and an expiry 30 seconds after the tick

### Requirement: Candidates rank by ETA to the store
A candidate's ETA SHALL be the haversine distance from their position to the store's location divided by the configured speed, in whole seconds, and 0 within 100 metres. Candidates SHALL rank by ETA floored to the minute, then by the longer idle time (since the later of going online and their last delivery), then by rider id. A store whose location core omits SHALL get no offers.

#### Scenario: Nearer rider first
- **WHEN** rider A is 2 km and rider B 500 m from the store, both free
- **THEN** the tick offers to B with an ETA of 90 seconds at 20 km/h

#### Scenario: Same minute, longer idle first
- **WHEN** rider A is 300 m away and online for 10 minutes and rider B is 150 m away and online for 5 minutes
- **THEN** the tick offers to A

#### Scenario: Within 100 metres is zero
- **WHEN** the only free rider is 50 m from the store
- **THEN** the offer's ETA is 0

#### Scenario: Store without a location
- **WHEN** core answers the store without `location` and the store has a free ready order and a free candidate
- **THEN** the tick makes no offer

### Requirement: Riders read their open offer
`GET /me/offer` SHALL answer 200 with the signed-in rider's open offer as `Offer` `{id, orderId, number, placedAt, itemCount, totalCents, paymentMethod, paymentStatus?, pincode, etaSeconds, offeredAt, expiresAt}`, or 204 with no body when the rider has none. An offer past its expiry, or whose order a delivery holds, SHALL count as none before a tick marks it.

#### Scenario: Open offer read
- **WHEN** a rider with an open cash offer reads it
- **THEN** the answer is 200 with its fields and no `paymentStatus` member

#### Scenario: Nothing to read
- **WHEN** a rider has no offer, an offer past its expiry, or an open offer whose order another rider claimed
- **THEN** each answer is 204 with an empty body

### Requirement: Riders accept an offer
`POST /me/offers/{id}/accept` SHALL, in one transaction, mark the rider's open, unexpired offer `accepted` and run the claim of that order (delivery insert, core `out_for_delivery` with the rider as actor), answering 201 `Delivery`. Another rider's offer, an unknown id or a non-uuid SHALL be 404; an answered or expired offer SHALL be 409 `conflict` with no core call. When core fails the offer SHALL stay open, the answer 502.

#### Scenario: Accept is a claim
- **WHEN** a rider accepts their open offer
- **THEN** the answer is 201 with an `assigned` delivery of the order, the offer is `accepted`, and core received `out_for_delivery` with the rider as actor

#### Scenario: Refusals
- **WHEN** a rider accepts another rider's offer, an unknown id, and their own offer past its expiry
- **THEN** the first two are 404 `not_found`, the third 409 `conflict`, no delivery exists and core received no status change

#### Scenario: Core fails
- **WHEN** core answers 500 to the status change
- **THEN** the answer is 502 `internal`, no delivery exists, the offer is still `offered`, and a retry after core recovers answers 201

### Requirement: An offer never beats a claim
When the offer's order already has a delivery, or core no longer holds it as `ready`, accepting SHALL mark the offer `expired` and answer 409 `conflict` with no delivery for the rider. A rider's hand claim (`POST /me/deliveries`) of an order offered to another rider SHALL succeed as before. An offer SHALL be answered once: concurrent answers SHALL leave exactly one effect.

#### Scenario: Hand claim while offered
- **WHEN** an order is offered to rider A, rider B claims it by hand, then A accepts
- **THEN** B's claim is 201, A's accept is 409 `conflict`, A's offer is `expired`, one delivery exists and core received one status change

#### Scenario: Order left ready
- **WHEN** core holds the offered order as `cancelled` and the rider accepts
- **THEN** the answer is 409 `conflict`, the offer is `expired` and no delivery exists

#### Scenario: Accept races hand claims
- **WHEN** rider A accepts their offer while four other riders of the store claim the same order by hand, all at once
- **THEN** exactly one answer is 201 and the others 409, one delivery exists, core received one status change, and the offer is `accepted` exactly when A's answer is 201, else `expired`

#### Scenario: Accept races decline
- **WHEN** a rider sends accept and decline for one open offer at once
- **THEN** one answer succeeds (201 or 204), the other is 409 `conflict`, and the offer's status matches the one that succeeded

### Requirement: Riders decline an offer
`POST /me/offers/{id}/decline` SHALL mark the rider's open, unexpired offer `declined` with `answeredAt` and answer 204. Another rider's offer, an unknown id or a non-uuid SHALL be 404; an answered or expired offer SHALL be 409 `conflict`.

#### Scenario: Decline once
- **WHEN** a rider declines their open offer, then declines it again, then accepts it
- **THEN** the first answer is 204 and the offer is `declined`; the second and third are 409 `conflict`

### Requirement: Staff read an order's dispatch
`GET /admin/orders/{orderId}/dispatch` SHALL read the order from core with the service token and answer `{online, dispatch, offers}`: the count of online riders at its store, `dispatch` `on` or `off` (off while the dispatcher is off or the store has no location), and its latest 10 offers newest first as `{id, riderName, status, etaSeconds, offeredAt, answeredAt?}`. Store staff SHALL get 404 for another store's order, as for an unknown one.

#### Scenario: Offers newest first
- **WHEN** an admin reads an order with an expired offer to rider A and a newer open offer to rider B, while two riders of the store are online
- **THEN** the answer has `online` 2, `dispatch` `on`, and B's open offer (no `answeredAt`) before A's expired one

#### Scenario: Store isolation
- **WHEN** store staff of another store read the order, store staff of its store read it, and an admin reads an unknown order
- **THEN** the answers are 404, 200 and 404

#### Scenario: Dispatch off
- **WHEN** the dispatcher is off, or core answers the order's store without a location
- **THEN** the answer has `dispatch` `off`

### Requirement: Dispatch is logged
Each offer a tick makes SHALL log `offer made` with `offerId`, `orderId`, `number`, `riderId` and `etaSeconds`; each offer a tick expires `offer expired` with `offerId`, `orderId`, `number` and `riderId`; each accept `offer accepted` and each decline `offer declined` with `offerId`, `orderId`, `number`, `riderId` and `requestId`; all at info.

#### Scenario: Offer lines
- **WHEN** a tick makes an offer, a later tick expires it and makes a second one, the second rider accepts, and a third offer is declined
- **THEN** the log holds one line of each of the four messages for the matching offer with those fields

### Requirement: Offer demo seed
`rider-admin seed-demo --reset` SHALL also load, without calling core, an `expired` offer with id `00000000-0000-4000-8000-000000000902` to rider `...0801` for core's delivered demo order `...0701` (`SS-DEMOAAAB`) at store `...0401`, and print it marked as the Postman `offerId`. Every demo rider SHALL be offline.

#### Scenario: Seeded offer
- **WHEN** the seed is reset
- **THEN** offer `...0902` exists `expired` for rider `...0801` and order number `SS-DEMOAAAB`, the summary prints it with `(Postman offerId)`, rider `...0801` reads 204 from `GET /me/offer`, and no rider is online
