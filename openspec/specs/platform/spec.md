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
