## MODIFIED Requirements

### Requirement: Local Postman environment

`docs/postman/local.postman_environment.json` SHALL be a Postman environment holding exactly `baseUrl` = `http://localhost:8080/api/core/v1`, empty `customerToken` and `staffToken`, and `storeId`, `productId`, `addressId`, `orderId` set to the fixed ids that `core-admin seed-demo` loads and prints for a demo store, product, address and order.

#### Scenario: Environment variables
- **WHEN** the environment file is read
- **THEN** its variable keys are exactly those seven and `baseUrl` is `http://localhost:8080/api/core/v1`

#### Scenario: Ids are the seeded rows
- **WHEN** `seed-demo --reset` has run and the environment file is read
- **THEN** `storeId` is `00000000-0000-4000-8000-000000000401`, `productId` `00000000-0000-4000-8000-000000000601`, `addressId` `00000000-0000-4000-8000-000000000301` and `orderId` `00000000-0000-4000-8000-000000000703`, each the id the `seed-demo` output marks with that variable name and one row of `stores`, `products`, `addresses` and `orders`

## ADDED Requirements

### Requirement: Seed-demo prints the demo sign-ins and fixed ids
After a successful load `core-admin seed-demo` SHALL print the four demo sign-ins (email, password, role) and the fixed id and table of the demo staff users, customer, addresses, stores, first product and orders. Every printed sign-in SHALL work and every printed id SHALL be one seeded row of the table printed beside it. A failed load SHALL print nothing on stdout.

#### Scenario: Printed after a reset
- **WHEN** `core-admin seed-demo --reset` runs on a migrated database
- **THEN** it exits 0 and stdout is the summary: four sign-in lines, among them `demo@shopperstop.local` with `demo12345` as `customer`, and twelve id lines, among them `00000000-0000-4000-8000-000000000703` in `orders`

#### Scenario: Printed sign-ins and ids are the seeded ones
- **WHEN** `seed-demo --reset` has run
- **THEN** each of the four printed sign-ins answers 200 at its sign-in route (staff with the printed role) and each of the twelve printed ids is exactly one row of the table printed beside it

#### Scenario: Failed load prints no summary
- **WHEN** `core-admin seed-demo` runs without `--reset` on a database that already holds the demo rows
- **THEN** it exits 1, stderr names the duplicate key and stdout is empty
