## MODIFIED Requirements

### Requirement: Postman requests authenticate from environment tokens

Every operation the contract marks with a bearer `security` requirement SHALL carry bearer auth reading `{{serviceToken}}` when the operation has `x-service-token: true`; otherwise `{{staffToken}}` when its path starts with `/admin/`; otherwise, in the rider collection, `{{riderToken}}` when its path starts with `/auth/` or is or starts with `/me`, and `{{customerToken}}` for every other path of either collection. Operations without `security` SHALL carry no auth.

#### Scenario: Customer route
- **WHEN** the contract marks `GET /orders/{id}` with bearer security
- **THEN** its request carries bearer auth `{{customerToken}}`

#### Scenario: Staff route
- **WHEN** the contract marks `GET /admin/me` with bearer security
- **THEN** its request carries bearer auth `{{staffToken}}`

#### Scenario: Public route
- **WHEN** the collection is generated from the Phase 1 contract
- **THEN** `Liveness` and `Readiness` carry no auth

#### Scenario: Rider routes
- **WHEN** a rider contract marks `GET /me`, `GET /me/deliveries/{id}`, `GET /admin/riders/{id}` and `GET /orders/{orderId}/delivery` with bearer security
- **THEN** their requests carry `{{riderToken}}`, `{{riderToken}}`, `{{staffToken}}` and `{{customerToken}}` in that order

#### Scenario: Service route
- **WHEN** the contract marks `GET /admin/stores` with bearer security and `x-service-token: true`, and `GET /admin/me` with bearer security only
- **THEN** `GET /admin/stores` carries bearer auth `{{serviceToken}}` and `GET /admin/me` carries `{{staffToken}}`

#### Scenario: Core service routes
- **WHEN** the collection is generated from `services/core/openapi.json`
- **THEN** the requests carrying `{{serviceToken}}` are exactly the operations that contract marks `x-service-token: true` (today `GET /admin/stores`, `GET /admin/stores/{id}`, `GET /admin/stores/{id}/orders`, `GET /admin/orders/{id}` and `POST /admin/orders/{id}/status`)

### Requirement: Path ids read environment variables

A path parameter named `id` that directly follows the segment `stores`, `products`, `addresses`, `orders`, `riders` or `deliveries`, or a path parameter named exactly like the variable for that segment (for example `{orderId}` after `orders`), SHALL take the value `{{storeId}}`, `{{productId}}`, `{{addressId}}`, `{{orderId}}`, `{{riderId}}` or `{{deliveryId}}` in the request and in every saved response's `originalRequest`; other path parameters SHALL keep the contract's example.

#### Scenario: Order id
- **WHEN** the contract has `GET /orders/{id}`
- **THEN** the request's `id` path variable is `{{orderId}}`

#### Scenario: Rider and delivery ids
- **WHEN** a rider contract has `GET /admin/riders/{id}`, `GET /me/deliveries/{id}` and `GET /orders/{orderId}/delivery`
- **THEN** their path variables are `id` = `{{riderId}}`, `id` = `{{deliveryId}}` and `orderId` = `{{orderId}}`

#### Scenario: Slug keeps its example
- **WHEN** the contract has `GET /stores/{id}/products/{slug}` with `slug` example `banana-robusta`
- **THEN** the path variables are `id` = `{{storeId}}` and `slug` = `banana-robusta`

#### Scenario: Saved responses read the same ids
- **WHEN** the contract has `GET /orders/{id}` with `id` example `o1` and a documented 200 example response
- **THEN** every saved response's `originalRequest` has the `id` path variable `{{orderId}}`, not `o1`

### Requirement: Postman collection is byte-stable

The generated collection SHALL depend only on the contract: no generated ids (`id`, `_postman_id`), no collection-level variables, JSON with two-space indentation and a trailing newline, identical bytes on every run. A parameter with no `example` or `examples` on itself or its schema SHALL take its schema's `default`, else its schema's first `enum` value, else the text `<name>` for its own name.

#### Scenario: Two runs give identical bytes
- **WHEN** `make postman` runs twice on an unchanged contract
- **THEN** the second run leaves `git status --porcelain` empty and the file contains no `id` or `_postman_id` key

#### Scenario: Parameter without an example
- **WHEN** a contract has `GET /things/{code}` with path parameter `code` (string) and query parameter `since` (string, format `date-time`), neither with an example, and a documented 200 example response
- **THEN** two generations give identical bytes, and the request and every saved response's `originalRequest` have `code` = `<code>` and `since` = `<since>`

#### Scenario: Default and enum fill a missing example
- **WHEN** a contract's query parameter `pageSize` has schema `default` 24 and query parameter `status` has schema `enum` `["ready", "delivered"]`, neither with an example
- **THEN** the request has `pageSize` = `24` and `status` = `ready`

### Requirement: Local Postman environment

`docs/postman/local.postman_environment.json` SHALL be a Postman environment holding exactly, in this order, `baseUrl` = `http://localhost:8080/api/core/v1`, empty `customerToken` and `staffToken`, `storeId`, `productId`, `addressId`, `orderId` set to the fixed ids that `core-admin seed-demo` loads and prints for a demo store, product, address and order, then the four rider variables, then `serviceToken`. Token variables SHALL have type `secret`.

#### Scenario: Environment variables
- **WHEN** the environment file is read
- **THEN** its variable keys are exactly `baseUrl`, `customerToken`, `staffToken`, `storeId`, `productId`, `addressId`, `orderId`, `riderBaseUrl`, `riderToken`, `riderId`, `deliveryId`, `serviceToken` in that order, `baseUrl` is `http://localhost:8080/api/core/v1`, `riderBaseUrl` is `http://localhost:8081/api/rider/v1`, `customerToken`, `staffToken` and `riderToken` are empty, and all four token variables have type `secret`

#### Scenario: Ids are the seeded rows
- **WHEN** `seed-demo --reset` has run and the environment file is read
- **THEN** `storeId` is `00000000-0000-4000-8000-000000000401`, `productId` `00000000-0000-4000-8000-000000000601`, `addressId` `00000000-0000-4000-8000-000000000301` and `orderId` `00000000-0000-4000-8000-000000000703`, each the id the `seed-demo` output marks with that variable name and one row of `stores`, `products`, `addresses` and `orders`

### Requirement: make gen runs the rider sqlc

`make gen` SHALL run `sqlc generate` in `services/core` when `services/core/sqlc.yaml` exists, then in `services/rider` when `services/rider/sqlc.yaml` exists, then the `gen:api` and `gen:tokens` scripts of `packages/ui`; each step skips on its own, and a second run on an unchanged tree SHALL change no file.

#### Scenario: Rider sqlc between core sqlc and the API types
- **WHEN** `make -n gen` runs with both `sqlc.yaml` files and `packages/ui` present
- **THEN** it prints `cd services/core && sqlc generate`, then `cd services/rider && sqlc generate`, then `npm run gen:api --workspace packages/ui --if-present`, then `npm run gen:tokens --workspace packages/ui --if-present`

#### Scenario: make gen leaves the tree clean
- **WHEN** `make gen` runs on a clean checkout of the branch
- **THEN** it exits 0 and `git status --porcelain` is empty, `packages/ui/src/tokens.ts` included

## ADDED Requirements

### Requirement: Postman environment carries the service token

`docs/postman/local.postman_environment.json` SHALL end with `serviceToken` of type `secret` whose value is the `Makefile` default of `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN`, the token core accepts under `make dev` through `SHOPPERSTOP_CORE_SERVICE_TOKENS`, so the service routes run against `make dev` without a sign-in.

#### Scenario: Service token is the dev token
- **WHEN** the environment file and the `Makefile` are read
- **THEN** the last variable is `serviceToken`, its type is `secret`, and its value equals the value after `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN ?=` in the `Makefile` (`dev-rider-service-token-dev-rider-00` today)

### Requirement: README troubleshooting and tooling notes

`README.md` SHALL have a `## Troubleshooting` section naming the npm 10.9.9 crash `Cannot read properties of null (reading 'edgesOut')` on an `npm install` that adds a workspace and the workaround rider-P3-L3 used; its `make gen` row SHALL name `packages/ui/src/tokens.ts`, and its `## API` section SHALL name the `serviceToken` variable.

#### Scenario: Troubleshooting names the crash and the workaround
- **WHEN** `README.md` is read
- **THEN** it has a `## Troubleshooting` section containing `Cannot read properties of null (reading 'edgesOut')`, `10.9.9`, `@vitest/browser-playwright`, `npm install --package-lock-only` and `npm ci --dry-run`

#### Scenario: README names the tokens step and the service token
- **WHEN** `README.md` is read
- **THEN** the `make gen` table row contains `packages/ui/src/tokens.ts` and the `## API` section contains `serviceToken` and `x-service-token`
