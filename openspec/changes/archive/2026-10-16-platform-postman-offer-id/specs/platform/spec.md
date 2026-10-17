## MODIFIED Requirements

### Requirement: Path ids read environment variables

A path parameter named `id` directly after the segment `stores`, `products`, `addresses`, `orders`, `riders`, `deliveries`, `offers` or `payments`, or named exactly like that segment's variable (`{orderId}` after `orders`), SHALL take `{{storeId}}`, `{{productId}}`, `{{addressId}}`, `{{orderId}}`, `{{riderId}}`, `{{deliveryId}}`, `{{offerId}}` or `{{paymentId}}` in the request and in every saved response's `originalRequest`; other path parameters SHALL keep the contract's example.

#### Scenario: Order id
- **WHEN** the contract has `GET /orders/{id}`
- **THEN** the request's `id` path variable is `{{orderId}}`

#### Scenario: Rider and delivery ids
- **WHEN** a rider contract has `GET /admin/riders/{id}`, `GET /me/deliveries/{id}` and `GET /orders/{orderId}/delivery`
- **THEN** their path variables are `id` = `{{riderId}}`, `id` = `{{deliveryId}}` and `orderId` = `{{orderId}}`

#### Scenario: Offer id
- **WHEN** a rider contract has `POST /me/offers/{id}/accept`
- **THEN** its path variable is `id` = `{{offerId}}`

#### Scenario: Payment ids
- **WHEN** a payment contract has `GET /me/payments/{id}`, `GET /orders/{orderId}/payment` and `GET /fake/{id}` with `id` example `p1`
- **THEN** their path variables are `id` = `{{paymentId}}`, `orderId` = `{{orderId}}` and `id` = `p1`

#### Scenario: Slug keeps its example
- **WHEN** the contract has `GET /stores/{id}/products/{slug}` with `slug` example `banana-robusta`
- **THEN** the path variables are `id` = `{{storeId}}` and `slug` = `banana-robusta`

#### Scenario: Saved responses read the same ids
- **WHEN** the contract has `GET /orders/{id}` with `id` example `o1` and a documented 200 example response
- **THEN** every saved response's `originalRequest` has the `id` path variable `{{orderId}}`, not `o1`

### Requirement: Local Postman environment

`docs/postman/local.postman_environment.json` SHALL be a Postman environment holding exactly, in this order, `baseUrl` = `http://localhost:8080/api/core/v1`, empty `customerToken` and `staffToken`, `storeId`, `productId`, `addressId`, `orderId` set to the fixed ids that `core-admin seed-demo` loads and prints for a demo store, product, address and order, then the five rider variables, then the two payment variables, then `serviceToken`. Token variables SHALL have type `secret`.

#### Scenario: Environment variables
- **WHEN** the environment file is read
- **THEN** its variable keys are exactly `baseUrl`, `customerToken`, `staffToken`, `storeId`, `productId`, `addressId`, `orderId`, `riderBaseUrl`, `riderToken`, `riderId`, `deliveryId`, `offerId`, `paymentBaseUrl`, `paymentId`, `serviceToken` in that order, `baseUrl` is `http://localhost:8080/api/core/v1`, `riderBaseUrl` is `http://localhost:8081/api/rider/v1`, `paymentBaseUrl` is `http://localhost:8082/api/payment/v1`, `customerToken`, `staffToken` and `riderToken` are empty, and all four token variables have type `secret`

#### Scenario: Ids are the seeded rows
- **WHEN** `seed-demo --reset` has run and the environment file is read
- **THEN** `storeId` is `00000000-0000-4000-8000-000000000401`, `productId` `00000000-0000-4000-8000-000000000601`, `addressId` `00000000-0000-4000-8000-000000000301` and `orderId` `00000000-0000-4000-8000-000000000703`, each the id the `seed-demo` output marks with that variable name and one row of `stores`, `products`, `addresses` and `orders`

### Requirement: Postman environment carries the rider variables

After the core variables, `docs/postman/local.postman_environment.json` SHALL hold `riderBaseUrl` = `http://localhost:8081/api/rider/v1`, empty `riderToken` of type `secret`, `riderId` = `00000000-0000-4000-8000-000000000801`, `deliveryId` = `00000000-0000-4000-8000-000000000901` and `offerId` = `00000000-0000-4000-8000-000000000902`, the fixed ids the rider seed loads for the first Koramangala rider, the demo delivery and the seeded offer of that rider (`.claude/areas/rider.md`).

#### Scenario: Rider ids are fixed
- **WHEN** the environment file is read
- **THEN** `riderId` is `00000000-0000-4000-8000-000000000801`, `deliveryId` is `00000000-0000-4000-8000-000000000901` and `offerId` is `00000000-0000-4000-8000-000000000902`, of type `default`
