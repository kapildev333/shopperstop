## ADDED Requirements

### Requirement: A service moves orders for a rider
A service's status change SHALL name `actor` `{type: "rider", id, name}`, `id` a uuid and `name` 1 to 80 characters after trimming; a missing or invalid `actor`, or any `actor` from staff, SHALL answer 400 `validation` field `actor`. A service SHALL move orders only to `out_for_delivery` or `delivered`: another target answers 403 `forbidden`, a move the table refuses 409. A refusal changes nothing.

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
- **WHEN** the service sends `{"status":"cancelled"}` with a valid rider actor for a `ready` order
- **THEN** the response is 403 with code `forbidden` and the order stays `ready`

#### Scenario: A service skips ahead
- **WHEN** the service sends `{"status":"delivered"}` with a valid rider actor for a `ready` order
- **THEN** the response is 409 with code `conflict` and the order stays `ready`

### Requirement: Orders name their rider
An order a rider took `out_for_delivery` SHALL show that rider's name as `riderName` on every customer and staff read, unchanged by later moves; any other order SHALL omit `riderName`. An event SHALL carry `actorName` only when a rider made it.

#### Scenario: Another rider delivers
- **WHEN** rider Ravi Kumar took an order out for delivery and the service then moves it to `delivered` for rider Sunil
- **THEN** the response is 200 with `status` `delivered`, a `deliveredAt` time, `riderName` `Ravi Kumar` and a last event with `actorName` `Sunil`, and the customer's `GET /api/core/v1/orders/{id}` shows `riderName` `Ravi Kumar`

#### Scenario: Staff take the order out
- **WHEN** an admin moves a `ready` order to `out_for_delivery`
- **THEN** the response is 200 and has no `riderName` and no `actorName` member

## MODIFIED Requirements

### Requirement: Transitions are recorded
Every transition SHALL append one event with the previous status, the new status, the actor type (`customer`, `staff` or `rider`) and the note; moving to `delivered` SHALL set `deliveredAt` and moving to `cancelled` SHALL set `cancelledAt`.

#### Scenario: Delivered
- **WHEN** staff move an `out_for_delivery` order to `delivered`
- **THEN** the order has `status` `delivered`, a `deliveredAt` time and a last event from `out_for_delivery` to `delivered` by `staff`

### Requirement: Order routes need the right session
The four customer order routes SHALL answer 401 `unauthorized` without a customer session (including with a staff or service token), and the three staff order routes SHALL answer 401 without a staff session or a service token (including with a customer token).

#### Scenario: Staff token on a customer route
- **WHEN** an admin token is sent to `GET /api/core/v1/orders`
- **THEN** the response is 401 with code `unauthorized`

#### Scenario: Service token on a customer route
- **WHEN** the rider service's token is sent to `GET /api/core/v1/orders`
- **THEN** the response is 401 with code `unauthorized`
