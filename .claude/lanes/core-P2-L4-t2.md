# core-P2-L4-t2 - store products, by slug and products by id (task 2 of 6)
Status: done
## Doing
Tasks 2.1 and 2.2 ticked. Commits: 3ffa422 `test: store products with stock, by slug, by id`, fb16d9b `feat: store-facing product routes and catalog.ProductsByID`, then `chore: tick tasks 2.1 2.2`. Done.
## Found
- Red first: `TestStoreProductsCarryStock` and the rest answered 404 (routes absent); `TestProductsByIDIncludesInactive` failed to build (`ProductsByID` undefined). Both committed before any behaviour.
- Queries `StoreProducts`, `CountStoreProducts`, `StoreProductBySlug`, `StoreProductsByID` appended verbatim to `queries/catalog.sql`; `sqlc generate` (v1.31.1) touched only `internal/catalog/db/catalog.sql.go` (models unchanged). `StoreCategories` is task 3, not here.
- Handlers are package functions taking the pool (design Decision 14, as `store` does): `catalog.StoreProducts(pool)`, `catalog.StoreProductBySlug(pool)`, `catalog.ProductsByID(ctx, d db.DBTX, storeID, ids)`. `Catalog` and `New` are unchanged: no `pool` field added.
- `StoreProduct` (`internal/catalog/store.go`): `Product` fields minus `isActive`, plus `inStock` and `quantity` (min(stock, 10), 0 when inactive or no row); `Active bool json:"-"` for the cart. Every store route checks the store first with `store.Get` (404 `not_found`), since the product queries left-join stock and would otherwise answer an unknown store with an empty list.
- Slug route reads the path with `chi.URLParam(r, "slug")` (no format check, per design); `pg.Map` turns no rows into 404.
- Query parsing for the store list is `storeFilters` in `store.go`: the admin `productFilters` in `products.go` also reads `isActive`, which store routes must not accept. The `q` and `categoryId` rules are copied, not shared (scope was `store.go` only); a later cleanup could extract a shared helper from `productFilters`.
- Reused L3's `pattern`, `checkCategoryID`, `toProduct`, `imageURL`, `invalid`; `httpx.PathID`, `httpx.Page`, `httpx.NewList`.
- `openapi.json`: operations `getStoreProducts` and `getStoreProduct` under tag `catalog` (no `security`), schemas `StoreProduct` and `StoreProductList` after `Serviceability`; examples on every response (200, 400 on the list, 404). The tag `catalog` description was updated to name the store products; task 3 may extend it with categories.
- `make gen postman` regenerated `packages/ui/src/api/core.d.ts` and the Postman collection, both committed in the feat commit. The generator maps only `id` variables to `{{storeId}}`, so `:slug` keeps the example `banana-robusta` (checked in the collection); L3's concern about `{slug}` being mapped to `productId` does not apply.
- Extra test beyond the brief's list: `TestStoreProductsBadParams` (q over 100 runes 400 `q`; categoryId not a uuid 400 `categoryId`) and a paging test `TestStoreProductsPaging`, both from design Decision 14 and the spec's paging rule.
- Tasks: the brief asks for the tick as its own `chore:` commit; tasks.md's preamble says the worker ticks in the `feat` commit. I followed the brief; the reviewer may prefer the other order.
## Gates
- `GOFLAGS=-count=1 make test-core` passed (gofmt, go vet, `go test -race`): cmd/core 1.5s, cmd/core-admin 17.1s, app 54.3s, auth 9.8s, blob 1.5s, catalog 2.3s, config 2.3s, httpx 1.9s, migrate 2.8s, pg 2.7s, seed 23.1s, stock 2.2s, store 1.8s.
- `make gen postman`: postman tests 11 of 11 pass; `git status --short` empty after regeneration (only the feature files were modified and committed).
- `openspec validate --all --strict`: 12 passed, 0 failed.
- Contract test (`TestContract`) passes with the two new operations documented.
## Requests
- none
## Blockers
- none
