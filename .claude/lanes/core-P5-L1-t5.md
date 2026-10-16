# core-P5-L1-t5 - fix: system cancel only while payment is pending (task 5 of core-payments)
Status: done; review: approve (core-P5-L1-review-t5.md)
## Doing
Done: test `6facad2`, fix `616f316`. Gates green (see Found). Lane log committed separately.
## Found
- `Transition` (`services/core/internal/order/status.go`) refuses a `system` cancel with 409 `conflict` ("only an order awaiting payment can be cancelled by the system") under the row lock, after the table check, unless `payment_status` is `pending`. Cash orders (null status) are refused too. Customer and staff cancels are unchanged.
- Status route 409 description in `openapi.json` gained one clause; `core.d.ts` and the Postman collection regenerated.
- `openspec/changes/core-payments`: scenario "The payment service cannot cancel a paid order" added under "A service moves orders for a rider"; the `name` 1-to-80 sentence moved out of that requirement (covered by "No actor") to keep it under 500 characters (now 479). Decision line in design.md; task 5 in tasks.md (Tasks intro now says "Five worker tasks").
- Gates: gofmt empty; `go vet ./...` clean; `go test -race -count=1 ./...` all packages ok; `make gen postman` ok (22/22 Postman tests); `make test-web` exit 0 (35/27/10/29 test files, 104/327/61/183 tests, builds ok); `openspec validate --all --strict` 20 passed, 0 failed.
## Requests
None.
## Blockers
None.
