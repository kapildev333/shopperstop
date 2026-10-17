## Why

Rider dispatch (PLAN.md D57) ranks online riders by their straight-line ETA to the store, so the rider service needs each store's coordinates. Core's `stores` hold an address line and a pincode, no coordinates. The admin store form (admin-P5-L2) sets them; the rider service reads them from the store it already fetches from core.

## What Changes

- Migration 0012: `stores.lat` and `stores.lng`, nullable `double precision`, checked to -90..90 and -180..180, and a table check that both are null or both set.
- `Store` and `AdminStore` gain an optional `location` `{lat, lng}`, omitted when the store has none (never `null`), on every store read: `GET /serviceability`, `GET /stores/{id}` and every admin store route.
- `POST /api/core/v1/admin/stores` and `PATCH /admin/stores/{id}` accept an optional `location` with both members. Absent: none on create, unchanged on change. 400 `validation` field `location.lat` or `location.lng` for an out-of-range coordinate, field `location` for a missing coordinate or a `null` location. A location can be replaced, not cleared.
- `core-admin seed-demo` writes Koramangala at 12.9352, 77.6245 and Indiranagar at 12.9719, 77.6412.
- Contract: `openapi.json` (new schema `StoreLocation`, `location` on `Store`, `AdminStore`, `StoreCreate`, `StorePatch`, every store example, the create and change descriptions and 400 texts); regenerated `packages/ui/src/api/core.d.ts` (D19), `docs/postman/shopperstop-core.postman_collection.json` (D23) and every `internal/*/db/models.go` (sqlc, shared schema).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `serviceability`: MODIFIED "Public store view" (`location` when the store has one).
- `admin-stores`: MODIFIED "Admins list and read stores", "Admins create stores", "Demo stores"; ADDED "Store locations" (range, both or neither, set, keep, no clear).

## Impact

- Area: `core`. Files under `services/core/`: `migrations/0012_store_location.sql` (new), `queries/store.sql` (`CreateStore`, `UpdateStore`), sqlc output, `internal/store/store.go`, `internal/store/handlers.go`, `internal/seed/seed.go`, tests in `internal/app` (`admin_stores_test.go`, `stores_test.go`) and `internal/seed/seed_test.go`, `openapi.json`. Generated: `packages/ui/src/api/core.d.ts`, the Postman collection.
- Contracts relied on: `services/core/openapi.json` (core to the apps and to the rider service).
- Cross-area: `StoreCreate.location` widens `keyof StoreCreate`, which `apps/admin/src/store-form.tsx` uses as `Record<Field, string>`; `tsc` then fails with TS2741 there (spiked). A one-line admin change typechecks against both the current and the new `core.d.ts` and must reach main before this change merges (design.md "Cross-area"). Web, rider app, mobile and `packages/ui` typecheck unchanged (spiked): `location` is optional in every schema. The rider service decodes core's store without `DisallowUnknownFields`, so the extra member is harmless until rider-P5-L2 reads it.
- No new dependency, no new route.
- Out of scope: the admin form's latitude and longitude inputs (admin-P5-L2); dispatch itself (rider-P5-L2); clearing a location; geocoding an address; coordinates on customer addresses; PostGIS or any spatial index.
