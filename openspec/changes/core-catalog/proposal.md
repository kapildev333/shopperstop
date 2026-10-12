# Proposal

## Why
Nothing can be sold until the catalog exists: carts, stock and orders all point at products, and the customer site and the admin panel need categories, products and their images. This change, core-P2-L3 (Spec 2 §3, §5, §6, §9, §10, §11, §13), adds the catalog schema, the admin routes that manage it, image storage on disk and the public image route, and the demo catalog in `seed-demo` (D22).

## What Changes
- Migration `0004_catalog.sql`: `categories` (two levels: `parent_id` nullable, `sort_order`, unique `slug`, `image_key`) and `products` (`category_id`, `name`, unique `slug`, `description`, `brand`, `unit_label`, `mrp_cents`, `price_cents` with `0 < price_cents <= mrp_cents`, `is_active`, `image_key`). Deleting a category with products or children, or a product that a restricting row refers to, is refused by foreign keys.
- `queries/catalog.sql` with generated code in `internal/catalog/db` (sqlc v1.31.1).
- `internal/blob`: one `Store` interface (put, open) and a disk implementation under `SHOPPERSTOP_CORE_FILES_DIR`, so S3 is a later package.
- `internal/config` reads `SHOPPERSTOP_CORE_FILES_DIR` (required).
- `internal/catalog`: slugs derived server-side from the name on create and never changed on rename; admin handlers for categories, products and image uploads; the public file handler.
- Routes under `/api/core/v1`, admin only: `GET|POST /admin/categories`, `PATCH|DELETE /admin/categories/{id}`, `PUT /admin/categories/{id}/image`, `GET|POST /admin/products`, `GET|PATCH|DELETE /admin/products/{id}`, `PUT /admin/products/{id}/image`. Public: `GET /files/{kind}/{name}`.
- Image upload: multipart field `file`, PNG, JPEG or WebP by content, at most 5 MiB, request body at most 16 MiB, stored as `<kind>/<id>.<ext>`.
- `core-admin seed-demo [--reset]` adds 12 parent categories with 2 to 4 children each, 148 products with fixed ids, and 12 committed placeholder images written to the files directory (D20, D22).
- `openapi.json`: tags `catalog` and `admin-catalog`, `security` on every admin operation, a multipart request schema on the image routes, examples and every error code; `packages/ui/src/api/core.d.ts` and the Postman collection regenerated (D19, D23).

Not in this change, and why: the store-facing reads `GET /stores/{id}/categories`, `GET /stores/{id}/products`, `GET /stores/{id}/products/{slug}` move to core-P2-L4 (`core-stock-cart`). Each of them depends on `store_stock` (migration 0005, L4) for `inStock`, `quantity` and the "has an active in-stock product" filter, and on `stores` (migration 0003, L2) for the unknown-store 404; sqlc cannot compile a query over a table that does not exist yet, and a stub with every product out of stock would be rewritten and retested in L4. design.md hands L4 the requirement text and the queries, built on this change's filters. Also out of scope: product variants, search ranking, image resizing, deleting stored files, re-parenting a category, the real "ordered product" check (core-P2-L5 adds `order_items`; this change already answers 409 for any restricting reference).

Area: core.

## Capabilities

### New Capabilities
- `catalog`: catalog images served to anyone, the image URL every category and product carries, and the demo catalog. core-P2-L4 adds the store-facing category and product reads to it.
- `admin-catalog`: admin management of categories, products and their images: the tree, create, edit, delete rules, slugs, price rules, search and filters, uploads.

### Modified Capabilities
- `platform`: ADDED requirement: the files directory is required configuration.

## Impact
- Files: `services/core/` (`migrations/0004_catalog.sql`, `sqlc.yaml`, `queries/catalog.sql`, `internal/catalog/`, `internal/catalog/db/`, `internal/blob/`, `internal/config/`, `internal/seed/`, `internal/app/`, `cmd/core/main.go`, `cmd/core-admin/main.go`, `openapi.json`), `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json` (generated, D19, D23), this change folder, `.claude/lanes/core-P2-L3.md`.
- Cross-area contracts produced: `openapi.json` (admin catalog routes and the file route, read by ui's generated types, admin's catalog pages and Postman); the `Category`, `CategoryNode`, `Product` shapes and `imageUrl`; the fixed demo catalog ids (`productId` `00000000-0000-4000-8000-000000000601` for Postman's environment).
- Cross-area contracts relied on: core-accounts-auth (L1): `RequireAdmin`, `httpx.ReadPatch`/`Page`/`NewList`/`PathID`, `pg.Map`/`IsUnique`, `testdb.Migrated`, `sqlc.yaml`, the seed's `Reset`/`Load`, the route-test fixtures and `TestAuthGates`; the Makefile's `SHOPPERSTOP_CORE_FILES_DIR` (already set for `make dev`, `make seed` and `make e2e`).
- Dependencies: none new (stdlib `mime/multipart`, `net/http` content sniffing, `image/png` only in tests, `embed`).
