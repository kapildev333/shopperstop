# core-P2-L5-t2 - order placement `POST /orders` (task 2 of core-orders)
Status: done
## Doing
Task 2 landed on `lane/core-P2-L5-orders`: test commit 90c3a38, feat commit 861fde2, then this chore. Gates green: `make test-core` exit 0, `make gen postman` leaves the tree clean, `openspec validate --all --strict` 13 passed. Boxes 2.1 and 2.2 ticked. Task 3 (customer reads) is next and starts from its own brief.
## Found
- `order.Place(ctx, pool, customerID, addressID) (id string, err error)` is the placement entry point; one `pgx.BeginFunc`, steps 1 to 6 of design Decision 2, the out-of-stock and number-collision mapping after it. No log line yet (task 5 adds it after commit).
- `order.views(ctx, q *db.Queries, rows)` and `order.respond(w, r, pool, id, sc, status)` are in place for tasks 3 to 5. `respond` reads with `GetOrder` in the caller's scope; another scope is 404.
- `order.notFound()` is written as the brief lists it for `handlers.go`, but nothing calls it until task 3. `order.Actor` is in `order.go` as design Interfaces lists it, unused until task 4.
- `address.Get(ctx, d db.DBTX, customerID, id)` and `auth.CustomerByID(ctx, d db.DBTX, id)` are the exported readers of design Interfaces, bodies as given.
- `POST /api/core/v1/orders` is registered in `internal/app/app.go` after the stock routes, `RequireCustomer`, and documented as `placeOrder` (tag `orders`, after `cart`). Schemas added: `OrderAddress`, `OrderItem`, `OrderEvent`, `Order`, `OrderCreate`; `Error` gains `productIds`. Three 409 examples use the OpenAPI Example Object form (`summary`, `value`).
- `info.description` of `openapi.json` now names `productIds?` in the error envelope (one line; the design does not list it, it follows the MODIFIED Error envelope in the platform delta).
- Test helpers in `internal/app/orders_test.go` as design Test strategy names them: `ordersPath`, `missingOrderID`, `nextPincode`, `shop`/`newShop`, `stockTo`, `buyer`/`newBuyer`, `orderView`, `orderItemView`, `orderEventView`, `place`, `mustPlace`, plus `requireUnchanged` and `wantAmounts` (small, used by many tests). Task 3 (`orderListView`, `readOrder`) builds on them.
- `TestAuthGates`: the POST row is appended to `cartGates`, as the brief says. Its comment still describes only the cart rows.
- Note: `envelope.ProductIDs` sits inside the inner `Error` struct (where the wire format puts `productIds`), not at the top level of `envelope`. Adding it at the top level would never be populated.
- `accounts_test.go` `TestSignInFailuresLookTheSame`: the comparison `wrong != unknown` became `reflect.DeepEqual`, because the envelope now holds a slice and the struct is no longer comparable. Same assertion.
- `make gen` wrote no sqlc output (task 1 generated it); `core.d.ts` and the Postman collection changed as the new route requires.
## Requests
- to core-P2-L5 (team lead): `TestDeleteOrderedProductRefused` in `internal/app/catalog_products_test.go` still uses its probe table (core-P2-L3-t4). It can now use a real placed order, as `TestDeleteOrderedProduct` does. Not changed here: outside this task's scope paths. Decide whether task 7 or a catalog chore takes it.
## Blockers
- none
