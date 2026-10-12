# core-P2-L3 - catalog (OpenSpec change core-catalog)
Status: started
## Doing
Change proposed and valid (`openspec validate core-catalog --strict`; `--all --strict` 6 passed). Waiting for L1 to merge and the manager to rebase this branch and launch task 1. Tasks 1 to 6 run in order.
## Found
- Change: `openspec/changes/core-catalog/` (proposal; specs `catalog` + `admin-catalog` ADDED, `platform` ADDED "Files directory is configured"; design; tasks). design.md holds migration `0004_catalog.sql`, the `sqlc.yaml` entry and `queries/catalog.sql` verbatim, spiked 2026-10-12 on a scratch copy of L1's tree (`6d870f1`) with sqlc v1.31.1 against `shopperstop_core_test`.
- Migration number: this lane owns `0004_catalog.sql`. L4 takes 0005.
- The store-facing reads (`GET /stores/{id}/categories`, `/stores/{id}/products`, `/stores/{id}/products/{slug}`) are NOT in this change: they need `store_stock` (L4) and `stores` (L2). design.md "Handover to core-P2-L4" has the draft requirement text and four spiked queries (`StoreCategories`, `StoreProducts`, `CountStoreProducts`, `StoreProductBySlug`) for `queries/catalog.sql`.
- Shapes for apps: `Category {id, name, slug, parentId?, sortOrder, imageUrl?}`, `CategoryNode` = Category + `children[]`, `GET /admin/categories` is `{items: CategoryNode[]}` (not paged); `Product {id, name, slug, description?, brand?, unitLabel, mrpCents, priceCents, categoryId, isActive, imageUrl?}`; `imageUrl` is the path `/api/core/v1/files/<kind>/<name>`, usable as `src` as is.
- Upload contract for admin: `PUT /admin/products/{id}/image` and `/admin/categories/{id}/image`, `multipart/form-data`, one part `file`, PNG/JPEG/WebP by content, 5 MiB; 400 field `file` otherwise; generated type is `{file: string}`, send a `FormData` through openapi-fetch's `bodySerializer`. Delete of an ordered product is 409 with message `product was ordered; set isActive to false instead`; category with products or children is 409 `category has products or subcategories`.
- `app.New` becomes `New(pool, origins, a, files blob.Store)`; `config.FilesDir` (`SHOPPERSTOP_CORE_FILES_DIR`) becomes required.
- Demo catalog ids: parents `...0501`-`...050c`, children `...0521`-`...0545`, products `...0601`-`...0694` (hex), product `...0601` `Banana Robusta` (Postman `productId`), `...0694` inactive. Demo images embedded from `internal/seed/images/` (not `data/seed-images/`: `.gitignore` ignores `services/*/data/`).
## Requests
- to core-P2-L4: write the store-facing reads from design.md "Handover to core-P2-L4" into `internal/catalog` and `queries/catalog.sql`; `store_stock.product_id` and `cart_items.product_id` reference `products (id) on delete cascade` (otherwise deleting a never-ordered product with stock answers the "ordered" 409); add your tables to `seed.Reset`'s truncate list.
- to core-P2-L5: `order_items.product_id ... references products (id) on delete restrict` (makes the delete rule real, no catalog code change); add the ordered-product delete test with a real order; include product `...0601` in a seeded past order so Postman's `DELETE /admin/products/{{productId}}` answers 409.
- to core-P2-L2: if you change `app.New` or `seed` too, the lane that rebases second keeps both; tags `catalog`, `admin-catalog` go after yours.
- to platform (via manager): `docs/postman/local.postman_environment.json` `productId` = `00000000-0000-4000-8000-000000000601` once this lands (D20).
## Blockers
- Task 1 needs core-accounts-auth (L1) on this branch: `sqlc.yaml`, `set_updated_at()`, `testdb.Migrated`, `pg`, `httpx` helpers, `RequireAdmin`.
