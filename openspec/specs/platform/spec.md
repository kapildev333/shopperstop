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
Every error response SHALL be JSON `{"error":{"code","message","field"?}}` with `code` one of `validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `out_of_stock`, `not_serviceable`, `rate_limited`, `internal`.

#### Scenario: Unknown route
- **WHEN** a client requests a path the router does not serve
- **THEN** the response is 404 with code `not_found`

#### Scenario: Panic in a handler
- **WHEN** a handler panics
- **THEN** the response is 500 with code `internal` and the panic is logged with the request id

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

The local Postgres SHALL be initialised from `deploy/initdb.sql`, which creates for each service a login role named `shopperstop_<service>` and the databases `shopperstop_<service>`, `shopperstop_<service>_test` and `shopperstop_<service>_e2e`, all owned by that role. No role SHALL own another service's database.

#### Scenario: Core role reaches its test database
- **WHEN** Postgres has been initialised from `deploy/initdb.sql` and a client connects to `localhost:5432` as `shopperstop_core` with password `shopperstop_core` to database `shopperstop_core_test`
- **THEN** `select 1` returns `1`

#### Scenario: Core owns all three of its databases
- **WHEN** `select datname from pg_database where pg_get_userbyid(datdba) = 'shopperstop_core'` runs on the initialised Postgres
- **THEN** it returns exactly `shopperstop_core`, `shopperstop_core_test` and `shopperstop_core_e2e`

### Requirement: make db starts Postgres and waits for health

`make db` SHALL start only the `postgres` service of `deploy/docker-compose.yml` in compose project `shopperstop`, detached, and return only after the service's `pg_isready` healthcheck passes, so that the container is named `shopperstop-postgres-1` and listens on port 5432.

#### Scenario: make db brings up a healthy container
- **WHEN** `make db` runs on a machine with Docker running and port 5432 free
- **THEN** it exits 0 only after the healthcheck passes, and `docker ps` lists `shopperstop-postgres-1`

#### Scenario: make db names the compose file and service
- **WHEN** `make -n db` runs from the repository root
- **THEN** it prints `docker compose -f <repo>/deploy/docker-compose.yml up -d --wait postgres`

### Requirement: Caddy runs only under the prod profile

The `caddy` service in `deploy/docker-compose.yml` SHALL belong to the `prod` profile, so `make db` never starts it; under that profile `deploy/Caddyfile` SHALL route `/api/core/*` to the core process on port 8080, `/admin/*` to the admin build with the prefix stripped and SPA fallback to `index.html`, and every other path to the web build with SPA fallback.

#### Scenario: make db leaves Caddy stopped
- **WHEN** `make db` has completed
- **THEN** `docker ps` lists no Caddy container for project `shopperstop`

#### Scenario: Caddyfile routes the three prefixes
- **WHEN** `deploy/Caddyfile` is read
- **THEN** it has a `handle /api/core/*` block with `reverse_proxy host.docker.internal:8080`, a `handle /admin/*` block with `uri strip_prefix /admin` and `try_files {path} /index.html` rooted at `/srv/admin`, and a catch-all `handle` rooted at `/srv/web` with the same `try_files`

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
