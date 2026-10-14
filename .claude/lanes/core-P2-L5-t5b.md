# core-P2-L5-t5b - bulk stock upsert lock order and two cancel tests (follow-up to the task 4 review)
Status: done
## Doing
Part A and Part B landed on `lane/core-P2-L5-orders`: test commit 6127522 (deadlock test, red), fix commit 5049692 (`UpsertStock` writes in product id order, `internal/stock/db/stock.sql.go` regenerated), test commit 4b19825 (`TestCancelConcurrent`, `TestCancelTrimsReason`), then this chore. Gates green: `GOFLAGS=-count=1 make test-core` exit 0; stock run three times and app run twice, all exit 0; `make gen postman` exit 0 and `git status --short` empty; `openspec validate --all --strict` 13 passed. No `openspec/` edits.
## Found
- Red run of `TestUpsertAndReserveDoNotDeadlock` before the fix: 5 of 5 runs failed, each with `deadlock detected (SQLSTATE 40P01)` at `stock_test.go` (rounds 3, 16, 0, 0, 3).
- The fix uses the subquery form `from (select unnest(@product_ids::uuid[]) as product_id, unnest(@quantities::integer[]) as quantity) t order by t.product_id`, not the two-argument `unnest` in the FROM clause from the brief's example: sqlc v1.31.1 rejects `unnest(unknown, unknown)` there (`queries/stock.sql:26:6`). The subquery shape is the one `AddStock` already uses. Query name and the three parameters are unchanged; the generated `UpsertStockParams` struct is unchanged, so `handlers.go` needed no edit.
- `TestCancelConcurrent` and `TestCancelTrimsReason` passed on their first run; no product code changed, no request raised.
- The deadlock test swaps P and Q so that P's id sorts before Q's; the product ids are random uuids, so the order is not fixed by creation.
- `TestCancelConcurrent` asserts each losing cancel is 409 `conflict` and the order's two events (placed, then placed to cancelled); the 409 message is not pinned, since it names the state the winner left.
## Requests
- none
## Blockers
- none
