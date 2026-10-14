## ADDED Requirements

### Requirement: Customers place an order from their cart
`POST /api/core/v1/orders` with `{addressId}` SHALL turn the signed-in customer's whole cart into one order in one transaction and answer 201 with it: `status` `placed`, `paymentMethod` `cod`, a unique `number` (`SS-` and 8 characters of `A-Z`, `2-7`), one item per cart line and one `placed` event by the customer. The store's stock SHALL drop by each line's quantity and the cart SHALL be emptied.

#### Scenario: Order placed
- **WHEN** a customer whose cart holds 2 of a product with stock 5 at the store places an order with an own address the store serves
- **THEN** the response is 201 with `status` `placed`, a `number` matching `^SS-[A-Z2-7]{8}$`, one item with quantity 2, one event with `toStatus` `placed` and `actorType` `customer`, the stock is 3 and `GET /api/core/v1/me/cart` answers an empty cart

### Requirement: Order totals
An order's `subtotalCents` SHALL be the sum of each line's current `priceCents` times its quantity, `deliveryFeeCents` SHALL be the store's delivery fee, or 0 when the subtotal is at or above the store's `freeDeliveryAboveCents`, and `totalCents` SHALL be their sum.

#### Scenario: Below the free-delivery threshold
- **WHEN** a store charges 2500 with free delivery above 19900 and a customer orders a subtotal of 10000
- **THEN** the order has `subtotalCents` 10000, `deliveryFeeCents` 2500 and `totalCents` 12500

#### Scenario: At the free-delivery threshold
- **WHEN** the same store receives an order with a subtotal of 19900
- **THEN** the order has `deliveryFeeCents` 0 and `totalCents` 19900

### Requirement: Orders are snapshots
An order SHALL keep the delivery address and the customer's name and phone, and each item the product's id, name, unit label, image URL, `priceCents` and `mrpCents`, as they were at placement, so later changes to them do not change the order.

#### Scenario: Price changes after placement
- **WHEN** an order is placed for a product priced 5000 and an admin then changes the product's price to 6000 and its name
- **THEN** `GET /api/core/v1/orders/{id}` still shows the item with `priceCents` 5000 and the old name

### Requirement: Placement validates the cart, the address and the minimum order
Placement SHALL answer 400 `validation` and change nothing when the cart is empty, when `addressId` is missing, malformed or not one of the customer's addresses (field `addressId`), or when the subtotal is below the store's `minOrderCents` (field `subtotal`).

#### Scenario: Empty cart
- **WHEN** a customer with no cart places an order
- **THEN** the response is 400 with code `validation`

#### Scenario: Another customer's address
- **WHEN** a customer places an order with the id of another customer's address
- **THEN** the response is 400 with code `validation` and field `addressId`, and the cart and stock are unchanged

#### Scenario: Below the minimum order
- **WHEN** a store's `minOrderCents` is 9900 and the cart's subtotal is 5000
- **THEN** the response is 400 with code `validation` and field `subtotal`, and the cart and stock are unchanged

### Requirement: Placement needs a serviceable address and an open store
Placement SHALL answer 409 `not_serviceable` and change nothing when the address's pincode is not served by the cart's store, or when that store is closed.

#### Scenario: Address served by another store
- **WHEN** a customer's cart is at store A and the chosen address's pincode is served by store B
- **THEN** the response is 409 with code `not_serviceable` and field `addressId`, and the cart and stock are unchanged

#### Scenario: Store closed
- **WHEN** the cart's store serves the address but is closed
- **THEN** the response is 409 with code `not_serviceable`, and the cart and stock are unchanged

### Requirement: Out of stock fails the whole order
When any cart line's product is inactive, has no stock row at the store, or has less stock than the line's quantity, placement SHALL answer 409 `out_of_stock` with `productIds` listing every such product in ascending order, and SHALL place nothing, take no stock and keep the cart.

#### Scenario: One line short
- **WHEN** a cart holds 2 of product P (stock 5) and 3 of product Q (stock 1) and the customer places an order
- **THEN** the response is 409 with code `out_of_stock` and `productIds` exactly `[Q]`, P's stock is still 5, Q's still 1, the cart still holds both lines and no order exists for the customer

#### Scenario: Product deactivated after it was added
- **WHEN** a product in the cart is deactivated before placement
- **THEN** the response is 409 with code `out_of_stock` and `productIds` containing that product

### Requirement: Concurrent placements never oversell
Two placements that compete for the last units of a product SHALL never both succeed: exactly one SHALL be placed and the other SHALL answer 409 `out_of_stock`.

#### Scenario: Two customers race for the last unit
- **WHEN** a product has stock 1, two customers each hold 1 of it in their carts and both place an order at the same moment
- **THEN** exactly one response is 201, the other is 409 with code `out_of_stock` and `productIds` `[that product]`, and the stock is 0

### Requirement: Customers read their own orders
`GET /api/core/v1/orders` SHALL return the signed-in customer's orders newest first as a paged list, each with its items and its events in time order; `GET /api/core/v1/orders/{id}` SHALL return one of the customer's orders the same way; another customer's order SHALL answer 404 `not_found`.

#### Scenario: Newest first
- **WHEN** a customer has placed two orders and requests `GET /api/core/v1/orders`
- **THEN** the response has `total` 2 and the later order first, each with `items` and `events` arrays

#### Scenario: Another customer's order
- **WHEN** a customer requests `GET /api/core/v1/orders/{id}` for another customer's order
- **THEN** the response is 404 with code `not_found`

### Requirement: Order status transitions
An order's status SHALL change only along: `placed` to `accepted` or `cancelled`; `accepted` to `packing` or `cancelled`; `packing` to `ready`; `ready` to `out_for_delivery`; `out_for_delivery` to `delivered`. Staff MAY make every one of them, customers only the cancels. Any other change SHALL answer 409 `conflict` and leave the order unchanged; in particular nobody, staff included, cancels an order that is `packing` or later.

#### Scenario: Allowed transition
- **WHEN** an admin sends `POST /api/core/v1/admin/orders/{id}/status` with `{"status":"accepted","note":"on it"}` for a `placed` order
- **THEN** the response is 200 with `status` `accepted` and a last event with `fromStatus` `placed`, `toStatus` `accepted`, `actorType` `staff` and `note` `on it`

#### Scenario: Forbidden transition
- **WHEN** staff move a `placed` order to `packing`, or any order out of `delivered` or `cancelled`
- **THEN** the response is 409 with code `conflict` and the order's status and events are unchanged

#### Scenario: Staff cannot cancel once packing
- **WHEN** an admin sends `{"status":"cancelled"}` for an order that is `packing`
- **THEN** the response is 409 with code `conflict`, the order stays `packing` with no new event and the store's stock is unchanged

#### Scenario: Unknown status
- **WHEN** staff send `{"status":"lost"}`
- **THEN** the response is 400 with code `validation` and field `status`

### Requirement: Transitions are recorded
Every transition SHALL append one event with the previous status, the new status, the actor type (`customer` or `staff`) and the note; moving to `delivered` SHALL set `deliveredAt` and moving to `cancelled` SHALL set `cancelledAt`.

#### Scenario: Delivered
- **WHEN** staff move an `out_for_delivery` order to `delivered`
- **THEN** the order has `status` `delivered`, a `deliveredAt` time and a last event from `out_for_delivery` to `delivered` by `staff`

### Requirement: Customers cancel while placed or accepted
`POST /api/core/v1/orders/{id}/cancel` with `{reason?}` SHALL cancel the customer's own order while it is `placed` or `accepted`, record the reason as `cancelReason` and as the event's note, and return each line's quantity to the store's stock in the same transaction; in any other status it SHALL answer 409 `conflict`. Staff cancelling through the status route SHALL restore stock the same way and record the note as `cancelReason`.

#### Scenario: Cancel restores stock
- **WHEN** a customer cancels a `placed` order of 2 units with `{"reason":"Ordered by mistake"}` and the stock is 3
- **THEN** the response is 200 with `status` `cancelled`, `cancelReason` `Ordered by mistake` and a `cancelledAt` time, and the stock is 5

#### Scenario: Too late to cancel
- **WHEN** a customer cancels an order that is `packing`
- **THEN** the response is 409 with code `conflict` and the order stays `packing`

#### Scenario: Another customer's order
- **WHEN** a customer cancels another customer's order
- **THEN** the response is 404 with code `not_found`

### Requirement: Reasons and notes are short text
The cancel `reason` and the status change `note` SHALL be optional, SHALL be stored without leading or trailing whitespace, and SHALL answer 400 `validation` naming the field (`reason` or `note`) and change nothing when longer than 500 characters.

#### Scenario: Reason too long
- **WHEN** a customer cancels a `placed` order with a `reason` of 501 characters
- **THEN** the response is 400 with code `validation` and field `reason`, and the order stays `placed`

#### Scenario: Reason trimmed
- **WHEN** a customer cancels a `placed` order with `{"reason":"  changed my mind  "}`
- **THEN** the response is 200 with `cancelReason` `changed my mind` and a last event with `note` `changed my mind`

#### Scenario: No reason
- **WHEN** a customer cancels a `placed` order with `{}`
- **THEN** the response is 200 and the order in it has no `cancelReason` member

### Requirement: Staff read their store's orders
`GET /api/core/v1/admin/stores/{id}/orders?status=` SHALL return the store's orders newest first as a paged list, optionally only those in one `status`, each with items, events, the customer's name and phone and the delivery address; `GET /api/core/v1/admin/orders/{id}` SHALL return one order the same way. An unknown `status` value SHALL answer 400 `validation` with field `status`; an unknown store or order SHALL answer 404 `not_found`.

#### Scenario: Board list
- **WHEN** an admin requests `GET /api/core/v1/admin/stores/{id}/orders?status=placed` for a store with one `placed` and one `accepted` order
- **THEN** the response has `total` 1 and the `placed` order with `customerName`, `customerPhone`, `address`, `items` and `events`

### Requirement: Store staff see only their store's orders
Store staff SHALL reach the three staff order routes only for their own store; another store's orders and order lists SHALL answer 404 `not_found`, never 403. Admins SHALL reach every store.

#### Scenario: Other store's order
- **WHEN** a store-staff user of store A requests `GET /api/core/v1/admin/orders/{id}` or `POST /api/core/v1/admin/orders/{id}/status` for an order of store B, or `GET /api/core/v1/admin/stores/{B}/orders`
- **THEN** each response is 404 with code `not_found` and the order is unchanged

#### Scenario: Own store
- **WHEN** the same user moves a `placed` order of store A to `accepted`
- **THEN** the response is 200 with `status` `accepted`

### Requirement: Order routes need the right session
The four customer order routes SHALL answer 401 `unauthorized` without a customer session (including with a staff token), and the three staff order routes SHALL answer 401 without a staff session (including with a customer token).

#### Scenario: Staff token on a customer route
- **WHEN** an admin token is sent to `GET /api/core/v1/orders`
- **THEN** the response is 401 with code `unauthorized`

### Requirement: Each transition is logged
The service SHALL write one structured log line per order transition, placement included, with message `order transition`, `orderId`, `number`, `from` (absent at placement), `to`, `actorType` and `actorId`.

#### Scenario: Accept logged
- **WHEN** staff move an order from `placed` to `accepted`
- **THEN** exactly one log line `order transition` is written with that order's id, `from` `placed`, `to` `accepted` and `actorType` `staff`

### Requirement: Demo orders
`core-admin seed-demo --reset` SHALL delete every order it does not define and leave three orders of the demo customer at the Koramangala store to the Home address, in the statuses `delivered`, `cancelled` and `placed`, each with events leading from `placed` to its status, the delivered and the placed one including product `00000000-0000-4000-8000-000000000601`; two consecutive runs SHALL leave the same rows.

#### Scenario: Reset twice
- **WHEN** `seed-demo --reset` runs twice on a database that also holds another order
- **THEN** exactly three orders exist: `00000000-0000-4000-8000-000000000701` `SS-DEMOAAAB` `delivered`, `...0702` `SS-DEMOAAAC` `cancelled` and `...0703` `SS-DEMOAAAD` `placed`, all of customer `...0201` at store `...0401`, and the demo customer's `GET /api/core/v1/orders` lists them newest first: `...0703`, `...0702`, `...0701`

#### Scenario: Ordered demo product cannot be deleted
- **WHEN** `seed-demo --reset` has run and an admin deletes product `00000000-0000-4000-8000-000000000601`
- **THEN** the response is 409 with code `conflict` and the product remains
