## ADDED Requirements

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
