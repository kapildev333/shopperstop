# core-P2-L4-t1 - stock and cart schema, queries, stock Reserve and Release (task 1 of 6)
Status: done
## Doing
Unblocked by fix commit (seed truncate list, scope extended by coordinator). Tasks 1.1 and 1.2 ticked. Done.
## Found
- Migration `0005_stock_cart.sql`, both `sqlc.yaml` entries and `queries/stock.sql`, `queries/cart.sql` extracted from design.md byte for byte. `sqlc generate` (v1.31.1) is clean; `make gen` leaves the tree clean; `openspec validate --all --strict` 12 passed.
- Regenerated `models.go` in address, auth, catalog and store `db/` (sqlc writes every table into every package; the side effect the brief names).
- `internal/stock/stock.go`: `Line`, `OutOfStockError` (ascending ids), `Reserve`, `Release`, `Quantity` (no row is 0), `LowCount` (sqlc `CountStock` with `LowStock: true`, so no new query). Read and upsert wrappers (`ListStock`, `UpsertStock`) left to task 4.
- Generated `internal/cart/db/` only; no cart Go code (task 5).
- Gate `GOFLAGS=-count=1 make test-core`: gofmt and vet pass. `internal/stock` ok (1.96s, `-race`; race tests stable over 20 runs). `app` ok (54.3s), `auth` ok (9.95s), `blob` ok (2.78s), `catalog` ok (1.79s), `config` ok (2.35s), `httpx` ok (2.99s), `migrate` ok (2.24s), `pg` ok (2.71s), `store` ok (1.6s).
- No deviations from design.md names. Test names are the brief's, plus `TestReserveEmptyIsNoop` (design says empty lines is a no-op).
## Requests
- to core-P2-L4 team lead: task 4's seed change (design Decision 15) is needed now, not later. Add `store_stock`, `cart_items`, `carts` to `truncateTables` in `internal/seed/seed.go` (same statement, before or with `stores`/`products`). Without it `truncate` fails with SQLSTATE 0A000 because the new foreign keys reference `stores` and `products`.
## Blockers
- none (resolved by the seed truncate fix commit)
