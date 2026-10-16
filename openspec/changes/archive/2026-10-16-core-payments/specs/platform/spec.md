## MODIFIED Requirements

### Requirement: Error envelope
Every error response SHALL be JSON `{"error":{"code","message","field"?,"productIds"?}}` with `code` one of `validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `out_of_stock`, `not_serviceable`, `rate_limited`, `method_not_allowed`, `email_unverified`, `payment_pending`, `internal`. `productIds` SHALL be present only with `out_of_stock` and list the offending product ids.

#### Scenario: Unknown route
- **WHEN** a client requests a path the router does not serve
- **THEN** the response is 404 with code `not_found`

#### Scenario: Panic in a handler
- **WHEN** a handler panics
- **THEN** the response is 500 with code `internal` and the panic is logged with the request id

#### Scenario: Out of stock names the products
- **WHEN** an error with code `out_of_stock` and product ids is written
- **THEN** the body is `{"error":{"code":"out_of_stock","message":...,"productIds":[...]}}` with those ids, and an error without product ids has no `productIds` member

#### Scenario: The contract lists every code
- **WHEN** the core service answers with code `method_not_allowed`, `email_unverified` or `payment_pending`
- **THEN** that code is in the `Error` schema's `code` enum in `services/core/openapi.json`

### Requirement: Service tokens are configured
The core service SHALL read the optional `SHOPPERSTOP_CORE_SERVICE_TOKENS` as comma-separated `name:token` entries. It SHALL refuse to start, naming the variable and never printing a token, when an entry has no colon, an empty name or whitespace inside it, a token is shorter than 32 bytes, or a name or a token appears twice. Unset or empty, the service starts and admits no service.

#### Scenario: The Makefile tokens are accepted
- **WHEN** `SHOPPERSTOP_CORE_SERVICE_TOKENS` is `rider:dev-rider-service-token-dev-rider-00,payment:dev-payment-service-token-dev-pay-00`, and again `rider:e2e-rider-service-token-e2e-rider-00,payment:e2e-payment-service-token-e2e-pay-00`
- **THEN** the configuration loads with exactly two services, `rider` and `payment`, each holding the token after its colon

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
A bearer token equal to a configured service token, compared in constant time, SHALL authenticate a `service` subject named by its entry, admitted unscoped only on its routes: `rider` on `GET /admin/stores`, `/admin/stores/{id}`, `/admin/stores/{id}/orders`, `/admin/orders/{id}` and `POST /admin/orders/{id}/status`; `payment` on `GET /admin/orders/{id}`, `/admin/order-events` and `POST /admin/orders/{id}/status`, `/admin/orders/{id}/payment`. Other staff routes SHALL answer it 403 `forbidden`, customer routes 401.

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

#### Scenario: Each service on its own routes
- **WHEN** the payment service's token requests `GET /admin/orders/{id}`, then `GET /admin/stores`, `GET /admin/stores/{id}` and `GET /admin/stores/{id}/orders`, and the rider service's token posts a valid body to `POST /admin/orders/{id}/payment`
- **THEN** the order read is 200 and every other request is 403 with code `forbidden`

### Requirement: The contract names the service routes
In `services/core/openapi.json` an operation with bearer `security` SHALL carry `"x-service-token": true` exactly when the router admits some service token on it, and every other such operation under `/admin/` SHALL document a 403. The service test suite SHALL probe each operation with every configured service token and fail, naming the operation, when a declared operation refuses them all or an undeclared one admits any.

#### Scenario: Admitted but undeclared
- **WHEN** the router answers a service token 200 on `GET /api/core/v1/admin/extra` and its operation has no `x-service-token`
- **THEN** the contract test fails naming `GET /api/core/v1/admin/extra`

#### Scenario: Declared but refused
- **WHEN** an operation carries `x-service-token` and the router answers every service token 403
- **THEN** the contract test fails naming that operation
