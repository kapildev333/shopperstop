## MODIFIED Requirements

### Requirement: Riders see their store's ready orders
`GET /me/ready-orders` SHALL answer `{items}`: the orders core holds as `ready` at the signed-in rider's store, without those that have a delivery, oldest `placedAt` first, each as `{orderId, number, placedAt, itemCount, totalCents, paymentMethod, paymentStatus?, pincode, customerName}` where `itemCount` is the sum of the line quantities, `paymentMethod` is core's (`cod` or `online`) and `paymentStatus` is core's, present only when core's order has one. Another store's orders SHALL never appear.

#### Scenario: Ready orders of the rider's store only
- **WHEN** core holds a ready order at the rider's store, a ready order at another store and a packing order at the rider's store
- **THEN** the list holds only the first, with its item count and total

#### Scenario: A claimed order leaves the list
- **WHEN** a ready order already has a delivery
- **THEN** it is not in the list

#### Scenario: Payment passes through
- **WHEN** core holds two ready orders at the rider's store, a cash order and then an online order whose payment is `paid`
- **THEN** the first item has `paymentMethod` `cod` and no `paymentStatus` member, and the second has `paymentMethod` `online` and `paymentStatus` `paid`

### Requirement: Riders claim a ready order
`POST /me/deliveries {orderId}` SHALL, in one transaction, insert an `assigned` delivery holding snapshots of core's order, its payment method and, when core's order has one, its payment status included, then move the order to `out_for_delivery` in core with the rider as actor, and answer 201 `Delivery`. Every `Delivery` answer SHALL carry the snapshot's `paymentMethod` and, when the snapshot has one, `paymentStatus`. An `orderId` that is not a uuid SHALL be 400 on `orderId`; an order core does not know, or of another store, SHALL be 404 with no core status call.

#### Scenario: Claim succeeds
- **WHEN** a rider claims a ready order of their store
- **THEN** the answer is 201 with status `assigned` and the order's number, customer, address, total, payment method and items, and core received `out_for_delivery` with actor `{type: rider, id, name}`

#### Scenario: Claim keeps the payment
- **WHEN** a rider claims a ready online order whose payment core holds as `paid`, reads that delivery, then claims a ready cash order
- **THEN** the first claim's answer and the read both carry `paymentMethod` `online` and `paymentStatus` `paid`, and the cash claim's answer carries `paymentMethod` `cod` and no `paymentStatus` member

#### Scenario: Another store's order
- **WHEN** a rider claims a ready order of another store
- **THEN** the answer is 404 `not_found`, no delivery exists and core received no status change
