# Proposal

## Why
`services/core` does not exist, so nothing implements the `platform` capability (configuration, health, error envelope, body limits, CORS, request logging) that platform-P1-L3 seeds, and Phase 2's feature lanes have no router, migration runner or test database to build on. Plan tasks 5 to 8 (Spec 1 §3, §4, §11; Spec 2 §9, §10, §12, §13) close that gap in one module.

## What Changes
- New Go module `github.com/kapildev333/shopperstop/services/core` (Go 1.27; `go-chi/chi/v5`, `jackc/pgx/v5`, stdlib, `log/slog`).
- `internal/config`: environment into one struct, every problem named at once, origin list trimmed.
- `internal/httpx`: router with request id, request log by route pattern, panic recovery, CORS, JSON read and write with the 1 MiB limit and NUL rejection, the error envelope.
- `internal/migrate` and `migrations/`: own runner over embedded `NNNN_<name>.sql` files, one transaction per file.
- `internal/testdb`: one schema per test package on `shopperstop_core_test`.
- `internal/app`: route registration, `GET /api/core/v1/healthz` and `/readyz`, the shared test server, the contract test against `services/core/openapi.json`.
- `cmd/core` (serve with graceful shutdown) and `cmd/core-admin` with `migrate` and a placeholder `seed-demo [--reset]` that prints `seed-demo: no demo data yet` and exits 0, so platform's `make dev` and `make e2e` can call it now.
- `services/core/openapi.json`: OpenAPI 3.1 with the two health routes. Listing them, despite Spec 2 §6 calling them outside the contract, is PLAN.md D16.
- Spec deltas on `platform` for behaviour the seed lacks: origin normalisation, log level, migrations, the OpenAPI contract, graceful shutdown.

Area: core. Capabilities touched: `platform` (implements its six seeded requirements, adds five).

Out of scope: `internal/pg` (pool is `pgxpool.New`, transactions are `pgx.BeginFunc`; error mapping lands with the first query, Phase 2); `sqlc.yaml` and `queries/` (PLAN.md D3); demo data inside `seed-demo` and `create-admin`, auth, rate limiting, `SHOPPERSTOP_CORE_FILES_DIR` and every domain package (Phase 2); Makefile, CI and Postman (platform tasks 12 and 13).

## Capabilities

### New Capabilities
None. `platform` is created by platform-P1-L3 (`platform-seed-specs`).

### Modified Capabilities
- `platform`: ADDED requirements only: configured origins are normalised, log level is configurable, schema migrations apply once in order, a failed migration leaves no trace, the OpenAPI file matches the router, graceful shutdown.

## Impact
- Files: everything under `services/core/` (new), this change folder, `.claude/lanes/core-P1-L1.md`.
- Cross-area contracts produced: `services/core/openapi.json` (read by platform's `make postman` and by ui's `openapi-typescript` generation); the env variables `SHOPPERSTOP_CORE_DATABASE_URL`, `_ADDR`, `_SESSION_PEPPER`, `_WEB_ORIGINS`, `_LOG_LEVEL`, `_TEST_DATABASE_URL` (read by platform's Makefile and CI); the binaries `cmd/core` and `cmd/core-admin migrate|seed-demo [--reset]`.
- Cross-area contracts relied on: `deploy/initdb.sql` (platform-P1-L4: role `shopperstop_core` owning `shopperstop_core_test`, port 5432); the `platform` capability spec (platform-P1-L3).
- Dependencies: `github.com/go-chi/chi/v5`, `github.com/jackc/pgx/v5` and their transitive modules; nothing outside CLAUDE.md's list.
