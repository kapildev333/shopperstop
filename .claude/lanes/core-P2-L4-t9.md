# core-P2-L4-t9 - close four acceptance test gaps (test only)
Status: done
## Doing
Four test edits landed in 384bcd7 (`test: acceptance gaps, ...`), all passing on first run. This `chore:` commit adds this log. Done.
## Found
- No product code touched. Every edit pins behaviour that already exists; none needed a fix, so there is no red run.
- Case-insensitive search: `TestStoreProductsFilter` now sends q `ZFILT CURD`, product names unchanged. Passes.
- Unknown store: `TestStoreProductsUnknownStore` also checks `GET /stores/{missingStoreID}/products/any-slug` answers 404 `not_found`. Uses the file's existing `missingStoreID` constant (a fixed uuid naming no store) rather than a fresh random uuid. Passes.
- Cart: `TestCartUnknownStore` loops over quantity 1 and 0, both 400 `validation` field `storeId`. Passes.
- Stock: `TestStockListLongQ` (new; q of 101 `x` gives 400 `validation` field `q`) and `TestStockPutMissingQuantity` (new; a row with only `productId` gives 400 `validation` field `quantity`, stored quantity stays 7). Both pass.
- Gates: `GOFLAGS=-count=1 make test-core` exit 0 (all packages `ok`, app 66.9s). `PATH=$HOME/.local/node-v22.23.3/bin:$PATH make gen postman` exit 0, `git status --short` empty. `openspec validate --all --strict` exit 0, 12 passed.
- Databases: tests ran on `shopperstop_core_test` only. No migrate or seed on `shopperstop_core_e2e` or `shopperstop_core`.
## Requests
- none
## Blockers
- none
