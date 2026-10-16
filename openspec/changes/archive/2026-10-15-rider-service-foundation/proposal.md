## Why

Phase 3 adds the rider service (PLAN.md D29 to D32). Before riders can claim and deliver orders (rider-P3-L2) or use the rider app (rider-P3-L3), the service needs to exist in the shape of core: its own Go module and database, config, HTTP plumbing, migrations, rider accounts with bearer sessions, staff management of riders through core's staff sessions, a demo seed and an `openapi.json` contract. This change builds that foundation and seeds the capability `rider-service`.

## What Changes

- New Go module `github.com/kapildev333/shopperstop/services/rider` (Go 1.27, chi, pgx, x/crypto, sqlc output): `cmd/rider` (serves `/api/rider/v1` on `SHOPPERSTOP_RIDER_ADDR`), `cmd/rider-admin` (`migrate`, `seed-demo [--reset]`, `create-rider <email> --store <id>`), `migrations/` `0001_init.sql` and `0002_riders.sql`, `queries/`, `sqlc.yaml`, `openapi.json`.
- Config from `SHOPPERSTOP_RIDER_*`, failing fast with every problem named.
- `internal/httpx`, `internal/pg`, `internal/migrate`, `internal/testdb` and the limiter and password parts of `internal/auth` copied from core (D31), origin commit in design.md.
- Rider accounts: `riders` and `sessions` tables; `POST /auth/sign-in`, `POST /auth/sign-out`, `GET /me`; 30-day sliding peppered sessions; sign-in rate limit.
- `internal/core`: a typed client of core. In this change: `StaffFromToken` (forwards a staff bearer to core `GET /api/core/v1/admin/me`, 30 s cache per token hash) and `Store` (core's public `GET /api/core/v1/stores/{id}`). `internal/coretest`: an `httptest.Server` fake of those core routes for the suites.
- Staff routes, authenticated through core: `GET|POST /admin/riders`, `GET|PATCH /admin/riders/{id}`; admins see every store, store staff their own.
- `GET /healthz`, `GET /readyz` (database ping) in the contract (D16).
- Demo seed: four riders with fixed ids `...0801` to `...0804`, no call to core; a test ties the Postman `riderId` to the seed.
- `openapi.json` with the contract and security tests adapted from core; the generated `docs/postman/shopperstop-rider.postman_collection.json` (platform's request).

## Capabilities

### New Capabilities

- `rider-service`: the rider service's runtime (config, health, HTTP conventions, migrations), rider accounts and sessions, staff management of riders through core, the operator commands and demo seed, and its API contract.

### Modified Capabilities

None.

## Impact

- Area: rider. Files: everything under `services/rider/` (new), this change folder, and one generated cross-area file, `docs/postman/shopperstop-rider.postman_collection.json`, written by `make postman` in the same PR as `openapi.json` (platform-P3-L1's request, like D19 for `core.d.ts`).
- Cross-area contracts relied on: core's `services/core/openapi.json` for `GET /api/core/v1/admin/me` (`Staff`: `id`, `email`, `name`, `role` `admin|store_staff`, `storeId` for store staff, `isActive`; 401 for anything but a live staff session) and `GET /api/core/v1/stores/{id}` (public `Store`, 404 for an unknown id). Both exist on main today; nothing here waits for core-P3-L1. Platform's Makefile (`RIDER_ENV`, `E2E_ENV`, `test-rider`, `seed`, `gen`, `postman`), `deploy/initdb.sql` (rider role and databases) and `scripts/postman.mjs` (rider collection, `riderToken`, `staffToken`, `riderId`).
- Not touched: `packages/ui/src/api/rider.d.ts` (ui-P3-L2 creates the generator first; until then no rider lane commits it).
- Out of scope: deliveries, ready orders, location, the customer read and every core call they need (`StoreOrders`, `Order`, `ChangeStatus`, `CustomerFromToken`: rider-P3-L2); the rider app (rider-P3-L3); moving a rider to another store; password reset; a shared Go module with core (D31).
