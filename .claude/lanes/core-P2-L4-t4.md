# core-P2-L4-t4 - staff stock routes and demo stock (task 4 of 6)
Status: done
## Doing
Tasks 4.1 and 4.2 ticked. Commits: 0d124dd `test: staff stock list, bulk update and demo stock` (red), 2d7be34 `feat: admin store stock routes and demo stock` (handlers, two routes, seed load, openapi, regenerated core.d.ts and Postman collection, ticks), then this `chore:` log commit. Done.
## Found
- Red first: 11 route tests and `TestAuthGates` failed with 404 (routes absent, `TestStockListNoRowIsZero` and the rest); `TestResetLoadsDemoStock` failed with 296 missing stock rows. Two 404 tests, `TestStockOtherStoreStaff404` and `TestStockUnknownStore404`, pass at red only because the route is absent; they are real contract tests once the routes exist (same as t3's note).
- `internal/stock/handlers.go`: `Row`, `List`, `Put`, unexported `storeFor` (PathID, then `canSee`, then `store.Get`, so store staff of another store get 404 before any query), `canSee`, `checkRows` (count, product ids, quantities, duplicates, in that order), `update` (quantity is `*int` so absent is told apart from 0). Stock imports `store`, `auth`, `httpx`, no `catalog`. `httpx.IsUUID` is reused for ids; no new regexp.
- The 23503 (unknown product) answer is mapped in `stock.Put` to 400 `rows` "unknown product" with `pgconn`, not `pg.Map`, which answers 409 for foreign keys.
- `app.New`: `GET` and `PUT /admin/stores/{id}/stock` under `RequireStaff` (after the service-areas routes).
- Seed: `truncateTables` already held `store_stock, carts, cart_items` (t1). `load` now runs `loadCatalog`, then the Decision 15 insert inline in `seed.go` (no new file; scope). Demo values checked in the e2e database: 296 rows, `...0601` at 17 and 22, a zero and a low count at both stores, 0 carts.
- Test fixtures: store A is the shared `testStoreID` (its store-staff user is `auth.CreateStaff` once per package, as the brief says, then `staffSignIn`); store B is `insertStore(t, true)` per test. `insertProduct` numbers slugs, so product names may repeat across tests.
- `TestStockListOwnStoreFilters` cannot check "only Amul Milk" literally in a shared package DB: other tests' milk products have no stock at A, so they are low too. It asserts on its own three products (Amul Milk listed at 3, Milk Bread and Curd absent) with `pageSize=100`.
- Extra test beyond 4.1's list: `TestStockListSearchEscapes` (q `%` matches a literal `%`, spec's "matched literally" rule).
- `TestAuthGates`: the staff gate table gained a `body` field; the two existing rows changed to keyed-by-position `nil` bodies. Stock rows: GET allowed 200, PUT with empty rows allowed 400 for store staff of testStoreID and admin.
- `openapi.json`: tag `stock` (appended after `catalog`), operations `getStock` and `putStock` on `/admin/stores/{id}/stock` (security bearer, 400/401/404 with examples, request example, 204 without content), schemas `StockRow`, `StockList`, `StockUpdate` after `PincodeConflict`. Edited with a scratch script (round-trip checked byte-identical), not kept in the repo.
## Gates
- `GOFLAGS=-count=1 make test-core`: exit 0 (gofmt, vet, `go test -race`): cmd/core 1.27s, cmd/core-admin 16.6s, app 62.6s, auth 9.8s, blob 1.6s, catalog 1.9s, config 2.7s, httpx 3.0s, migrate 2.6s, pg 3.3s, seed 23.7s, stock 2.4s, store 2.1s; all `ok`.
- `PATH=$HOME/.local/node-v22.23.3/bin:$PATH make gen postman`: exit 0; postman 11 of 11 pass; `core.d.ts` and the Postman collection regenerated and committed in the feat commit; `git status --short` empty after.
- `openspec validate --all --strict`: exit 0, 12 passed, 0 failed.
- `cd services/core && go run ./cmd/core-admin migrate && go run ./cmd/core-admin seed-demo --reset`, twice, with the Makefile's E2E env against `shopperstop_core_e2e`: migrate exit 0 (`0005_stock_cart` applied), both seed runs exit 0. pgx check after: 2 stores, 148 products, 296 stock rows, 2 stores with a zero and a 1 to 4, 0 carts, 0 cart items.
## Requests
- none
## Blockers
- none
