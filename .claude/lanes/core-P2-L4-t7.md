# core-P2-L4-t7 - review fixes for tasks 4 and 5: NUL byte in q, cart set during last-line removal (brief t7)
Status: done
## Doing
Both fixes landed, test first. Commits on `lane/core-P2-L4-stock-cart`: d5cb4f1 `test: a NUL byte in q is a validation error` (red), 9402c09 `fix: reject a NUL byte in q with 400`, 4576b39 `test: a cart line set during the removal of the last line is kept` (red), ab1ca0e `fix: cart set re-creates the cart when it vanishes under it`, then this `chore:` log commit. No spec, design, tasks or openapi change. Done.
## Found
- Fix A, premise confirmed: all three `q` routes answered 500 `internal` at red with Postgres SQLSTATE 22021 (`invalid byte sequence for encoding "UTF8": 0x00`): `GET /admin/stores/{id}/stock`, `GET /stores/{id}/products`, `GET /admin/products`. The three new tests are `TestStockListNULInQ` (stock_test.go), `TestStoreProductsNULInQ` (catalog_store_test.go), `TestListProductsNULInQ` (catalog_products_test.go).
- Fix A code: in each of `stock.List`, `catalog.storeFilters` and `catalog.productFilters`, a `strings.ContainsRune(q, 0)` check after the 100-character check, answering 400 `validation` field `q` with the message "must not contain a NUL byte". It is four lines per site (the `if`, the write and the return), not the one line the brief sketched: a separate message keeps the reason honest, and a combined message would have said "at most 100 characters" for a NUL. No new helper; each package keeps its own check. `openapi.json` not changed (its q text does not list the 400 cases, and no test requires it).
- Fix B: `set` in `cart.go` ensures and locks in a loop while the lock finds no cart and quantity is above 0; the one-line comment names the concurrent removal. Quantity 0 with no cart still returns at once. The loop ends in practice because a removal can only be undone by a fresh insert; under sustained churn on one customer's cart it could spin, which is not a case the product has.
- Race test red: `TestCartSetSurvivesConcurrentRemoval` failed in 5 of 5 red runs (each run stopped at the first failing round with an empty cart; the round index was not recorded, so the per-round rate is not measured). Green after the fix: 3 of 3 targeted runs of `-run TestCart` ok, and inside the full `make test-core`.
- `cart.Lines`, `cart.Clear` and the PUT contract are unchanged; the fix does not alter the `set` signature.
## Gates
- `GOFLAGS=-count=1 make test-core`: exit 0 (gofmt, `go vet`, `go test -race`): cmd/core 1.50s, cmd/core-admin 16.2s, app 65.6s, auth 9.5s, blob 2.8s, cart 2.3s, catalog 2.5s, config 2.6s, httpx 3.0s, migrate 3.1s, pg 2.1s, seed 22.3s, stock 1.7s, store 1.7s; all `ok`.
- `PATH=$HOME/.local/node-v22.23.3/bin:$PATH make gen postman`: exit 0; postman `# fail 0`; `git status --short` empty after.
- `openspec validate --all --strict`: exit 0, 12 passed, 0 failed.
## Requests
- none
## Blockers
- none
