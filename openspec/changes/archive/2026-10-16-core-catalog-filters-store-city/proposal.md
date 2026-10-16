## Why

The customer mobile app's home and listing screens (design canvas, Phase 4, D36) filter a store's products to what is in stock, sort them by price, and show the store's city in the header ("560034, Bengaluru"). Mobile's contract audit found none of the three in `services/core/openapi.json`; the orchestrator relayed the request to core (PLAN.md D44). Doing the filter and the sort in Go would break paging and `total`, so both belong in the store product query.

## What Changes

- `GET /api/core/v1/stores/{id}/products` gains two optional query parameters, applied in SQL so paging and `total` stay correct, and combined with `q`, `categoryId`, `page` and `pageSize`:
  - `inStock`: `true` keeps only products whose quantity at that store is above 0; `false`, empty or absent means no filter (the staff stock list's `lowStock` rule); anything else is 400 `validation` field `inStock`.
  - `sort`: `price_asc` or `price_desc` orders by `priceCents`, equal prices by name, then id; empty or absent keeps the order by name, then id; anything else is 400 `validation` field `sort`.
- Migration 0009: `stores.city text not null default ''`. `''` means the store has no city.
- `Store` and `AdminStore` gain `city`, omitted when the store has none (CLAUDE.md: optional = omitted). It is on `GET /serviceability`, `GET /stores/{id}` and every admin store read.
- `POST /api/core/v1/admin/stores` accepts an optional `city` (absent: none); `PATCH /admin/stores/{id}` accepts `city` (absent: unchanged; `""` clears it). `city` is trimmed and at most 100 characters; a longer one, or `null`, is 400 `validation` field `city`.
- `core-admin seed-demo` writes city `Bengaluru` on both demo stores.
- Contract: `openapi.json` (two parameters, the 400 text, `city` on `Store`, `AdminStore`, `StoreCreate`, `StorePatch`, every store example); regenerated `packages/ui/src/api/core.d.ts` (D19), `docs/postman/shopperstop-core.postman_collection.json` (D23) and every `internal/*/db/models.go` (sqlc, shared schema).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog`: MODIFIED "Store products are listed and searched" (order by name unless `sort`; the `inStock` filter); ADDED "Store products can be limited to those in stock", "Store products can be sorted by price".
- `serviceability`: MODIFIED "Public store view" (`city` when the store has one).
- `admin-stores`: MODIFIED "Admins list and read stores", "Admins create stores", "Store fields are validated", "Admins change stores", "Demo stores".

## Impact

- Area: `core`. Files under `services/core/`: `migrations/0009_store_city.sql` (new), `queries/catalog.sql` (`StoreProducts`, `CountStoreProducts`), `queries/store.sql` (`CreateStore`, `UpdateStore`), sqlc output, `internal/catalog/store.go`, `internal/store/store.go`, `internal/store/handlers.go`, `internal/seed/seed.go`, tests in `internal/app` (`catalog_store_test.go`, `admin_stores_test.go`, `stores_test.go`) and `internal/seed/seed_test.go`, `openapi.json`. Generated: `packages/ui/src/api/core.d.ts`, the Postman collection.
- Contracts relied on: `services/core/openapi.json` (core to the apps and to the rider service).
- Cross-area: `StoreCreate.city` (optional) widens `keyof StoreCreate`, which `apps/admin/src/store-form.tsx` uses as `Record<keyof StoreCreate, string>`; `tsc` then fails with TS2741 there (spiked). A one-line admin change typechecks against both the current and the new `core.d.ts` and must reach main before Task 2 merges (design.md "Cross-area"). Web, rider, mobile and `packages/ui` typecheck unchanged (spiked): `city` is optional in every response schema. The rider service reads no store JSON today (only `/admin/stores/{id}/orders` and order routes); an extra member would not break its decoder anyway.
- No new dependency, no new route.
- Out of scope: the admin panel's city field (an admin follow-up lane); the mobile screens using the new parameters and field; sorting by anything but name and price; a product index for the price sort; making `city` required.
