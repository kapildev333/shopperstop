## ADDED Requirements

### Requirement: Customers pay cash or online
`POST /api/core/v1/orders` SHALL take an optional `paymentMethod`, `cod` (the default) or `online`; another value SHALL answer 400 `validation` field `paymentMethod` and change nothing. An online order SHALL be placed exactly as a cash one, with `paymentStatus` `pending`. Every order read SHALL carry `paymentMethod` and, when set, `paymentStatus` (`pending`, `paid` or `refunded`) and `paymentReference`; cash orders SHALL have neither.

#### Scenario: Online order
- **WHEN** a customer with a verified email places a cart of 2 units (stock 5) with `{"addressId": ..., "paymentMethod": "online"}`
- **THEN** the response is 201 with `status` `placed`, `paymentMethod` `online`, `paymentStatus` `pending` and no `paymentReference`, the stock is 3, and the customer's `GET /api/core/v1/orders/{id}` and the admin's `GET /api/core/v1/admin/orders/{id}` show `online` and `pending`

#### Scenario: Cash order
- **WHEN** a customer places an order with `"paymentMethod": "cod"`
- **THEN** the response is 201 with `paymentMethod` `cod` and no `paymentStatus` or `paymentReference` member

#### Scenario: Unknown payment method
- **WHEN** a customer places an order with `paymentMethod` `card`, `ONLINE` or ` cod`
- **THEN** each response is 400 with code `validation` and field `paymentMethod`, and the cart and stock are unchanged

### Requirement: Paying online needs a verified email
An online placement by a customer whose email is not verified SHALL answer 409 `email_unverified`, checked before the cart, and change nothing; a cash placement SHALL never need a verified email.

#### Scenario: Unverified customer pays online
- **WHEN** a customer whose email is not verified places a cart of 2 units (stock 5) with `paymentMethod` `online`
- **THEN** the response is 409 with code `email_unverified`, no order exists, the cart still holds 2 and the stock is 5, and placing the same cart for cash then answers 201

### Requirement: Staff accept only paid online orders
Moving an order from `placed` to `accepted` while its `paymentStatus` is `pending` SHALL answer 409 `payment_pending` and change nothing. Every other transition, and the customer's cancel, SHALL work on such an order as on a cash one.

#### Scenario: Accept waits for the payment
- **WHEN** an admin accepts a `placed` online order whose payment is `pending`, and again after the payment service marked it `paid`
- **THEN** the first response is 409 with code `payment_pending` and the order stays `placed` with one event; the second is 200 with `status` `accepted`

#### Scenario: Unpaid order cancelled
- **WHEN** the customer, or an admin through the status route, cancels a `pending` online order of 2 units with stock 3
- **THEN** the response is 200 with `status` `cancelled` and the stock is 5

### Requirement: The payment service marks payments paid or refunded
`POST /api/core/v1/admin/orders/{id}/payment` with `{status, reference}` SHALL admit only the `payment` service. `paid` SHALL apply only to a `pending` payment and `refunded` only to a `paid` one, else 409 `conflict`; the order's status SHALL not change. Each change SHALL set `paymentReference` (1 to 100 characters, trimmed), append one event from and to the order's status by `system` named `payment` with note `Payment <status>, reference <reference>`, and log one `order payment` line.

#### Scenario: Paid then refunded
- **WHEN** the payment service marks a `pending` online order `paid` with reference `  pay_123 `, staff cancel it, and the service marks it `refunded` with `rfnd_9`
- **THEN** the first answer is 200 with `status` `placed`, `paymentStatus` `paid`, `paymentReference` `pay_123` and a last event from `placed` to `placed` by `system`, `actorName` `payment`, note `Payment paid, reference pay_123`, one `order payment` log line is written; the last answer is 200 with `status` `cancelled`, `paymentStatus` `refunded`, `paymentReference` `rfnd_9`, and the customer reads the same

#### Scenario: Change refused
- **WHEN** the service refunds a `pending` payment, pays or refunds a cash order, or pays a `paid` order a second time
- **THEN** each response is 409 with code `conflict` and the order keeps its payment status, reference and events

#### Scenario: Bad body or unknown order
- **WHEN** the service sends `status` `failed` or `pending`, no `reference`, a blank one or one of 101 characters, or a valid body for an unknown order id
- **THEN** the first five answer 400 with code `validation` and field `status` or `reference`, the last 404 `not_found`, and nothing changes

#### Scenario: Only the payment service
- **WHEN** an admin, the rider service, a customer or no token sends a valid payment change
- **THEN** the admin and the rider service get 403 `forbidden`, the customer and no token 401 `unauthorized`

### Requirement: Services tail order events
`GET /api/core/v1/admin/order-events` SHALL admit only the `payment` service and answer `{items}`, no paging envelope: at most `limit` (1 to 500, default 100) events with `seq` above `after` (at least 0, default 0), ascending by `seq`, each with `seq`, `orderId`, `orderNumber`, `storeId`, `customerId`, `fromStatus` if any, `toStatus`, `paymentMethod`, the order's current `paymentStatus` if any, `actorType`, `createdAt`. A bad `after` or `limit` SHALL answer 400 naming it.

#### Scenario: Two placements and a payment in order
- **WHEN** a cash order A is placed, then an online order B, then B is marked `paid`, and the service reads the feed after the last `seq` before A
- **THEN** it gets exactly three items with strictly ascending `seq`: A's placement (`cod`, no `paymentStatus`, no `fromStatus`), B's placement and B's payment event (`fromStatus` and `toStatus` `placed`, `actorType` `system`), both of B with `paymentStatus` `paid`; `limit=1` answers only A's, after A's `seq` with `limit=1` only B's placement, after the last one `{"items":[]}`

#### Scenario: Bad cursor or limit
- **WHEN** the service sends `after` `-1`, `x` or empty, or `limit` `0`, `501` or `1.5`
- **THEN** each response is 400 with code `validation` and field `after` or `limit`

#### Scenario: Only the payment service
- **WHEN** an admin, the rider service, a customer or no token reads the feed
- **THEN** the admin and the rider service get 403 `forbidden`, the customer and no token 401 `unauthorized`

### Requirement: Event numbers follow commit order
Every order event SHALL get its `seq` in the order the events commit, so that a reader that has seen `seq` n never later sees a new event below n: each event write SHALL wait while another transaction that wrote an event is still open.

#### Scenario: A write waits for an open event writer
- **WHEN** a transaction holds the order events lock and an admin accepts a `placed` cash order
- **THEN** the answer does not arrive while that transaction is open, and is 200 once it commits

### Requirement: The demo order paid online
`core-admin seed-demo` SHALL load demo order `00000000-0000-4000-8000-000000000704` (`SS-DEMOAAAE`) of the demo customer at the Koramangala store, `placed` three days ago, `paymentMethod` `online`, `paymentStatus` `paid`, `paymentReference` `fake_demo_0a01`, with a placement event by the customer and a payment event from `placed` to `placed` by `system` named `payment`, no actor id, note `Payment paid, reference fake_demo_0a01`. Every other demo order SHALL be cash.

#### Scenario: Seeded paid order
- **WHEN** `seed-demo --reset` has run and the demo customer and the admin read `...0704`
- **THEN** both see `paymentMethod` `online`, `paymentStatus` `paid`, `paymentReference` `fake_demo_0a01` and two events, the second from `placed` to `placed` by `system` named `payment`; exactly three orders are cash with no payment status, and exactly one event has actor type `system`

## MODIFIED Requirements

### Requirement: Transitions are recorded
Every transition SHALL append one event with the previous status, the new status, the actor type (`customer`, `staff`, `rider` or `system`) and the note; moving to `delivered` SHALL set `deliveredAt` and moving to `cancelled` SHALL set `cancelledAt`.

#### Scenario: Delivered
- **WHEN** staff move an `out_for_delivery` order to `delivered`
- **THEN** the order has `status` `delivered`, a `deliveredAt` time and a last event from `out_for_delivery` to `delivered` by `staff`

### Requirement: A service moves orders for a rider
A service SHALL change status only by its row of the service actor table: `rider` names `actor` `{type: "rider", id, name}` and moves only to `out_for_delivery` or `delivered`; `payment` names `{type: "system", name}` with no id and only cancels. `name` is 1 to 80 characters trimmed. Another target, or another service, answers 403 `forbidden` before the actor is read; a bad or missing `actor`, or any from staff, 400 field `actor`; a move the table refuses 409. A refusal changes nothing.

#### Scenario: Out for delivery
- **WHEN** the service sends `{"status":"out_for_delivery","actor":{"type":"rider","id":"<uuid>","name":"Ravi Kumar"}}` for a `ready` order
- **THEN** the response is 200 with `status` `out_for_delivery`, `riderName` `Ravi Kumar` and a last event with `actorType` `rider` and `actorName` `Ravi Kumar`

#### Scenario: No actor
- **WHEN** the service sends `{"status":"out_for_delivery"}` for a `ready` order, or an actor whose `type` is not `rider`, whose `id` is not a uuid, or whose `name` is blank or 81 characters
- **THEN** the response is 400 with code `validation` and field `actor`, and the order stays `ready` with no new event

#### Scenario: Staff name an actor
- **WHEN** an admin sends a status change with an `actor`
- **THEN** the response is 400 with code `validation` and field `actor`

#### Scenario: A service cancels
- **WHEN** the rider service sends `{"status":"cancelled"}` with a valid rider actor for a `ready` order
- **THEN** the response is 403 with code `forbidden` and the order stays `ready`

#### Scenario: A service skips ahead
- **WHEN** the service sends `{"status":"delivered"}` with a valid rider actor for a `ready` order
- **THEN** the response is 409 with code `conflict` and the order stays `ready`

#### Scenario: Payment timeout
- **WHEN** the payment service sends `{"status":"cancelled","note":"not paid in 15 minutes","actor":{"type":"system","name":"payment timeout"}}` for a `pending` online order of 2 units with stock 3
- **THEN** the response is 200 with `status` `cancelled`, `cancelReason` `not paid in 15 minutes` and a last event by `system` with `actorName` `payment timeout` and no actor id, and the stock is 5

#### Scenario: The payment service only cancels
- **WHEN** the payment service sends `accepted` or `delivered` with a system actor, `cancelled` with no actor, a rider actor, a system actor with an id or a blank name, or the rider service sends `cancelled` with a system actor, for a `placed` order
- **THEN** the moves to `accepted` and `delivered` and the rider service's answer 403 `forbidden`, the others 400 `validation` field `actor`, and the order stays `placed` with one event

### Requirement: Orders name their rider
An order a rider took `out_for_delivery` SHALL show that rider's name as `riderName` on every customer and staff read, unchanged by later moves; any other order SHALL omit `riderName`. An event SHALL carry `actorName` only when a rider or the system made it.

#### Scenario: Another rider delivers
- **WHEN** rider Ravi Kumar took an order out for delivery and the service then moves it to `delivered` for rider Sunil
- **THEN** the response is 200 with `status` `delivered`, a `deliveredAt` time, `riderName` `Ravi Kumar` and a last event with `actorName` `Sunil`, and the customer's `GET /api/core/v1/orders/{id}` shows `riderName` `Ravi Kumar`

#### Scenario: Staff take the order out
- **WHEN** an admin moves a `ready` order to `out_for_delivery`
- **THEN** the response is 200 and has no `riderName` and no `actorName` member

### Requirement: Demo orders
`core-admin seed-demo --reset` SHALL delete every order it does not define and leave four orders of the demo customer at the Koramangala store to the Home address, in the statuses `delivered`, `cancelled`, `placed` and `placed`, each with events leading from `placed` to its status, the delivered and the first placed one including product `00000000-0000-4000-8000-000000000601`; two consecutive runs SHALL leave the same rows.

#### Scenario: Reset twice
- **WHEN** `seed-demo --reset` runs twice on a database that also holds another order
- **THEN** exactly four orders exist: `00000000-0000-4000-8000-000000000701` `SS-DEMOAAAB` `delivered`, `...0702` `SS-DEMOAAAC` `cancelled`, `...0703` `SS-DEMOAAAD` `placed` and `...0704` `SS-DEMOAAAE` `placed`, all of customer `...0201` at store `...0401`, and the demo customer's `GET /api/core/v1/orders` lists them newest first: `...0703`, `...0702`, `...0701`, `...0704`

#### Scenario: Ordered demo product cannot be deleted
- **WHEN** `seed-demo --reset` has run and an admin deletes product `00000000-0000-4000-8000-000000000601`
- **THEN** the response is 409 with code `conflict` and the product remains
