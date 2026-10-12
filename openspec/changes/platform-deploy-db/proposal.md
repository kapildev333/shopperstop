## Why

The core service needs a local PostgreSQL 16 with its own database, owner role and `_test` database before any core lane can run a migration or a Go test (Spec 1 §4, §7). Nothing in the repository starts a database yet.

## What Changes

- Add `deploy/docker-compose.yml`: compose project `shopperstop`, a `postgres` service (Postgres 16 on 5432, named volume, `initdb.sql` mounted into the entrypoint directory, `pg_isready` healthcheck) and a `caddy` service behind the `prod` profile.
- Add `deploy/initdb.sql`: role `shopperstop_core` and databases `shopperstop_core`, `shopperstop_core_test`, `shopperstop_core_e2e`, all owned by that role. CI runs the same file against its Postgres service.
- Add `deploy/Caddyfile`: `/api/core/*` to the core process on 8080, `/admin/*` to the admin build, everything else to the web build (prod profile only; dev uses Vite proxies).
- Add the first `Makefile` with only the `db` target (`docker compose ... up -d --wait postgres`). Plan Task 13 adds the other targets later.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform`: adds the local database requirements (one database, owner role and `_test` database per service; `make db` starts Postgres and waits for health; Caddy only under the `prod` profile). Disjoint from the requirements lane platform-P1-L3 seeds (Configuration fails fast, Health endpoints, Error envelope, Request body limits, CORS, Request logging).

## Impact

- Area: platform. Files: `deploy/docker-compose.yml`, `deploy/initdb.sql`, `deploy/Caddyfile`, `Makefile`.
- Cross-area contracts relied on: none consumed. Produced for core: database names `shopperstop_core`, `shopperstop_core_test`, `shopperstop_core_e2e`, role and password `shopperstop_core` on `localhost:5432`, container `shopperstop-postgres-1`. Caddy relies on `apps/web/dist` and `apps/admin/dist` existing only when the `prod` profile is started.
- Out of scope: every other Makefile target (Task 13), CI's Postgres service (Task 12), env files, scripts, Caddy TLS, later services' roles and databases (each later service adds its own lines to `initdb.sql`).
