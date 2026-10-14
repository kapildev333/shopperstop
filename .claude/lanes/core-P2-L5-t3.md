# core-P2-L5-t3 - customer order reads `GET /orders`, `GET /orders/{id}` (task 3 of core-orders)
Status: done
## Doing
Task 3 landed on `lane/core-P2-L5-orders`: test commit e7b35de, feat commit 4904840, then this chore. Gates green: `make test-core` exit 0, `make gen postman` exit 0 and leaves the tree clean, `openspec validate --all --strict` 13 passed. Boxes 3.1 and 3.2 ticked. Task 4 (transitions and customer cancel) is next and starts from its own brief.
## Found
- `order.List(pool)` (`GET /orders`, `httpx.Page`, `CustomerOrders` and `CountCustomerOrders` in the caller's id, `views`, `httpx.NewList`) and `order.Get(pool)` (`httpx.PathID`, then `respond` in `customerScope`, 200) are in `internal/order/handlers.go`, registered in `internal/app/app.go` after `POST /orders` with `a.RequireCustomer`.
- `orders_test.go` gains `orderListView` and `readOrder(t, path, token) orderView` as design Test strategy names them, plus the seven tests of 3.1. `accounts_test.go` `cartGates` gains the two GET rows.
- `openapi.json`: `listOrders` (`GET /orders`, `page`, `pageSize`; 200 with the demo order `...0703` inside a page of 1 of 24, 400 with field `pageSize` and message `must be from 1 to 100`, 401), `getOrder` (`GET /orders/{id}`, example `...0703`; 200, 401, 404 `not_found`), schema `OrderList` after `OrderCreate`. `core.d.ts` and the Postman collection regenerated in the feat commit.
- `TestOrderSnapshotsSurviveProductChange` changes the product with plain SQL, as the brief's test list says, not through the admin route. The spec scenario says "an admin changes the price"; the route is covered elsewhere (catalog tests), so this test only pins the snapshot.
- Red run: every new test and both new `TestAuthGates` rows failed with 404 `not_found` (the routes did not exist), nothing else failed.
- Task 4 can reuse `readOrder` and `orderListView`; `orderView` already carries `DeliveredAt`, `CancelledAt`, `CancelReason` and the events.
## Requests
- none
## Blockers
- none
