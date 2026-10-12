# Proposal

## Why
A customer's first question is "do you deliver to my pincode?", and every later core feature (catalog, stock, cart, orders) is per store. `services/core` has accounts after `core-accounts-auth` but no stores. This change, core-P2-L2 (Spec 2 §3, §5, §6, §11, §13), adds stores, the pincodes each one serves, the public serviceability lookup, the admin routes that run stores and their pincode lists, and the next slice of the demo seed (D22).

## What Changes
- Migration `0003_stores.sql`: tables `stores` and `store_service_areas` (one store per pincode, cascade on store delete); `staff_users.store_id` gains its foreign key to `stores` (requested by core-P2-L1).
- `queries/store.sql` with sqlc output in `internal/store/db`; `sqlc.yaml` gains its third block.
- `internal/store`: the Go API later lanes call (`Get`, `ForPincode`) and the handlers below.
- Public routes under `/api/core/v1`: `GET /serviceability?pincode=` (`{store}`, 404 `not_serviceable`, a closed store is 200 with `isOpen` false), `GET /stores/{id}` (public fields only).
- Admin routes, admins only (store staff get 403 whatever the id): `GET|POST /admin/stores`, `GET|PATCH|DELETE /admin/stores/{id}` (delete refused with 409 while staff users reference the store; orders join that rule when core-P2-L5 adds them), `GET|PUT /admin/stores/{id}/service-areas` (PUT replaces the list; a pincode served by another store is 409 `conflict` naming that store).
- Staff-user create answers an unknown `storeId` with 400 `validation` field `storeId` instead of the generic 409 (core-P2-L1 request).
- `core-admin seed-demo --reset` adds the stores Koramangala (`560034`, `560095`) and Indiranagar (`560038`, `560008`) and their store-staff users, all with fixed ids.
- `openapi.json`: tags `serviceability` and `admin-stores`, every new operation with schemas, examples, `security` on the admin ones and every error it returns; `packages/ui/src/api/core.d.ts` regenerated (D19).

Area: core. Capabilities: `serviceability` (new), `admin-stores` (new), `admin-staff` (ADDED requirements on the capability core-P2-L1 creates).

Out of scope: store slugs and coordinates (`slug`, `lat`, `lng` in Spec 2 §3: no route or page uses them; see design Decision 2); radius serviceability and several stores per pincode (Spec 2 §14); store opening hours (Spec 2 has only the `isOpen` switch); the dashboard, stock, cart and orders (core-P2-L4, L5); the 409 for a store with orders (core-P2-L5 adds the `orders.store_id` foreign key, which the delete already maps).

## Capabilities

### New Capabilities
- `serviceability`: pincode to store lookup and the public view of a store.
- `admin-stores`: admin management of stores and the pincodes each store serves, and the demo stores.

### Modified Capabilities
- `admin-staff` (created by `core-accounts-auth`, ADDED requirements only): a store-staff user's store must exist; the two demo store-staff users.

## Impact
- Files: `services/core/` (`migrations/0003_stores.sql`, `sqlc.yaml`, `queries/store.sql`, `internal/store/**`, `internal/app/`, `internal/auth/staff.go` (one error mapping), `internal/seed/`, test fixtures in `internal/auth` and `internal/app` that insert store staff, `openapi.json`), `packages/ui/src/api/core.d.ts` (generated, D19), this change folder, `.claude/lanes/core-P2-L2.md`.
- Cross-area contracts produced: `openapi.json` operations and schemas `Store`, `AdminStore`, `StoreCreate`, `StorePatch`, `StoreList`, `Serviceability`, `ServiceAreas`, `PincodeConflict`; the fixed demo store ids for Postman's `storeId` and the e2e suites.
- Cross-area contracts relied on: `core-accounts-auth` (merged first): `pg.Map`, `testdb.Migrated`, `httpx.ReadPatch`, `httpx.Page`, `httpx.NewList`, `httpx.PathID`, `auth.RequireAdmin`, `app.New(pool, origins, a)`, `seed.Reset`/`Load`, the contract test with its security check; `scripts/postman.mjs` maps a path id after `stores` to `{{storeId}}`.
- Dependencies: none new.
