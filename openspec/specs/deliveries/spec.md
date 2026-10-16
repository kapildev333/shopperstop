# deliveries Specification

## Purpose
Deliveries in the rider service (`services/rider`): a rider at a store sees core's `ready` orders, claims one (one delivery per order, which moves the core order to `out_for_delivery` with the rider as actor), reads and lists their deliveries, reports their latest position, and marks a delivery delivered (core `delivered`). Customers read their order's delivery (rider name, status, last position) with their core token. Every core call carries the rider service token or the caller's own bearer.

## Requirements

### Requirement: Riders see their store's ready orders
`GET /me/ready-orders` SHALL answer `{items}`: the orders core holds as `ready` at the signed-in rider's store, without those that have a delivery, oldest `placedAt` first, each as `{orderId, number, placedAt, itemCount, totalCents, pincode, customerName}` where `itemCount` is the sum of the line quantities. Another store's orders SHALL never appear.

#### Scenario: Ready orders of the rider's store only
- **WHEN** core holds a ready order at the rider's store, a ready order at another store and a packing order at the rider's store
- **THEN** the list holds only the first, with its item count and total

#### Scenario: A claimed order leaves the list
- **WHEN** a ready order already has a delivery
- **THEN** it is not in the list

### Requirement: Riders claim a ready order
`POST /me/deliveries {orderId}` SHALL, in one transaction, insert an `assigned` delivery holding snapshots of core's order, then move the order to `out_for_delivery` in core with the rider as actor, and answer 201 `Delivery`. An `orderId` that is not a uuid SHALL be 400 on `orderId`; an order core does not know, or of another store, SHALL be 404 with no core status call.

#### Scenario: Claim succeeds
- **WHEN** a rider claims a ready order of their store
- **THEN** the answer is 201 with status `assigned` and the order's number, customer, address, total, payment method and items, and core received `out_for_delivery` with actor `{type: rider, id, name}`

#### Scenario: Another store's order
- **WHEN** a rider claims a ready order of another store
- **THEN** the answer is 404 `not_found`, no delivery exists and core received no status change

### Requirement: Claims are exclusive and refusals leave nothing
An order SHALL have at most one delivery: a claim of an order that has one SHALL be 409 `conflict`. When core refuses the move (409) or does not find the order (404), or fails, the delivery SHALL be rolled back and the answer SHALL be 409 `conflict`, 404 `not_found` or 502 `internal`.

#### Scenario: Concurrent claims
- **WHEN** five riders of the store claim the same ready order at once
- **THEN** exactly one answer is 201, the others are 409 `conflict`, one delivery exists and core received one status change

#### Scenario: Core refuses the move
- **WHEN** a rider claims an order core holds as `packing`
- **THEN** the answer is 409 `conflict` and no delivery exists

#### Scenario: Core fails
- **WHEN** core answers 500 to the status change
- **THEN** the answer is 502 `internal` and no delivery exists

### Requirement: Riders list and read their deliveries
`GET /me/deliveries?status=&page=&pageSize=` SHALL answer the signed-in rider's deliveries in that status (`assigned` by default, or `delivered`), newest claim first, as `{items, page, pageSize, total}`; another status SHALL be 400 on `status`. `GET /me/deliveries/{id}` SHALL answer one of them; another rider's delivery, an unknown id and an id that is not a uuid SHALL be 404.

#### Scenario: Default lists assigned
- **WHEN** a rider with one assigned and one delivered delivery lists without a status
- **THEN** only the assigned one is listed and `total` is 1

#### Scenario: Another rider's delivery
- **WHEN** a rider reads a delivery of another rider
- **THEN** the answer is 404 `not_found`

### Requirement: Riders mark a delivery delivered
`POST /me/deliveries/{id}/delivered` SHALL, for the rider's `assigned` delivery, move the order to `delivered` in core with the rider as actor and then mark the delivery `delivered` with `deliveredAt`, answering 200 `Delivery`. A delivery already delivered SHALL be 409 `conflict`. When core refuses or fails, the delivery SHALL stay `assigned` and core's error SHALL pass through (409, 404, 502).

#### Scenario: Delivered once
- **WHEN** a rider marks their assigned delivery delivered, then marks it again
- **THEN** the first answer is 200 with status `delivered` and `deliveredAt`, core received `delivered` with the rider as actor, and the second answer is 409 `conflict`

#### Scenario: Core fails
- **WHEN** core answers 500 to the status change
- **THEN** the answer is 502 `internal`, the delivery stays `assigned`, and a retry after core recovers answers 200

### Requirement: Riders report their location
`PUT /me/location {lat, lng}` SHALL store the signed-in rider's last position with the time it was received, replacing the previous one, and answer 204. A missing `lat` or `lng`, `lat` outside [-90, 90] or `lng` outside [-180, 180] SHALL be 400 naming the field, storing nothing.

#### Scenario: Location replaced
- **WHEN** a rider puts two positions in turn
- **THEN** both answer 204 and only the second is stored

#### Scenario: Out of range
- **WHEN** a rider puts `lat` 91
- **THEN** the answer is 400 `validation` with field `lat`

### Requirement: Customers see their order's delivery
`GET /orders/{orderId}/delivery` with a customer bearer SHALL prove ownership by reading the order from core with that bearer, then answer `{riderName, status, location?}`. `location` `{lat, lng, recordedAt}` SHALL appear only while the delivery is `assigned` and the rider reported a position after the claim. The rider's phone and email SHALL never appear.

#### Scenario: Owner follows the rider
- **WHEN** the order's customer reads it after the rider claimed it and put a position
- **THEN** the answer has the rider's name, status `assigned` and that location, and no phone or email

#### Scenario: Location hidden after delivery
- **WHEN** the customer reads it after the delivery is delivered
- **THEN** the status is `delivered` and `location` is omitted

#### Scenario: Not the customer's order
- **WHEN** another customer's token reads it, or the order has no delivery
- **THEN** the answer is 404 `not_found`; without a token or with a token core refuses it is 401

### Requirement: Core refusing the service token is a core failure
When core answers 401 or 403 to a call the rider service makes with its service token, the rider service SHALL answer 502 `internal` and log `core call failed`, never 401, so a rider's session is not ended by a misconfigured token.

#### Scenario: Wrong service token
- **WHEN** core refuses the service token and a signed-in rider lists ready orders
- **THEN** the answer is 502 `internal`

### Requirement: Claims and deliveries are logged
Every successful claim SHALL log `delivery claimed` and every successful delivered `delivery delivered`, each at info with `deliveryId`, `orderId`, `number`, `riderId` and `requestId`.

#### Scenario: Claim and delivered logged
- **WHEN** a rider claims an order and marks it delivered
- **THEN** the log holds one `delivery claimed` and one `delivery delivered` line with those fields

### Requirement: Delivery demo seed
`rider-admin seed-demo --reset` SHALL also load, without calling core, a `delivered` delivery with id `00000000-0000-4000-8000-000000000901` by rider `...0801` for core's delivered demo order `...0701` (`SS-DEMOAAAB`) at store `...0401`, and print it. The Postman environment's `deliveryId` SHALL equal the id the summary marks.

#### Scenario: Seeded delivery is the rider's history
- **WHEN** the seed is reset and rider `...0801` lists `status=delivered`
- **THEN** the list holds delivery `...0901` for order number `SS-DEMOAAAB`

#### Scenario: Summary matches seed and Postman
- **WHEN** the seed is loaded
- **THEN** every id the summary prints names one row of the table it names, and the Postman `riderId` and `deliveryId` equal the ids it marks
