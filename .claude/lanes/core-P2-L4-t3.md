# core-P2-L4-t3 - store categories (task 3 of 6)
Status: done
## Doing
Tasks 3.1 and 3.2 ticked. Commits: 8eca6dd `test: store categories need an active product in stock; stock is per store; search escapes`, 9cdd0c3 `feat: store categories route`, then `chore: tick tasks 3.1 3.2` with this log. Done.
## Found
- `StoreCategories` was not in `queries/catalog.sql` (task 2 appended four). Appended verbatim from design.md, `sqlc generate` (v1.31.1) touched only `internal/catalog/db/catalog.sql.go` (returns `[]db.Category`; models unchanged).
- Handler `catalog.StoreCategories(pool)` in `internal/catalog/store.go`: `httpx.PathID` → `store.Get` (404 `not_found`) → query → `CategoryTree{Items: tree(rows)}` with L3's `tree`. A child that qualifies always has its parent qualifying too (the parent's clause covers its children), so `tree` never drops a listed child.
- Route `GET /api/core/v1/stores/{id}/categories` registered in `app.New`, public, next to the products routes.
- `openapi.json`: operation `getStoreCategories`, tag `catalog`, no `security`, parameter `id`, 200 `CategoryTree` with example, 404 example. Tag `catalog` description now names the category tree. `make gen postman` regenerated `core.d.ts` (+84) and the Postman collection (+144); both in the feat commit.
- Red run: the three category tests returned 404 on the unregistered route. `TestStoreCategoriesUnknownStore` passes at red for that same reason (the 404 comes from the missing route); it is a real contract test once the route exists. The two review rows (`TestStoreProductsStockIsPerStore`, `TestStoreProductsSearchEscapesAndMatchesBrand`) pass at red: they pin task 2 behaviour, so they are regression rows, not new behaviour.
- Extra test beyond 3.1's list: `TestStoreCategoriesStockAtOtherStoreDoesNotCount` (spec scenario "stock at another store does not count").
- `catalog_store_test.go` gained the `strings` import; helpers `storeCategories` and `findParent` are local to that file.
## Gates
- `GOFLAGS=-count=1 make test-core`: exit 0 (gofmt, `go vet`, `go test -race`): cmd/core 1.54s, cmd/core-admin 16.3s, app 53.1s, auth 9.7s, blob 2.8s, catalog 2.7s, config 1.5s, httpx 1.7s, migrate 2.0s, pg 2.5s, seed 22.5s, stock 2.0s, store 1.9s. All ok.
- `make gen postman`: exit 0, postman tests 11 of 11 pass; `git status --short` empty after regeneration.
- `openspec validate --all --strict`: 12 passed, 0 failed.
## Requests
- none
## Blockers
- none
