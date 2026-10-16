## MODIFIED Requirements

### Requirement: Orders are snapshots
An order SHALL keep the delivery address, the customer's name and phone, the store's name and promised minutes (`storeName`, `promisedMinutes` on every customer and staff read), and each item the product's id, name, unit label, image URL, `priceCents` and `mrpCents`, as they were at placement, so later changes to them do not change the order. Orders placed before the store's values were kept SHALL carry the store's values from when they were added.

#### Scenario: Price changes after placement
- **WHEN** an order is placed for a product priced 5000 and an admin then changes the product's price to 6000 and its name
- **THEN** `GET /api/core/v1/orders/{id}` still shows the item with `priceCents` 5000 and the old name

#### Scenario: Store changes after placement
- **WHEN** an order is placed at a store named `Test store` that promises 10 minutes and an admin then renames the store and sets `promisedMinutes` 25
- **THEN** the placement response, `GET /api/core/v1/orders/{id}`, `GET /api/core/v1/orders` and `GET /api/core/v1/admin/orders/{id}` each show `storeName` `Test store` and `promisedMinutes` 10

#### Scenario: Order placed before the store's values were kept
- **WHEN** an order exists at a store named `Backfill store` that promises 17 minutes before migration 0008 runs
- **THEN** after it the order's store name is `Backfill store`, its promised minutes 17, and neither column admits null

## ADDED Requirements

### Requirement: Staff read a store's active orders in one call
`GET /api/core/v1/admin/stores/{id}/orders?active=true` SHALL return only the store's orders that are neither `delivered` nor `cancelled`, newest first, paged like the plain list, with `total` counting every such order. `active` SHALL accept only `true`, absent or empty meaning no filter; another value, or `active=true` with a non-empty `status`, SHALL answer 400 `validation` with field `active`.

#### Scenario: Active board
- **WHEN** an admin requests `?active=true&pageSize=100` for a store with one order in each of the seven statuses but `accepted`
- **THEN** the response has `total` 4 and exactly the `placed`, `packing`, `ready` and `out_for_delivery` orders, newest first

#### Scenario: Active board paged
- **WHEN** the same admin requests `?active=true&pageSize=2`
- **THEN** the response has `total` 4 and two items

#### Scenario: Active refused
- **WHEN** the admin requests `?active=false`, `?active=TRUE`, `?active=1` or `?active=true&status=placed`
- **THEN** each response is 400 with code `validation` and field `active`
