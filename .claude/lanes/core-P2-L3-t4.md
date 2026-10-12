# core-P2-L3-t4 - admin products (tasks 4.1, 4.2 of core-catalog)
Status: done (task 4 of 6)
## Doing
Task 4 landed on `lane/core-P2-L3-catalog`: red tests, then the product routes, `openapi.json` entries and regenerated files, the tick and this log. Task 5 (image uploads) not started.
## Found
- Commits: `54f1786` test: admin products (red: every product route answered 404; TestAuthGates rows for the five routes), `296f477` feat: admin products (`products.go`, `Product` and `toProduct` in `catalog.go`, `mapErr` cases, five routes under `RequireAdmin`, `openapi.json`, `packages/ui/src/api/core.d.ts`, the Postman collection), `8dc7606` chore: tick tasks 4.1 4.2, then the lane log commit.
- Routes: `GET|POST /admin/products`, `GET|PATCH|DELETE /admin/products/{id}`. Operation ids `getAdminProducts`, `createAdminProduct`, `getAdminProduct`, `patchAdminProduct`, `deleteAdminProduct`; tag `admin-catalog`; examples on every response with content (400, 401, 403, 404, 409 where the design lists them).
- Handover names kept for L4: `catalog.Product` (single type with `isActive`, `imageUrl` from `imageURL`), `toProduct(db.Product)`, `db.Product`, the queries in `queries/catalog.sql` unchanged, `mapErr`, `pattern`, `checkCategoryID`-style uuid check (as `httpx.IsUUID`), schemas `Product`, `ProductList` (plus `ProductCreate`, `ProductPatch`). `mapErr` gained three cases: 23514 → `priceCents` "must be between 1 and mrpCents"; 23503 `products_category_id_fkey` → `categoryId` "unknown category"; everything else still `pg.Map`.
- `openapi.json` nit from task 3 folded in: `additionalProperties: false` dropped from `Category` (CategoryNode is an `allOf` over it). No `additionalProperties` added to the product schemas.
- Gates, all from the worktree root:
  - `GOFLAGS=-count=1 make test-core` exit 0, wall 49.6 s (with `-race`): cmd/core 3.1 s, cmd/core-admin 21.1 s, app 48.6 s, auth 10.9 s, blob 2.2 s, catalog 2.8 s, config 2.9 s, httpx 1.3 s, migrate 1.5 s, pg 3.4 s, seed 40.4 s. gofmt and go vet clean. `internal/app` alone with `-race -count=1` also ok (after the openapi edit, so `TestContract` and `TestContractSecurity` pass).
  - `make gen postman` exit 0; `git status --short` empty afterwards; the postman `node --test` suite 11 of 11. The collection maps `{id}` on the product routes to `{{productId}}`.
  - `openspec validate --all --strict`: 8 passed, 0 failed.
- 17 new product tests in `internal/app/catalog_products_test.go` (4.1 names), plus five `TestAuthGates` rows (anonymous 401, customer 401, store staff 403, admin past the gate).
- Judgement calls, for the manager to confirm:
  1. `categoryId` on create and patch accepts any existing category, a parent or a child (design Decision 6 checks existence only). The list filter includes children, so products can sit under a parent.
  2. A malformed `categoryId` on the list filter answers 400 `categoryId` "unknown category" (the design gives no message for the query form; it matches the body rule).
  3. `q` is trimmed; empty after trimming means no filter; over 100 characters is 400 `q`. `isActive` present with any value other than `true`/`false` (including empty) is 400 `isActive`.
  4. PATCH applies the price rule only through the database checks (23514), also when both amounts are in the body. The stored row is compared atomically; the answer is the same as a Go check would give.
  5. The product slug retry loop is a copy of `insertCategory`'s, not a shared helper: `categories.go` is outside this task's scope. Fold both into one helper in a later chore.
  6. `order_items_probe` is created `if not exists` in the app package's own test schema with `references products (id) on delete restrict`, a real foreign key (design Decision 4). It is dropped with the schema at package cleanup; nothing truncates `products` in that package. When core-P2-L5 adds `order_items`, its ordered-product test can replace the probe.
  7. POST documents 409 for a slug clash that three attempts did not resolve (`pg.Map` "already exists"); the design's route table lists 409 for POST, and this is the only way the route answers it.
- Deferred: none in task 4. Image routes (`PUT .../image`, `GET /files/...`) are task 5.
## Requests
- to core-P2-L4: unchanged from core-P2-L3.md (store-facing reads on the handover names; `store_stock` and `cart_items` cascade on products). `mapErr` now carries the product cases, so the store lane may reuse it.
- to core-P2-L5: unchanged; when `order_items` lands, `TestDeleteOrderedProductRefused` can drop the probe table and insert a real order line.
- to manager: nothing new beyond the judgement calls above; please confirm 1 and 6.
## Blockers
- none
