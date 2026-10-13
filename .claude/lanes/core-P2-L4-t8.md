# core-P2-L4-t8 - an out-of-stock line for another store keeps the cart (tasks 7.3 and 7.4)
Status: done
## Doing
Tasks 7.3 and 7.4 ticked. Commits: 063813d `test: an out-of-stock line for another store keeps the cart` (red), 227afd2 `fix: cart set reads stock first and keeps the cart when another store has none` (cart.go `set` and its doc, two openapi description strings, regenerated core.d.ts and Postman collection, the two ticks), then this `chore:` log commit. Done.
## Found
- Red run (`go test -race -run 'TestCartOtherStore|TestCartOutOfStockSameStore' ./internal/app`): `TestCartOtherStoreOutOfStockKeepsCart` failed at its first PUT for store B with `clamped true replaced true` (the cart was emptied and moved, the line clamped away). `TestCartOtherStorePartialClampReplaces` passed at red (guard: replace on a partial clamp is already the behaviour). `TestCartOutOfStockSameStoreRemovesLine` passed at red (guard: a line clamped to 0 at the cart's own store is removed, the other line stays).
- Fixture deviation in 7.3 test (3): the brief says `setStock(t, storeA, p, 0)` after `cartProduct` at A, but `cartProduct` already inserts P's row at A and `store_stock` is unique on `(store_id, product_id)`, so `setStock` cannot run there. The test sets the existing row with `update store_stock set quantity = 0 where store_id = $1 and product_id = $2` through `testPool.Exec`, the same plain-SQL style as the other fixtures. No helper added. Flagged for review; the scenario and assertions are as the brief states.
- Fix (`cart.set`): the clamp block moved to the top, before `EnsureCart`, unchanged inside; the two early returns now answer `false, clamped, nil`. Nothing else in `set` moved.
- The `set` doc comment is rewritten to the new order. No signature, query, migration, route or schema change; `handlers.go` untouched.
- `TestCartSetSurvivesConcurrentRemoval` stayed green in all three race runs.
## Gates
- `cd services/core && go test -race -count=1 -run TestCart ./internal/app`, three runs: exit 0, 0, 0 (each `ok`, about 9.8 s).
- `GOFLAGS=-count=1 make test-core`: exit 0 (gofmt, `go vet`, `go test -race`): cmd/core 1.26s, cmd/core-admin 16.7s, app 66.3s, auth 10.5s, blob 1.9s, cart 2.7s, catalog 2.3s, config 2.3s, httpx 3.0s, migrate 3.2s, pg 2.4s, seed 23.2s, stock 2.1s, store 2.0s; all `ok`.
- `PATH=$HOME/.local/node-v22.23.3/bin:$PATH make gen postman`: exit 0; postman `# pass 11`, `# fail 0`; `git status --short` empty after the fix commit and after this run.
- `openspec validate --all --strict`: exit 0, 12 passed, 0 failed.
## Requests
- none
## Blockers
- none
