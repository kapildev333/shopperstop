# core-P2-L6-t1 - StockRow.imageUrl on the staff stock list (task 1 of core-seed-demo)
Status: done
## Doing
Task 1 landed: test `4fc8895`, feat `1f1d7d6` (code, ticks, regenerated `core.d.ts` and Postman collection). Gates green; task 2 next.
## Found
- `StockRow` (`GET /api/core/v1/admin/stores/{id}/stock`) gains `imageUrl` (omitted when the product has no image), built by the exported `catalog.ImageURL`, the same rule as `StoreProduct.imageUrl`.
- `catalog.imageURL` is renamed `catalog.ImageURL`; no other caller existed.
- `make gen postman` ran for the first time on these `openapi.json` edits: sqlc v1.31.1 added only `ImageKey` to `ListStockRow`; `core.d.ts` gained one member; the Postman contract tests (11) pass.
- Red: `TestStockListImageURL` failed at the URL check (`ImageURL` empty for the product with an image); the other `TestStockList*` tests passed at red.
## Requests
- none
## Blockers
none
