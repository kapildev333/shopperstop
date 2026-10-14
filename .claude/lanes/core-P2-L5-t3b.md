# core-P2-L5-t3b - stock release lock order and task 2 review fixes (follow-up to task 3)
Status: done
## Doing
Part A and Part B landed on `lane/core-P2-L5-orders`: test commit 4f07972 (deadlock test, red), fix commit ac6507e (`stock.Release` locks in product id order), test commit 1f1aa14 (double submit, stock before minimum, race assertions moved to the test goroutine, `cartGates` comment), then this chore. Gates green: `GOFLAGS=-count=1 make test-core` exit 0; stock and placement runs three times each, exit 0; `make gen postman` exit 0 and `git status --short` empty; `openspec validate --all --strict` 13 passed. No boxes in `tasks.md` touched (no openspec edits in this brief).
## Found
- `stock.Release` now calls `LockStock` (discarding the rows) before `AddStock`, as `Reserve` does. No query, signature or other behaviour changed; products without a stock row are still skipped. Its doc comment states the id-order lock.
- Red run of `TestReleaseAndReserveDoNotDeadlock` before the fix: 8 of 10 runs failed, each with `deadlock detected (SQLSTATE 40P01)` (first batch of five: 3 failed; second batch of five: 5 failed). Green after the fix.
- This answers the request core-P2-L5 (team lead) wrote under `## Requests` ("a ruling on `stock.Release` locking its rows in product id order"). Its `Found` note about the deadlock is now resolved by this lane.
- `TestPlaceOrderRaceForLastUnit` goroutines now call `placeAsync` (a `t`-free POST that returns an `answer{status, body, err}`); every assertion and `Fatal` runs on the test goroutine. `TestPlaceOrderDoubleSubmit` uses the same helper. All three Part B tests (race rework, double submit, stock before minimum, including both subtests) passed on their first run, so no product code was touched and no request was raised.
- `TestAuthGates` comment in `accounts_test.go` now describes the cart and order rows.
- The deadlock test has no sleeps; its only timeout is `collect`'s 10 s wait for the goroutines (a hang shows as "deadlock" from `collect`, not 40P01). Stock and app runs passed 3 of 3 each after the fix.
## Requests
- none
## Blockers
- none
