# core-P4-L1-t1 - inStock and sort on a store's products (task 1 of core-catalog-filters-store-city)
Status: done (5b545e3 test, 3c2ea0c feat; reviewed: approve)
## Brief
- LANE-ID: core-P4-L1 (task 1 of 2). Area: core. Role: worker.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/core-P4-L1. Branch: lane/core-P4-L1-catalog-filters-store-city. Commit there; never push; never touch the root checkout.
- OpenSpec change: `openspec/changes/core-catalog-filters-store-city/`, task 1 in `tasks.md` (1.1, 1.2). Every code block you need is verbatim in `design.md` under "Task 1". A choice neither file settles: stop and report.
- Scope paths: `services/core/queries/catalog.sql` (`StoreProducts`, `CountStoreProducts` only), `services/core/internal/catalog/db/catalog.sql.go` (regenerated only), `services/core/internal/catalog/store.go`, `services/core/internal/app/catalog_store_test.go`, `services/core/openapi.json`, generated `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json`, `openspec/changes/core-catalog-filters-store-city/tasks.md` (ticks only), this file.
- Scenarios: catalog "Store products can be limited to those in stock" (In stock only, paged; No filter; Bad value) and "Store products can be sorted by price" (Cheapest first, ties by name; Dearest first, paged; Default order; Bad value).
- Failing tests to start from, `services/core/internal/app/catalog_store_test.go`: `TestStoreProductsInStockOnly` (red: total 4, inStock ignored), `TestStoreProductsSortByPrice` (red: name order), `TestStoreProductsBadInStockOrSort` (red: 200).
- Commits, in order: `test: in-stock filter and price sort on a store's products` (the test diff only, after you saw the three fail), then `feat: inStock and sort on GET /stores/{id}/products` (SQL, `make gen` output, `store.go`, `openapi.json` via the Task 1 script, regenerated `core.d.ts` and Postman collection, the 1.1 and 1.2 ticks). Author kapildev333 <47056817+kapildev333@users.noreply.github.com>, no attribution trailers.
- Gates (all must pass before the feat commit): from `services/core` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL=postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`: `gofmt -l .` empty, `go vet ./...`, `go test -race -count=1 ./...`. From the worktree root with `PATH=$HOME/.local/node-v22.23.3/bin:$PATH` (`node_modules` is installed; `npm ci` if missing): `make gen postman` then `git status --short` clean after the commit, `make test-web`, `openspec validate --all --strict`.
- Rules: tests only against the per-run schemas of `shopperstop_core_test`; no `docker`, no `make db`/`dev`/`seed`/`e2e`, no `core-admin migrate` or `seed-demo` against any database. Run the `openapi.json` script from a file in your scratchpad (not named after a stdlib module), never commit it.
## Doing
Task 1 done: test commit 5b545e3 (three red tests, seen failing), feat commit 3c2ea0c for SQL, store.go, sqlc, openapi.json, core.d.ts, Postman, ticks 1.1 and 1.2.
## Found
- Gates: gofmt empty; go vet clean; go test -race -count=1 ./... all ok (services/core); make gen postman ok (17 postman tests pass); make test-web exit 0; openspec validate --all --strict 20 passed.
## Requests
## Blockers
