# Proposal

## Why
Nothing can be sold until the catalog exists: carts, stock and orders all point at products, and the customer site and the admin panel need categories, products and their images. This change, core-P2-L3 (Spec 2 §3, §5, §6, §9, §10, §11, §13), adds the catalog schema, the admin routes that manage it, image storage on disk and the public image route, the customer-facing catalog reads without stock, and the demo catalog in `seed-demo` (D22).

## What Changes
- Migration `0004_catalog.sql`: `categories` (two levels: `parent_id` nullable, `sort_order`, unique `slug`, `image_key`) and `products` (`category_id`, `name`, unique `slug`, `description`, `brand`, `unit_label`, `mrp_cents`, `price_cents` with `0 < price_cents <= mrp_cents`, `is_active`, `image_key`). Deleting a category with products or children, or a product that a restricting row refers to, is refused by foreign keys.
- `queries/catalog.sql` with generated code in `internal/catalog/db` (sqlc v1.31.1).
- `internal/blob`: one `Store` interface (put, open) and a disk implementation under `SHOPPERSTOP_CORE_FILES_DIR`, so S3 is a later package.
- `internal/config` reads `SHOPPERSTOP_CORE_FILES_DIR` (required).
- `internal/catalog`: slugs derived server-side from the name on create and never changed on rename; admin handlers for categories, products and image uploads; the public file handler.
- Routes under `/api/core/v1`, admin only: `GET|POST /admin/categories`, `PATCH|DELETE /admin/categories/{id}`, `PUT /admin/categories/{id}/image`, `GET|POST /admin/products`, `GET|PATCH|DELETE /admin/products/{id}`, `PUT /admin/products/{id}/image`. Public: `GET /files/{kind}/{name}`, `GET /stores/{id}/categories` (the tree), `GET /stores/{id}/products` (active products, `q`, `categoryId` with children, paged 24 / max 100, by name), `GET /stores/{id}/products/{slug}`.
- Image upload: multipart field `file`, PNG, JPEG or WebP by content, at most 5 MiB, request body at most 16 MiB, stored as `<kind>/<id>.<ext>`.
- `core-admin seed-demo [--reset]` adds 12 parent categories with 2 to 4 children each, 148 products with fixed ids, and 12 committed placeholder images written to the files directory (D20, D22).
- `openapi.json`: tags `catalog` and `admin-catalog`, `security` on every admin operation, a multipart request schema on the image routes, examples and every error code; `packages/ui/src/api/core.d.ts` and the Postman collection regenerated (D19, D23).

Split with core-P2-L4 (`core-stock-cart`, already proposed on that basis): this change ships the three store-facing reads with their shape, search, paging, ordering and the unknown-store 404, but without stock. `inStock`, `quantity` (capped at 10) and "a category is listed only when it or a child has an active product in stock at that store" need `store_stock` (L4's migration 0005, which sqlc cannot see from here); L4's `catalog` delta adds them as ADDED requirements on top of these routes. Until L4 lands, the store tree lists every category and products carry no stock fields. The unknown-store 404 uses core-P2-L2's `store.Get`, so the last task waits for `core-stores-serviceability` on main. Also out of scope: product variants, search ranking, image resizing, deleting stored files, re-parenting a category, the real "ordered product" check (core-P2-L5 adds `order_items`; this change already answers 409 for any restricting reference).

Area: core.

## Capabilities

### New Capabilities
- `catalog`: what customers read: the store's category tree, product list and product by slug, catalog images served to anyone, the image URL every category and product carries, and the demo catalog. core-P2-L4 adds stock to it.
- `admin-catalog`: admin management of categories, products and their images: the tree, create, edit, delete rules, slugs, price rules, search and filters, uploads.

### Modified Capabilities
- `platform`: ADDED requirement: the files directory is required configuration.

## Impact
- Files: `services/core/` (`migrations/0004_catalog.sql`, `sqlc.yaml`, `queries/catalog.sql`, `internal/catalog/`, `internal/catalog/db/`, `internal/blob/`, `internal/config/`, `internal/seed/`, `internal/app/`, `cmd/core/main.go`, `cmd/core-admin/main.go`, `openapi.json`), `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json` (generated, D19, D23), this change folder, `.claude/lanes/core-P2-L3.md`.
- Cross-area contracts produced: `openapi.json` (admin catalog routes, the store-facing reads and the file route, read by ui's generated types, admin's and web's catalog pages and Postman); the `Category`, `CategoryNode`, `Product` (customer) and `AdminProduct` shapes and `imageUrl`; the fixed demo catalog ids (`productId` `00000000-0000-4000-8000-000000000601` for Postman's environment).
- Cross-area contracts relied on: core-stores-serviceability (L2): `store.Get` for the unknown-store 404; core-accounts-auth (L1): `RequireAdmin`, `httpx.ReadPatch`/`Page`/`NewList`/`PathID`, `pg.Map`/`IsUnique`, `testdb.Migrated`, `sqlc.yaml`, the seed's `Reset`/`Load`, the route-test fixtures and `TestAuthGates`; the Makefile's `SHOPPERSTOP_CORE_FILES_DIR` (already set for `make dev`, `make seed` and `make e2e`).
- Dependencies: none new (stdlib `mime/multipart`, `net/http` content sniffing, `image/png` only in tests, `embed`).
