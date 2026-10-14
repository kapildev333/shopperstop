# core-P2-L5-t7 - demo orders in the seed and the final gate (task 7 of core-orders)
Status: done
## Doing
Task 7 landed on `lane/core-P2-L5-orders`: test commit b4a860c (red), feat commit 4148e9b (`seed.go` four statements, boxes 7.1 and 7.2 ticked), then this chore. Gates green: `GOFLAGS=-count=1 make test-core` exit 0; `make gen postman` exit 0 and `git status --short` empty after the feat commit; `openspec validate --all --strict` 13 passed. All boxes 1.1 to 7.2 are ticked; the change is ready for `/opsx:verify core-orders`.
## Found
- Red (b4a860c): `TestResetLoadsDemoOrders` failed with `rows in orders: 0, want 3`; `TestDemoOrdersThroughTheRouter` failed with `GET /orders` answering 200 `total 0`. Nothing else in the package was red or passed by accident; the other seed tests were not touched.
- Green (4148e9b): the four statements of design Decision 15 are copied from `design.md` by script, not retyped, and sit in `load` after the stock insert, each with the wrap text of Decision 15 and args `customerID, storeKoramangala` (1), none (2, 3), `staffKoramangala` (4). Both target tests pass with `-race`.
- Full `make test-core` on `shopperstop_core_test` passes every package (see report).
- The brief's test list was followed literally. Two small choices inside it: `TestResetLoadsDemoOrders` gives the other customer's event an `actor_id` (the customer), which the brief leaves open and nothing asserts; `TestDemoOrdersThroughTheRouter` calls `seed.Reset` at its end without `t.Cleanup`, as the brief says (every test in the package resets before it reads, so a failure midway leaves nothing behind that another test reads).
- Nothing ran against `shopperstop_core` or `shopperstop_core_e2e`. No `core-admin`, `make dev`, `make seed` or `make e2e`.
- For the manager's hand checks after the PR merges: `...0703` is cancellable by the demo customer, and cancelling it returns stock 1 and 3 at Koramangala (design Decision 15 notes this; harmless until the next reset).
## Requests
- none
## Blockers
- none
