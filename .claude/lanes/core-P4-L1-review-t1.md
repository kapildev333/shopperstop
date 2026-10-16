# core-P4-L1-review-t1

Reviewer: core-P4-L1 Task 1 (inStock and sort on GET /stores/{id}/products), 5b545e3 + 3c2ea0c. Read-only.

## Verdict: approve

No blocking findings.

## Checks
- Test-first: 5b545e3 adds `TestStoreProductsInStockOnly`, `TestStoreProductsSortByPrice`, `TestStoreProductsBadInStockOrSort`, red before 3c2ea0c, green after.
- Covers catalog "Store products can be limited to those in stock" (all three scenarios) and "Store products can be sorted by price" (all four); the existing list/search tests stay green.
- Scope: `queries/catalog.sql`, regenerated `catalog.sql.go`, `catalog/store.go`, the test file, `openapi.json`, generated `core.d.ts` and Postman collection, tasks.md ticks.

## Findings (nits, no fix needed)
1. nit, Postman collection: the 400 example for the store products route reuses the 200 example's query; generator output, leave it.
2. nit, lane log `core-P4-L1-t1.md` status line stale ("feat commit pending review"); fixed at acceptance.

## Gates
- gofmt -l .: empty; go vet ./...: ok; go test -race -count=1 ./...: all ok
- make gen postman: tree clean; openspec validate --all --strict: passed
