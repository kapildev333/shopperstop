# stock Specification

## Purpose
Per-store stock of every product: what staff see and set, what order placement reserves and a cancel releases, and the demo stock the seed loads.

## Requirements

### Requirement: Stock is held per store and product
The core service SHALL hold at most one stock quantity per store and product, never below 0, and SHALL treat a product with no stock row at a store as quantity 0 at that store.

#### Scenario: No row reads as zero
- **WHEN** an admin lists the stock of a store that has no stock row for an active product
- **THEN** that product is listed with `quantity` 0

#### Scenario: Negative quantity refused
- **WHEN** an admin sets a product's quantity to -1
- **THEN** the response is 400 with code `validation` and field `quantity`, and the stored quantity is unchanged

### Requirement: Staff list a store's stock
`GET /api/core/v1/admin/stores/{id}/stock` SHALL answer every active product with `{productId, name, brand, unitLabel, priceCents, imageUrl, quantity}` at that store as a paged list sorted by name. `q` (at most 100 characters) SHALL keep products whose name or brand contains it without regard to case, `%` and `_` matched literally; `lowStock=true` SHALL keep products whose quantity is below 5, zero included; any `lowStock` value other than `true` or `false` SHALL be 400 `validation`.

#### Scenario: Own store with filters
- **WHEN** a store's staff list its stock with `lowStock=true&q=milk`, where `Amul Milk` has quantity 3, `Milk Bread` has quantity 40 and `Curd` has quantity 0
- **THEN** the response is 200 and `items` holds `Amul Milk` only, with `quantity` 3

#### Scenario: Inactive products are not listed
- **WHEN** a product is inactive and has a stock row at the store
- **THEN** the store's stock list does not contain it

### Requirement: The stock search refuses a NUL byte
The stock list SHALL answer 400 `validation` naming field `q` when `q` contains a NUL byte.

#### Scenario: NUL byte in q
- **WHEN** an admin lists a store's stock with `q=milk%00`
- **THEN** the response is 400 with code `validation` and field `q`

### Requirement: Stock routes answer the store's own staff and admins
The stock list and the stock update SHALL answer admins for any existing store and store staff only for their own store. Store staff naming another store, and anyone naming a store that does not exist, SHALL get 404 `not_found` without anything changing; a request without a staff session SHALL get 401 `unauthorized`.

#### Scenario: Another store's staff
- **WHEN** store staff of store A request the stock of store B, or send a stock update for store B
- **THEN** both responses are 404 with code `not_found` and store B's stock is unchanged

#### Scenario: Unknown store
- **WHEN** an admin requests the stock of a store id that does not exist
- **THEN** the response is 404 with code `not_found`

#### Scenario: Customer token
- **WHEN** a customer's token is sent to the stock list
- **THEN** the response is 401 with code `unauthorized`

### Requirement: Staff set a store's stock in bulk
`PUT /api/core/v1/admin/stores/{id}/stock` SHALL accept `{rows: [{productId, quantity}]}` with 1 to 500 rows, distinct product ids and quantities from 0 to 100000, set each product's quantity at that store (creating the row when absent) in one transaction, and answer 204. Any invalid row SHALL refuse the whole request with 400 `validation` and change nothing.

#### Scenario: Upsert
- **WHEN** an admin sends `{rows: [{productId: P, quantity: 12}, {productId: Q, quantity: 0}]}` where P has no row and Q has quantity 7
- **THEN** the response is 204 and the stock list shows P with 12 and Q with 0

#### Scenario: Too many rows
- **WHEN** the body has 501 rows, or no rows
- **THEN** the response is 400 with code `validation` and field `rows`

#### Scenario: Duplicate or unknown product
- **WHEN** the body names the same product twice, or a product id that does not exist
- **THEN** the response is 400 with code `validation` and field `rows`, and no quantity changed

### Requirement: Reservation is all or nothing
The stock package SHALL offer order placement a reservation that, inside the caller's transaction, locks the store's stock rows for the requested products in product id order, and either takes every requested quantity or takes nothing and reports every product that is inactive, has no stock row, or has less than requested, as product ids in ascending order.

#### Scenario: Enough of everything
- **WHEN** a reservation asks for 2 of P (quantity 5) and 1 of Q (quantity 1) and the transaction commits
- **THEN** P has quantity 3 and Q has quantity 0

#### Scenario: One product short
- **WHEN** a reservation asks for 2 of P (quantity 5), 2 of Q (quantity 1) and 1 of R (inactive, quantity 9)
- **THEN** it reports out of stock with the ids of Q and R in ascending order, and P, Q and R keep 5, 1 and 9

### Requirement: Concurrent reservations never oversell
Two transactions reserving the same stock at once SHALL never take more than the stored quantity, and reservations that name the same products in different orders SHALL not deadlock. A reservation, a release and a staff bulk stock update that name the same products in different orders SHALL not deadlock with one another either: each SHALL complete without being aborted.

#### Scenario: Racing for the last unit
- **WHEN** two transactions each reserve 1 of a product with quantity 1 at the same time and both try to commit
- **THEN** exactly one succeeds, the other reports that product out of stock, and the quantity is 0

#### Scenario: Opposite order
- **WHEN** two transactions reserve P and Q at the same time, one listing P first and the other Q first, with enough of both
- **THEN** both succeed and each quantity dropped by the sum of the two reservations

#### Scenario: Release against a reservation
- **WHEN** one transaction releases 1 of Q and 1 of P, listing Q first, while another reserves 1 of P and 1 of Q, listing P first, with enough of both
- **THEN** both commit and P and Q hold the quantities they started with

#### Scenario: Bulk update against a reservation
- **WHEN** one transaction writes the bulk stock update for Q and P, listing Q first, while another reserves 1 of P and 1 of Q, listing P first, with enough of both
- **THEN** both commit

### Requirement: Released stock returns
The stock package SHALL offer a release that, inside the caller's transaction, adds the given quantities back to the store's stock rows.

#### Scenario: Release after a reservation
- **WHEN** 2 of P (quantity 5) are reserved and then released in a later transaction
- **THEN** P has quantity 5

### Requirement: Demo stock
`core-admin seed-demo --reset` SHALL give every demo product a stock row at each demo store, with at least one quantity of 0 and at least one quantity from 1 to 4 per store, the same quantities on every run.

#### Scenario: Reset twice
- **WHEN** `seed-demo --reset` runs twice
- **THEN** each demo store has one stock row per demo product, a zero and a low count among them, and every quantity equals the first run's

### Requirement: Stock rows carry the product image
A row of the stock list SHALL carry `imageUrl` when its product has an image, with the same value as that product's `imageUrl` on `GET /api/core/v1/stores/{id}/products/{slug}`, and SHALL have no `imageUrl` member when the product has no image.

#### Scenario: Product with an image
- **WHEN** store staff list the stock of their store and a listed product has the image `products/stock-image.png`
- **THEN** its row has `imageUrl` `/api/core/v1/files/products/stock-image.png`, the value `GET /api/core/v1/stores/{id}/products/{slug}` answers for that product

#### Scenario: Product without an image
- **WHEN** an admin lists the stock of a store and a listed product has no image
- **THEN** its row has no `imageUrl` member
