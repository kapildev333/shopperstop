# platform

## Purpose
Cross-cutting behaviour of the core service that every capability relies on: configuration, health, the error envelope, request limits, CORS and logging.

## Requirements

### Requirement: Configuration fails fast
The core service SHALL read its configuration from `SHOPPERSTOP_CORE_*` environment variables and refuse to start while naming every missing variable.

#### Scenario: Missing variables are all named
- **WHEN** the service starts with `SHOPPERSTOP_CORE_DATABASE_URL` and `SHOPPERSTOP_CORE_SESSION_PEPPER` unset
- **THEN** it exits non-zero with a message that names both variables

#### Scenario: Short pepper is refused
- **WHEN** `SHOPPERSTOP_CORE_SESSION_PEPPER` is shorter than 32 bytes
- **THEN** the service refuses to start and says the pepper must be at least 32 bytes

### Requirement: Health endpoints
The core service SHALL answer `GET /api/core/v1/healthz` with 200 always and `GET /api/core/v1/readyz` with 200 only when the database answers a ping.

#### Scenario: Ready when the database answers
- **WHEN** the database is reachable
- **THEN** `readyz` answers 200 `{"status":"ok"}`

#### Scenario: Not ready when the database is down
- **WHEN** the database does not answer within 2 seconds
- **THEN** `readyz` answers 503 with the error envelope code `internal`

### Requirement: Error envelope
Every error response SHALL be JSON `{"error":{"code","message","field"?,"productIds"?}}` with `code` one of `validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `out_of_stock`, `not_serviceable`, `rate_limited`, `internal`. `productIds` SHALL be present only with `out_of_stock` and list the offending product ids.

#### Scenario: Unknown route
- **WHEN** a client requests a path the router does not serve
- **THEN** the response is 404 with code `not_found`

#### Scenario: Panic in a handler
- **WHEN** a handler panics
- **THEN** the response is 500 with code `internal` and the panic is logged with the request id

#### Scenario: Out of stock names the products
- **WHEN** an error with code `out_of_stock` and product ids is written
- **THEN** the body is `{"error":{"code":"out_of_stock","message":...,"productIds":[...]}}` with those ids, and an error without product ids has no `productIds` member

### Requirement: Request body limits
The core service SHALL reject JSON bodies over 1 MiB (16 MiB on image upload), bodies containing a NUL byte, and malformed JSON, with 400 `validation`.

#### Scenario: NUL byte in a field
- **WHEN** a JSON body contains `\u0000` in any string
- **THEN** the response is 400 with code `validation`

#### Scenario: Body too large
- **WHEN** a JSON body exceeds 1 MiB
- **THEN** the response is 400 with code `validation` and message `body too large`

### Requirement: CORS
The core service SHALL allow cross-origin requests only from the origins in `SHOPPERSTOP_CORE_WEB_ORIGINS`, with `Authorization` and `Content-Type` headers and the methods GET, POST, PUT, PATCH, DELETE.

#### Scenario: Allowed origin
- **WHEN** a request carries `Origin: http://localhost:5173` and that origin is configured
- **THEN** the response carries `Access-Control-Allow-Origin: http://localhost:5173`

#### Scenario: Unknown origin
- **WHEN** a request carries an origin that is not configured
- **THEN** the response carries no `Access-Control-Allow-Origin` header

### Requirement: Request logging
The core service SHALL log one JSON line per request with method, route pattern (never the raw path), status, duration and request id, and accept or generate `X-Request-Id`.

#### Scenario: Route pattern, not path
- **WHEN** a client requests `/api/core/v1/stores/123e4567-e89b-12d3-a456-426614174000`
- **THEN** the log line's `route` is `/api/core/v1/stores/{id}`

#### Scenario: Request id echoed
- **WHEN** a request carries `X-Request-Id: abc`
- **THEN** the response carries `X-Request-Id: abc` and the log line has `requestId` `abc`

### Requirement: One database and owner role per service

The local Postgres SHALL be initialised from `deploy/initdb.sql`, which creates for each service, `core` and `rider`, a login role named `shopperstop_<service>` with password `shopperstop_<service>` and the databases `shopperstop_<service>`, `shopperstop_<service>_test` and `shopperstop_<service>_e2e`, all owned by that role. No role SHALL own another service's database.

#### Scenario: Core role reaches its test database
- **WHEN** Postgres has been initialised from `deploy/initdb.sql` and a client connects to `localhost:5432` as `shopperstop_core` with password `shopperstop_core` to database `shopperstop_core_test`
- **THEN** `select 1` returns `1`

#### Scenario: Core owns all three of its databases
- **WHEN** `select datname from pg_database where pg_get_userbyid(datdba) = 'shopperstop_core'` runs on the initialised Postgres
- **THEN** it returns exactly `shopperstop_core`, `shopperstop_core_test` and `shopperstop_core_e2e`

#### Scenario: Rider role reaches its test database
- **WHEN** Postgres has the rider statements of `deploy/initdb.sql` applied and a client connects to `localhost:5432` as `shopperstop_rider` with password `shopperstop_rider` to database `shopperstop_rider_test`
- **THEN** `select 1` returns `1`

#### Scenario: Rider owns all three of its databases
- **WHEN** `select datname from pg_database where pg_get_userbyid(datdba) = 'shopperstop_rider'` runs on that Postgres
- **THEN** it returns exactly `shopperstop_rider`, `shopperstop_rider_e2e` and `shopperstop_rider_test`

#### Scenario: initdb.sql holds four statements per service
- **WHEN** `deploy/initdb.sql` is read
- **THEN** it holds, after the four core statements, `create role shopperstop_rider login password 'shopperstop_rider';` and `create database shopperstop_rider owner shopperstop_rider;`, `create database shopperstop_rider_test owner shopperstop_rider;`, `create database shopperstop_rider_e2e owner shopperstop_rider;`, and nothing else

### Requirement: make db starts Postgres and waits for health

`make db` SHALL start only the `postgres` service of `deploy/docker-compose.yml` in compose project `shopperstop`, detached, and return only after the service's `pg_isready` healthcheck passes, so that the container is named `shopperstop-postgres-1` and listens on port 5432.

#### Scenario: make db brings up a healthy container
- **WHEN** `make db` runs on a machine with Docker running and port 5432 free
- **THEN** it exits 0 only after the healthcheck passes, and `docker ps` lists `shopperstop-postgres-1`

#### Scenario: make db names the compose file and service
- **WHEN** `make -n db` runs from the repository root
- **THEN** it prints `docker compose -f <repo>/deploy/docker-compose.yml up -d --wait postgres`

### Requirement: Caddy runs only under the prod profile

The `caddy` service in `deploy/docker-compose.yml` SHALL belong to the `prod` profile, so `make db` never starts it, and SHALL mount `../apps` read-only at `/srv/apps` as its only app mount.

#### Scenario: make db leaves Caddy stopped
- **WHEN** `make db` has completed
- **THEN** `docker ps` lists no Caddy container for project `shopperstop`

#### Scenario: One app mount, no host directory created
- **WHEN** `deploy/docker-compose.yml` is read
- **THEN** the `caddy` service's volumes are exactly `./Caddyfile:/etc/caddy/Caddyfile:ro` and `../apps:/srv/apps:ro`, so a missing `apps/rider/dist` is never created on the host by compose

### Requirement: Caddy routes each prefix to its service or app

`deploy/Caddyfile` SHALL route `/api/core/*` to the core process on port 8080, `/api/rider/*` to the rider process on port 8081, `/admin/*` to `/srv/apps/admin/dist` and `/rider/*` to `/srv/apps/rider/dist`, each with its prefix stripped and SPA fallback to `index.html`, and every other path to `/srv/apps/web/dist` with SPA fallback.

#### Scenario: Caddyfile routes the three prefixes
- **WHEN** `deploy/Caddyfile` is read
- **THEN** it has a `handle /api/core/*` block with `reverse_proxy host.docker.internal:8080`, a `handle /admin/*` block with `uri strip_prefix /admin` and `try_files {path} /index.html` rooted at `/srv/apps/admin/dist`, and a catch-all `handle` rooted at `/srv/apps/web/dist` with the same `try_files`

#### Scenario: Caddyfile routes the rider prefixes
- **WHEN** `deploy/Caddyfile` is read
- **THEN** it has a `handle /api/rider/*` block with `reverse_proxy host.docker.internal:8081` and a `handle /rider/*` block with `uri strip_prefix /rider` and `try_files {path} /index.html` rooted at `/srv/apps/rider/dist`

### Requirement: Configured origins are normalised
The core service SHALL trim surrounding whitespace from each comma-separated entry of `SHOPPERSTOP_CORE_WEB_ORIGINS`, ignore empty entries, treat a list with no non-empty entry as missing, and never allow a request whose `Origin` header is empty.

#### Scenario: Spaces and a trailing comma
- **WHEN** `SHOPPERSTOP_CORE_WEB_ORIGINS` is `http://a, http://b,` and a request carries `Origin: http://b`
- **THEN** the response carries `Access-Control-Allow-Origin: http://b`

#### Scenario: Empty origin is never allowed
- **WHEN** a request carries an empty `Origin` header
- **THEN** the response carries no `Access-Control-Allow-Origin` header

#### Scenario: Only commas
- **WHEN** `SHOPPERSTOP_CORE_WEB_ORIGINS` is `,`
- **THEN** the service refuses to start and names `SHOPPERSTOP_CORE_WEB_ORIGINS` as missing

### Requirement: Log level is configurable
The core service SHALL read `SHOPPERSTOP_CORE_LOG_LEVEL` as one of `debug`, `info`, `warn`, `error`, default to `info` when it is unset, and refuse to start on any other value.

#### Scenario: Default level
- **WHEN** `SHOPPERSTOP_CORE_LOG_LEVEL` is unset
- **THEN** the service logs at level `info`

#### Scenario: Unknown level is refused
- **WHEN** `SHOPPERSTOP_CORE_LOG_LEVEL` is `loud`
- **THEN** the service refuses to start and names `SHOPPERSTOP_CORE_LOG_LEVEL`

### Requirement: Schema migrations apply once, in order
`core-admin migrate` SHALL apply every embedded migration file named `NNNN_<name>.sql` that the database has not recorded, in file-name order, each in its own transaction that also records the file's version, and SHALL refuse a `.sql` file whose name does not match that pattern.

#### Scenario: Pending migrations are applied and recorded
- **WHEN** migrate runs on an empty database with files `0001_a.sql` and `0002_b.sql`
- **THEN** both are applied in that order and both versions are recorded

#### Scenario: A second run applies nothing
- **WHEN** migrate runs again with no new file
- **THEN** no migration is applied and the recorded versions are unchanged

#### Scenario: Misnamed file is refused
- **WHEN** the embedded files include `add-stores.sql`
- **THEN** migrate fails naming that file and applies nothing

### Requirement: A failed migration leaves no trace
When a migration file fails, `core-admin migrate` SHALL roll back that file's statements, SHALL NOT record its version, SHALL NOT attempt later files, and SHALL exit non-zero naming the file, so the next run retries it.

#### Scenario: Failure halfway through a file
- **WHEN** `0002_b.sql` creates a table and then runs a statement that fails
- **THEN** migrate fails naming `0002_b.sql`, the table does not exist, and only `0001_a` is recorded

#### Scenario: Retry after the fix
- **WHEN** `0002_b.sql` is corrected and migrate runs again
- **THEN** `0002_b.sql` is applied and recorded

### Requirement: The OpenAPI file matches the router
`services/core/openapi.json` SHALL list exactly the method and path pairs the core router serves under `/api/core/v1`, and each operation SHALL have a `summary`, a `description`, at least one tag and at least one response example; the service test suite SHALL fail otherwise.

#### Scenario: Served route missing from the file
- **WHEN** the router serves `GET /api/core/v1/extra` and `openapi.json` does not list it
- **THEN** the contract test fails naming `GET /api/core/v1/extra`

#### Scenario: Documented route not served
- **WHEN** `openapi.json` lists `GET /extra` and the router does not serve it
- **THEN** the contract test fails naming `GET /api/core/v1/extra`

#### Scenario: Operation without an example
- **WHEN** an operation in `openapi.json` has no response example
- **THEN** the contract test fails naming that operation

### Requirement: Graceful shutdown
On SIGINT or SIGTERM the core service SHALL stop accepting new connections, let in-flight requests finish for up to 10 seconds, close its database pool and exit 0.

#### Scenario: In-flight request completes
- **WHEN** the service is asked to stop while a request is being handled
- **THEN** that request receives its full response and the server returns without error

### Requirement: Postman collection is generated from the contract

`make postman` SHALL write `docs/postman/shopperstop-<service>.postman_collection.json` for each service (`core`, `rider`) from `services/<service>/openapi.json` alone: one folder per tag in the contract's tag order, one request per operation named by its `summary`, URLs rooted at `{{baseUrl}}` for core and `{{riderBaseUrl}}` for rider, each request body example as the raw JSON body. An invalid OpenAPI document SHALL make it exit non-zero without writing the collection.

#### Scenario: Folders follow the contract tags
- **WHEN** `make postman` runs against the Phase 1 contract
- **THEN** the collection has one folder `platform` holding `GET {{baseUrl}}/healthz` named `Liveness` and `GET {{baseUrl}}/readyz` named `Readiness`

#### Scenario: Request carries its example body
- **WHEN** the contract has `POST /auth/sign-in` with request body example `{"email":"customer@example.com","password":"password123"}`
- **THEN** that request's raw body parses to the same object

#### Scenario: Invalid contract is refused
- **WHEN** the generator is given a document without an `openapi` version
- **THEN** it fails with an error and no collection is written

#### Scenario: Rider URLs read the rider base URL
- **WHEN** the generator converts a rider contract with `servers` `/api/rider/v1` and `GET /healthz`
- **THEN** every request's URL host is `{{riderBaseUrl}}` and the collection text contains no `{{baseUrl}}`

### Requirement: Postman skips a service without a contract

A service whose `services/<service>/openapi.json` is absent SHALL be skipped by `make postman` with the line `postman: services/<service>/openapi.json absent, skipping` and no collection written for it; once the contract exists, its committed collection SHALL match the generator's output.

#### Scenario: Rider skipped while its contract is absent
- **WHEN** `make postman` runs on a tree without `services/rider/openapi.json`
- **THEN** it prints `postman: services/rider/openapi.json absent, skipping`, writes no `docs/postman/shopperstop-rider.postman_collection.json`, and the core collection is byte-identical to the one committed before this change

#### Scenario: Committed rider collection matches the rider contract
- **WHEN** `services/rider/openapi.json` exists and `node --test scripts/postman.test.mjs` runs
- **THEN** it fails unless `docs/postman/shopperstop-rider.postman_collection.json` equals the generator's output for that contract

### Requirement: Postman requests authenticate from environment tokens

Every operation the contract marks with a bearer `security` requirement SHALL carry bearer auth reading `{{staffToken}}` when its path starts with `/admin/`; otherwise, in the rider collection, `{{riderToken}}` when its path starts with `/auth/` or is or starts with `/me`, and `{{customerToken}}` for every other path of either collection. Operations without `security` SHALL carry no auth.

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

### Requirement: Sign-in requests store the returned token

A request whose path has an `auth` segment and whose contract documents a 2xx response example with a string `token` SHALL carry a Postman test script that stores the response's `token` into the token variable its own auth would read by the rule of "Postman requests authenticate from environment tokens": `staffToken` when the path starts with `/admin/`, `riderToken` in the rider collection, `customerToken` otherwise. Other requests SHALL carry no script.

#### Scenario: Customer sign-in
- **WHEN** `POST /auth/sign-in` documents a 200 example `{"token":"...","customer":{...}}`
- **THEN** its test script sets `customerToken` from `pm.response.json().token`

#### Scenario: Staff sign-in
- **WHEN** `POST /admin/auth/sign-in` documents a 200 example with a `token`
- **THEN** its test script sets `staffToken`

#### Scenario: Sign-out has no script
- **WHEN** `POST /auth/sign-out` documents only a 204 response
- **THEN** its request has no test script

#### Scenario: Rider sign-in
- **WHEN** a rider contract's `POST /auth/sign-in` documents a 200 example `{"token":"...","rider":{...}}`
- **THEN** its test script is exactly `pm.environment.set('riderToken', pm.response.json().token);`

### Requirement: Path ids read environment variables

A path parameter named `id` that directly follows the segment `stores`, `products`, `addresses`, `orders`, `riders` or `deliveries`, or a path parameter named exactly like the variable for that segment (for example `{orderId}` after `orders`), SHALL take the value `{{storeId}}`, `{{productId}}`, `{{addressId}}`, `{{orderId}}`, `{{riderId}}` or `{{deliveryId}}`; other path parameters SHALL keep the contract's example.

#### Scenario: Order id
- **WHEN** the contract has `GET /orders/{id}`
- **THEN** the request's `id` path variable is `{{orderId}}`

#### Scenario: Rider and delivery ids
- **WHEN** a rider contract has `GET /admin/riders/{id}`, `GET /me/deliveries/{id}` and `GET /orders/{orderId}/delivery`
- **THEN** their path variables are `id` = `{{riderId}}`, `id` = `{{deliveryId}}` and `orderId` = `{{orderId}}`

#### Scenario: Slug keeps its example
- **WHEN** the contract has `GET /stores/{id}/products/{slug}` with `slug` example `banana-robusta`
- **THEN** the path variables are `id` = `{{storeId}}` and `slug` = `banana-robusta`

### Requirement: Postman collection is byte-stable

The generated collection SHALL depend only on the contract: no generated ids (`id`, `_postman_id`), no collection-level variables, JSON with two-space indentation and a trailing newline, identical bytes on every run.

#### Scenario: Two runs give identical bytes
- **WHEN** `make postman` runs twice on an unchanged contract
- **THEN** the second run leaves `git status --porcelain` empty and the file contains no `id` or `_postman_id` key

### Requirement: Local Postman environment

`docs/postman/local.postman_environment.json` SHALL be a Postman environment holding exactly, in this order, `baseUrl` = `http://localhost:8080/api/core/v1`, empty `customerToken` and `staffToken`, `storeId`, `productId`, `addressId`, `orderId` set to the fixed ids that `core-admin seed-demo` loads and prints for a demo store, product, address and order, then the four rider variables of the next requirement. Token variables SHALL have type `secret`.

#### Scenario: Environment variables
- **WHEN** the environment file is read
- **THEN** its variable keys are exactly those eleven in that order, `baseUrl` is `http://localhost:8080/api/core/v1`, `riderBaseUrl` is `http://localhost:8081/api/rider/v1`, and `customerToken`, `staffToken` and `riderToken` are empty with type `secret`

#### Scenario: Ids are the seeded rows
- **WHEN** `seed-demo --reset` has run and the environment file is read
- **THEN** `storeId` is `00000000-0000-4000-8000-000000000401`, `productId` `00000000-0000-4000-8000-000000000601`, `addressId` `00000000-0000-4000-8000-000000000301` and `orderId` `00000000-0000-4000-8000-000000000703`, each the id the `seed-demo` output marks with that variable name and one row of `stores`, `products`, `addresses` and `orders`

### Requirement: Postman environment carries the rider variables

After the core variables, `docs/postman/local.postman_environment.json` SHALL hold `riderBaseUrl` = `http://localhost:8081/api/rider/v1`, empty `riderToken` of type `secret`, `riderId` = `00000000-0000-4000-8000-000000000801` and `deliveryId` = `00000000-0000-4000-8000-000000000901`, the fixed ids the rider seed loads for the first Koramangala rider and the demo delivery (`.claude/areas/rider.md`).

#### Scenario: Rider ids are fixed
- **WHEN** the environment file is read
- **THEN** `riderId` is `00000000-0000-4000-8000-000000000801` and `deliveryId` is `00000000-0000-4000-8000-000000000901`

### Requirement: Repository documentation matches the tree

The repository SHALL have a `README.md` whose quick start runs the stack with `make dev` and whose sign-in table lists the Spec 2 §11 demo accounts and the Phase 3 demo riders, and a `CLAUDE.md` that names every developer `make` target and states the CI, end-to-end and Figma rules as PLAN.md D11, D14, D15, D17 and D29 decided. Every `make` target either file names SHALL exist in the `Makefile`, and every relative link in either file SHALL resolve to a path in the tree.

#### Scenario: README has the quick start
- **WHEN** `README.md` is read
- **THEN** it has a `## Quick start` section with a code block containing `make dev`, names the prerequisites Docker (running), Go 1.27 and Node 22.12 or newer, names core on `:8080`, web on `:5173`, admin on `:5174/admin/`, the rider service on `:8081` and the rider app on `:5175/rider/`, and says which of those are not on `main` yet

#### Scenario: README has the step-by-step fold and the screenshots table
- **WHEN** `README.md` is read
- **THEN** it has a `<details>` block with numbered steps that start Postgres, apply migrations and the seed, and run core without `make dev`, and a `## Screenshots` section with a Markdown table

#### Scenario: README lists the demo sign-ins
- **WHEN** `README.md` is read
- **THEN** it contains `admin@shopperstop.local` with `admin12345`, `koramangala@shopperstop.local` and `indiranagar@shopperstop.local` with `staff12345`, and `demo@shopperstop.local` with `demo12345`, says the accounts are loaded by `seed-demo --reset` from Phase 2, and contains `rider1-koramangala@shopperstop.local` with `rider12345` as loaded by `rider-admin seed-demo --reset` from Phase 3

#### Scenario: README tells an existing clone how to add the rider databases
- **WHEN** `README.md` is read
- **THEN** it says that `deploy/initdb.sql` runs only when the Postgres volume is created and gives one command that applies the file's `shopperstop_rider` lines to the running `shopperstop-postgres-1` as `postgres` without `psql` on the host

#### Scenario: CLAUDE.md names every developer make target
- **WHEN** `CLAUDE.md` is read
- **THEN** it contains `make db`, `make dev`, `make test`, `make test-core`, `make test-rider`, `make test-web`, `make e2e`, `make gen`, `make postman` and `make prod-local`, and `make -n <target>` exits 0 for each of them and for every other `make <target>` named in `README.md` or `CLAUDE.md`

#### Scenario: CLAUDE.md states the current CI, e2e and Figma rules
- **WHEN** `CLAUDE.md` is read
- **THEN** it does not contain `sqlc diff` or "No product code yet", and it contains `make gen postman`, `shopperstop_core_e2e`, `shopperstop_rider_e2e`, `18080`, `18081`, `15173`, `15174`, `15175`, `22.12`, the CI job name `rider`, and the three Figma page names `Tokens & Components`, `Customer web` and `Admin web`

#### Scenario: Relative links resolve
- **WHEN** every Markdown link target in `README.md` and `CLAUDE.md` that does not start with `http` or `#` is resolved from the repository root, with any `#fragment` removed
- **THEN** each one exists in the tree

### Requirement: PATCH bodies refuse explicit null
A PATCH body SHALL be a JSON object, and a member whose value is `null` SHALL be refused with 400 `validation` naming that member in `field`; members that are absent leave their value unchanged.

#### Scenario: Null phone
- **WHEN** a signed-in customer sends `PATCH /api/core/v1/me` with `{"phone":null}`
- **THEN** the response is 400 with code `validation` and field `phone`

### Requirement: Lists are paged
Every list response SHALL be `{items, page, pageSize, total}` with `items` always an array, read `page` (default 1, at least 1) and `pageSize` (default 24, 1 to 100) from the query string, and refuse any other value with 400 `validation` naming the parameter.

#### Scenario: Defaults
- **WHEN** a list is requested without `page` or `pageSize`
- **THEN** the response has `page` 1, `pageSize` 24 and an `items` array (empty when there is nothing)

#### Scenario: Page size over the maximum
- **WHEN** a list is requested with `pageSize=101`
- **THEN** the response is 400 with code `validation` and field `pageSize`

### Requirement: Malformed path ids are not found
A path id that is not a uuid in canonical hyphenated form SHALL answer 404 `not_found`, the same as an id that does not exist.

#### Scenario: Not a uuid
- **WHEN** a signed-in customer sends `DELETE /api/core/v1/me/addresses/abc`
- **THEN** the response is 404 with code `not_found`

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

### Requirement: Authenticated operations declare bearer security
`services/core/openapi.json` SHALL declare `components.securitySchemes.bearer` as HTTP bearer, and an operation SHALL carry `security: [{"bearer": []}]` exactly when the router answers that operation 401 to a request without a token; the service test suite SHALL fail otherwise, naming the operation.

#### Scenario: Protected route without security
- **WHEN** the router answers `GET /api/core/v1/extra` 401 without a token and its operation has no `security`
- **THEN** the contract test fails naming `GET /api/core/v1/extra`

#### Scenario: Public route with security
- **WHEN** an operation carries `security` and the router answers it without a token with a status other than 401
- **THEN** the contract test fails naming that operation

### Requirement: Files directory is configured
The core service SHALL read `SHOPPERSTOP_CORE_FILES_DIR`, the directory that holds uploaded and demo images, as required configuration and refuse to start without it, naming it with every other missing variable.

#### Scenario: Files directory unset
- **WHEN** the service starts with `SHOPPERSTOP_CORE_FILES_DIR` unset
- **THEN** it refuses to start with a message that names `SHOPPERSTOP_CORE_FILES_DIR`

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

### Requirement: Rider make targets skip while the rider is absent

The Makefile targets `rider`, `rider-app` and `test-rider`, and the rider steps of `seed`, `e2e`, `gen` and `prod-local`, SHALL each print one line `<target>: <path> absent, skipping`, exit 0 and run no rider command while the path they drive is absent (`services/rider`, `apps/rider`, or `services/rider/sqlc.yaml` for `gen`); every core, web and admin command those targets ran before SHALL still run.

#### Scenario: Rider targets skip on today's tree
- **WHEN** `make rider`, `make rider-app` and `make test-rider` run on a tree without `services/rider` and `apps/rider`
- **THEN** each exits 0 and prints `rider: services/rider absent, skipping`, `rider-app: apps/rider absent, skipping` and `test-rider: services/rider absent, skipping` respectively, with no `go` command run

#### Scenario: Rider steps of shared targets skip
- **WHEN** `make -n seed`, `make -n e2e`, `make -n gen` and `make -n prod-local` run on a tree without `services/rider`
- **THEN** each prints a recipe whose rider branch is guarded by `test -d services/rider` with `else echo "<target>: services/rider absent, skipping"` (for `gen`: `test -f services/rider/sqlc.yaml` with `gen: services/rider/sqlc.yaml absent, skipping`), and each still prints every core, web and admin command it printed before this change

### Requirement: make dev runs the rider service and app

`make dev` SHALL run `make db`, then `make seed` (core, then rider: `migrate` and `seed-demo --reset`), then `core`, `rider`, `web`, `admin` and `rider-app` side by side until interrupted. Rider commands SHALL receive the `SHOPPERSTOP_RIDER_*` dev defaults, each overridable from the shell or the make command line, and core SHALL accept the rider's dev service token and the rider app's origin.

#### Scenario: Dry run shows five servers
- **WHEN** `make -n dev` runs with `services/core`, `services/rider`, `apps/web`, `apps/admin`, `apps/rider` and `packages/ui` present
- **THEN** it prints, in order, the compose `up -d --wait postgres` command, core `migrate` and `seed-demo --reset`, rider `rider-admin migrate` and `rider-admin seed-demo --reset`, `-j5 core rider web admin rider-app`, then `go run ./cmd/core`, `go run ./cmd/rider` and `npm run dev` for `apps/web`, `apps/admin` and `apps/rider`

#### Scenario: Core accepts the rider's dev token
- **WHEN** `make -n core` and `make -n rider` run with no rider variable in the environment
- **THEN** the core command carries `SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:` followed by exactly the value the rider command carries as `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN`, and both carry `http://localhost:5175` in their web origins

#### Scenario: Rider dev defaults
- **WHEN** `make -n rider` runs with `services/rider` present and no rider variable in the environment
- **THEN** the command carries `SHOPPERSTOP_RIDER_DATABASE_URL` for `shopperstop_rider` as `shopperstop_rider`, `SHOPPERSTOP_RIDER_ADDR=':8081'`, a `SHOPPERSTOP_RIDER_SESSION_PEPPER` of at least 32 bytes, `SHOPPERSTOP_RIDER_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175'`, `SHOPPERSTOP_RIDER_CORE_URL='http://localhost:8080'` and a non-empty `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN`

#### Scenario: A rider variable is overridden
- **WHEN** `make -n rider SHOPPERSTOP_RIDER_ADDR=:9091` runs with `services/rider` present
- **THEN** the printed rider command carries `SHOPPERSTOP_RIDER_ADDR=':9091'`

### Requirement: make test runs the rider gates

`make test` SHALL run `test-core`, then `test-rider`, then `test-web`. `test-rider` SHALL run from `services/rider` `gofmt -l .` (failing when it prints anything), `go vet ./...` and `go test -race ./...` with `SHOPPERSTOP_RIDER_TEST_DATABASE_URL`, default the local `shopperstop_rider_test` database as `shopperstop_rider`.

#### Scenario: Rider gates in order
- **WHEN** `make -n test` runs with `services/core`, `services/rider` and `packages/ui` present
- **THEN** the `services/rider` recipe with `gofmt -l .`, `go vet ./...` and `go test -race ./...` carrying `shopperstop_rider_test` appears after the `services/core` recipe and before `npm run lint`

#### Scenario: Unformatted rider Go fails the gate
- **WHEN** a `.go` file under `services/rider` is not gofmt-formatted and `make test-rider` runs
- **THEN** it prints the file's path and exits non-zero before running `go test`

### Requirement: make e2e gives the rider an isolated environment

`make e2e` SHALL, when `services/rider` exists, migrate and reseed `shopperstop_rider_e2e` after core's e2e database and before building the workspaces, and SHALL run every core, rider and `npm run e2e` command with one fixed environment holding both services' e2e values. Values from the developer's shell or the dev defaults SHALL NOT reach it.

#### Scenario: Dev rider variables do not leak into e2e
- **WHEN** the shell exports `SHOPPERSTOP_RIDER_DATABASE_URL=leak` and `SHOPPERSTOP_CORE_DATABASE_URL=leak` and `make -n e2e` runs with `services/core`, `services/rider` and `apps/web` present
- **THEN** no printed line contains `leak`, and the printed `rider-admin migrate`, `rider-admin seed-demo --reset` and `npm run e2e` commands carry `shopperstop_rider_e2e`, `SHOPPERSTOP_RIDER_ADDR=':18081'` and `SHOPPERSTOP_RIDER_CORE_URL='http://localhost:18080'`

#### Scenario: e2e core accepts the e2e rider token
- **WHEN** `make -n e2e` runs with `services/core`, `services/rider` and `apps/web` present
- **THEN** the `npm run e2e` command carries `SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:` followed by exactly its `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN` value, that value differs from the dev default, and both services' web origins are `http://localhost:15173,http://localhost:15174,http://localhost:15175`

### Requirement: make gen runs the rider sqlc

`make gen` SHALL run `sqlc generate` in `services/core` when `services/core/sqlc.yaml` exists, then in `services/rider` when `services/rider/sqlc.yaml` exists, then the `gen:api` script of `packages/ui`; each step skips on its own.

#### Scenario: Rider sqlc between core sqlc and the API types
- **WHEN** `make -n gen` runs with both `sqlc.yaml` files and `packages/ui` present
- **THEN** it prints `cd services/core && sqlc generate`, then `cd services/rider && sqlc generate`, then `npm run gen:api --workspace packages/ui --if-present`

### Requirement: make prod-local runs the rider behind Caddy

`make prod-local` SHALL build every workspace, start the compose `prod` profile, migrate the core database and, when `services/rider` exists, the rider database, then run core and rider side by side with the dev environment, so `http://localhost/rider/` serves the rider build and `/api/rider/` the rider service.

#### Scenario: Dry run shows build, Caddy, migrations and two servers
- **WHEN** `make -n prod-local` runs with `services/core`, `services/rider`, `apps/web` and `apps/admin` present
- **THEN** it prints, in order, `npm run build --workspaces --if-present`, the compose `--profile prod up -d --wait` command, `go run ./cmd/core-admin migrate`, `go run ./cmd/rider-admin migrate`, then `go run ./cmd/core` and `go run ./cmd/rider`

### Requirement: CI runs a rider job

`.github/workflows/ci.yml` SHALL have exactly the jobs `core`, `rider`, `web`, `e2e` and `spec`. The `rider` job SHALL print `rider: services/rider absent, skipping` and succeed without a toolchain while `services/rider/go.mod` is absent, and otherwise run `make test-rider` against a `postgres:16` service loaded from `deploy/initdb.sql`. The `core` job's `make gen postman` clean-tree check SHALL cover the rider's generated files too.

#### Scenario: Workflow shape with the rider job
- **WHEN** `.github/workflows/ci.yml` is parsed as YAML
- **THEN** its jobs are exactly `core`, `rider`, `web`, `e2e` and `spec`, and every `rider` step after checkout carries an `if:` on `hashFiles('services/rider/go.mod')`

#### Scenario: Rider tests reach the CI database
- **WHEN** the `rider` job runs `make test-rider` on a tree with `services/rider/go.mod`
- **THEN** the job's env sets `SHOPPERSTOP_RIDER_TEST_DATABASE_URL` to `shopperstop_rider` on `shopperstop_rider_test` at `localhost:5432`, and `deploy/initdb.sql` was applied to the job's Postgres before it

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
