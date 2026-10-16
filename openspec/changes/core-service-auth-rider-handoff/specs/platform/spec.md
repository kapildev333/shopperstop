## ADDED Requirements

### Requirement: Service tokens are configured
The core service SHALL read the optional `SHOPPERSTOP_CORE_SERVICE_TOKENS` as comma-separated `name:token` entries. It SHALL refuse to start, naming the variable and never printing a token, when an entry has no colon, an empty name or whitespace inside it, a token is shorter than 32 bytes, or a name or a token appears twice. Unset or empty, the service starts and admits no service.

#### Scenario: The Makefile tokens are accepted
- **WHEN** `SHOPPERSTOP_CORE_SERVICE_TOKENS` is `rider:dev-rider-service-token-dev-rider-00`, and again `rider:e2e-rider-service-token-e2e-rider-00`
- **THEN** the configuration loads with one service `rider` holding the token after the colon

#### Scenario: Unset
- **WHEN** `SHOPPERSTOP_CORE_SERVICE_TOKENS` is unset or empty
- **THEN** the configuration loads with no service tokens

#### Scenario: Short token
- **WHEN** `SHOPPERSTOP_CORE_SERVICE_TOKENS` is `rider:abc123`
- **THEN** the service refuses to start with a message that names `SHOPPERSTOP_CORE_SERVICE_TOKENS` and 32 bytes and does not contain `abc123`

#### Scenario: Malformed or repeated entries
- **WHEN** an entry has no colon, an empty name, whitespace inside it (`rider: <token>`), or names `rider` a second time
- **THEN** the service refuses to start with a message that names `SHOPPERSTOP_CORE_SERVICE_TOKENS`

### Requirement: Services reach the rider's admin routes
A bearer token equal to a configured service token, compared in constant time, SHALL authenticate a `service` subject with its entry's name. It SHALL reach `GET /admin/stores`, `GET /admin/stores/{id}`, `GET /admin/stores/{id}/orders`, `GET /admin/orders/{id}` and `POST /admin/orders/{id}/status` unscoped, like an admin; every other route that needs a staff session SHALL answer it 403 `forbidden`, and customer routes 401.

#### Scenario: Reads like an admin
- **WHEN** the rider service's token requests `GET /admin/stores`, `GET /admin/stores/{id}`, `GET /admin/stores/{id}/orders?status=ready` and `GET /admin/orders/{id}` for a store and an order of that store
- **THEN** each response is 200

#### Scenario: Other staff routes
- **WHEN** the service token requests `GET /admin/me`, `GET /admin/staff-users`, `GET /admin/dashboard` or `GET /admin/stores/{id}/stock`
- **THEN** each response is 403 with code `forbidden`

#### Scenario: Customer routes
- **WHEN** the service token requests `GET /me` or `GET /orders`
- **THEN** each response is 401 with code `unauthorized`

#### Scenario: Wrong token
- **WHEN** a token that differs from the configured one by one trailing character requests `GET /admin/stores`
- **THEN** the response is 401 with code `unauthorized`

### Requirement: The contract names the service routes
In `services/core/openapi.json` an operation with bearer `security` SHALL carry `"x-service-token": true` exactly when the router admits a service token on it, and every other such operation under `/admin/` SHALL document a 403. The service test suite SHALL probe each operation with a service token and fail otherwise, naming the operation.

#### Scenario: Admitted but undeclared
- **WHEN** the router answers a service token 200 on `GET /api/core/v1/admin/extra` and its operation has no `x-service-token`
- **THEN** the contract test fails naming `GET /api/core/v1/admin/extra`

#### Scenario: Declared but refused
- **WHEN** an operation carries `x-service-token` and the router answers the service token 403
- **THEN** the contract test fails naming that operation

## MODIFIED Requirements

### Requirement: The request log names the signed-in subject
The request log line SHALL carry `subjectType` (`customer`, `staff` or `service`) and `subjectId` (the customer's or staff user's id, or the service's name) when the request was authenticated, and neither field otherwise.

#### Scenario: Signed-in customer
- **WHEN** a signed-in customer requests `GET /api/core/v1/me`
- **THEN** the request log line has `subjectType` `customer` and `subjectId` the customer's id

#### Scenario: Anonymous request
- **WHEN** a request without a token is answered
- **THEN** the request log line has no `subjectType` and no `subjectId`

#### Scenario: Service
- **WHEN** the token of the service named `rider` requests `GET /api/core/v1/admin/stores`
- **THEN** the request log line has `subjectType` `service` and `subjectId` `rider`
