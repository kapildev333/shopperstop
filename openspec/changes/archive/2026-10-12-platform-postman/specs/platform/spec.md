## ADDED Requirements

### Requirement: Postman collection is generated from the contract

`make postman` SHALL write `docs/postman/shopperstop-core.postman_collection.json` from `services/core/openapi.json` alone: one folder per tag in the contract's tag order, one request per operation named by its `summary`, URLs rooted at `{{baseUrl}}`, and each operation's request body example as the raw JSON body. An input that is not a valid OpenAPI document SHALL make it exit non-zero without writing the collection.

#### Scenario: Folders follow the contract tags
- **WHEN** `make postman` runs against the Phase 1 contract
- **THEN** the collection has one folder `platform` holding `GET {{baseUrl}}/healthz` named `Liveness` and `GET {{baseUrl}}/readyz` named `Readiness`

#### Scenario: Request carries its example body
- **WHEN** the contract has `POST /auth/sign-in` with request body example `{"email":"customer@example.com","password":"password123"}`
- **THEN** that request's raw body parses to the same object

#### Scenario: Invalid contract is refused
- **WHEN** the generator is given a document without an `openapi` version
- **THEN** it fails with an error and no collection is written

### Requirement: Postman requests authenticate from environment tokens

Every operation the contract marks with a bearer `security` requirement SHALL carry bearer auth reading `{{staffToken}}` when its path starts with `/admin/` and `{{customerToken}}` otherwise; operations without `security` SHALL carry no auth.

#### Scenario: Customer route
- **WHEN** the contract marks `GET /orders/{id}` with bearer security
- **THEN** its request carries bearer auth `{{customerToken}}`

#### Scenario: Staff route
- **WHEN** the contract marks `GET /admin/me` with bearer security
- **THEN** its request carries bearer auth `{{staffToken}}`

#### Scenario: Public route
- **WHEN** the collection is generated from the Phase 1 contract
- **THEN** `Liveness` and `Readiness` carry no auth

### Requirement: Sign-in requests store the returned token

A request whose path has an `auth` segment and whose contract documents a 2xx response example with a string `token` SHALL carry a Postman test script that stores the response's `token` into the environment variable `staffToken` when the path starts with `/admin/` and `customerToken` otherwise. Other requests SHALL carry no script.

#### Scenario: Customer sign-in
- **WHEN** `POST /auth/sign-in` documents a 200 example `{"token":"...","customer":{...}}`
- **THEN** its test script sets `customerToken` from `pm.response.json().token`

#### Scenario: Staff sign-in
- **WHEN** `POST /admin/auth/sign-in` documents a 200 example with a `token`
- **THEN** its test script sets `staffToken`

#### Scenario: Sign-out has no script
- **WHEN** `POST /auth/sign-out` documents only a 204 response
- **THEN** its request has no test script

### Requirement: Path ids read environment variables

A path parameter that directly follows the segment `stores`, `products`, `addresses` or `orders` SHALL take the value `{{storeId}}`, `{{productId}}`, `{{addressId}}` or `{{orderId}}`; other path parameters SHALL keep the contract's example.

#### Scenario: Order id
- **WHEN** the contract has `GET /orders/{id}`
- **THEN** the request's `id` path variable is `{{orderId}}`

### Requirement: Postman collection is byte-stable

The generated collection SHALL depend only on the contract: no generated ids (`id`, `_postman_id`), no collection-level variables, JSON with two-space indentation and a trailing newline, identical bytes on every run.

#### Scenario: Two runs give identical bytes
- **WHEN** `make postman` runs twice on an unchanged contract
- **THEN** the second run leaves `git status --porcelain` empty and the file contains no `id` or `_postman_id` key

### Requirement: Local Postman environment

`docs/postman/local.postman_environment.json` SHALL be a Postman environment holding exactly `baseUrl` = `http://localhost:8080/api/core/v1` and empty `customerToken`, `staffToken`, `storeId`, `productId`, `addressId`, `orderId`.

#### Scenario: Environment variables
- **WHEN** the environment file is read
- **THEN** its variable keys are exactly those seven and `baseUrl` is `http://localhost:8080/api/core/v1`
