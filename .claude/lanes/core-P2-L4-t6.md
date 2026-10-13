# core-P2-L4-t6 - cart clamping, store replacement, Lines for placement (task 6 of 6)
Status: done
## Doing
Tasks 6.1 and 6.2 ticked. Commits: 9db40d4 `test: clamping to stock and replacing the cart` (red), 7c1f5b7 `feat: cart clamps to stock and replaces on store change; Lines for placement` (set branches, `Lines`, PUT flags, openapi descriptions, regenerated core.d.ts and Postman collection, ticks), then this `chore:` log commit. Done; all of core-stock-cart's tasks 1 to 6 are ticked.
## Found
- Red: `TestCartClampedToStock`, `TestCartOutOfStockClampsToNothing` and `TestCartOtherStoreReplaces` failed (clamped false and line 5 instead of 3; line written at quantity 1 with stock 0; replaced false). `TestCartZeroForOtherStoreKeepsCart` passed at red: task 5's code already left the cart alone on quantity 0, so it is a guard for the new branch, not a red test. `internal/cart/cart_test.go` did not build at red (`undefined: cart.Lines`), so no test in that package ran. `TestClearWithoutCart` would pass at red too, since `Clear` already answered nil with no cart; it stays as a characterisation test.
- `set` (`internal/cart/cart.go`) now returns `replaced, clamped`. Order: EnsureCart (quantity above 0), LockCart; cart at another store: quantity 0 returns at once (no change), otherwise ClearCart, MoveCart, replaced; quantity above 0: `stock.Quantity` in the transaction, cut to it, clamped; quantity 0 (also after a clamp to 0) deletes the line; DeleteEmptyCart. The task 5 intermediate note in `set`'s doc is gone.
- `cart.Lines(ctx, tx pgx.Tx, customerID) (string, []stock.Line, error)`: LockCart, then CartItems in insertion order; no cart answers `"", nil, nil`. Matches the design's Interfaces. `cart` now imports `stock` (no cycle: stock imports neither cart nor catalog).
- Test fixtures in `internal/cart/cart_test.go` set `created_at` on cart lines explicitly: lines inserted in one transaction share `now()`, so insertion order would otherwise fall back to product id.
- openapi: the PUT description now covers the store check on every request, the replacement (quantity above 0 only) and the clamp (line absent at 0). `replaced` and `clamped` descriptions updated. No `true` example added: Decision 17 asks for an example on each response with content, which the 200 example already is.
- Gates (worktree root): `GOFLAGS=-count=1 make test-core` exit 0 (gofmt, vet, `go test -race`): cmd/core 1.54s, cmd/core-admin 16.8s, app 66.0s, auth 10.4s, blob 1.9s, cart 2.3s, catalog 2.6s, config 2.8s, httpx 2.9s, migrate 3.0s, pg 2.0s, seed 25.0s, stock 2.0s, store 1.8s, all `ok`. `PATH=$HOME/.local/node-v22.23.3/bin:$PATH make gen postman` exit 0, postman 11 of 11 pass; a second run after the feat commit left `git status --short` empty. `openspec validate --all --strict` exit 0, 12 passed, 0 failed.
- Scratch slip: one `make gen` run wrote a redirect to `/tmp/x` by mistake; removed.
## Requests
- none for other lanes. For core-P2-L5: `cart.Lines` and `cart.Clear` are in place with the signatures in the design; placement calls `Lines` and `stock.Reserve` with the same `tx`, then `Clear(ctx, tx, customerID)`.
## Blockers
- none
