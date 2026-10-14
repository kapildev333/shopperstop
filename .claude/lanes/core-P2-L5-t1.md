# core-P2-L5-t1 - orders schema, queries, productIds in the envelope (task 1 of core-orders)
Status: done
## Doing
Task 1 landed on `lane/core-P2-L5-orders`: test commit e86af16, feat commit 667a701, then this chore. Gates green (see report). Task 2 (placement) is next and starts from its own brief.
## Found
- Migration `0006_orders.sql`, the `sqlc.yaml` entry, `queries/order.sql` and `AddressByID` are copied verbatim from design.md (line ranges extracted, not retyped). sqlc v1.31.1 generates `internal/order/db/` and the three tables into every package's `models.go`; `internal/address/db/address.sql.go` gains `AddressByID`.
- `httpx.Error` has `ProductIDs []string json:"productIds,omitempty"`; `TestWriteErrorProductIDs` in `internal/httpx/json_test.go`.
- `seed.truncateTables` gains `order_events`, `order_items`, `orders` (Decision 15), so `seed.Reset` works once 0006 exists.
- `internal/order/` holds only the package comment, `schema_test.go` (package `order_test`, `TestMain` on `testdb.Migrated("order")`) and the generated `db/`.
- `openapi.json`, `core.d.ts` and the Postman collection did not change in this task (no route yet); `make gen postman` left the tree clean after the feat commit.
- Note for task 2 workers: `address/queries` now has `AddressByID` (`AddressByIDRow`), not yet wrapped by `address.Get`.
## Requests
- none
## Blockers
- none
