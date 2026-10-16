# rider-P3-L2-T4 - rider location and the customer's view (task 4 of rider-deliveries)
Status: done (tasks 4.1 to 4.4 ticked; gates green; chore commit last on the branch)
## Doing
Done. Commits on `lane/rider-P3-L2-deliveries`: `test: rider location and customer delivery view` (red), `feat: rider location and customer delivery view`, then the `chore:` coretest nits as the final commit. Reviewer pending.
## Found
- Red run before any product code (`go test -race -count=1 -run 'TestPutLocation|TestCustomer' ./internal/app/`), the six named tests fail on the missing routes:
```
--- FAIL: TestPutLocationReplaces (2.52s)
    deliveries_test.go: location 12.9,77.5: got 404 {"error":{"code":"not_found","message":"not found"}}, want 204
--- FAIL: TestPutLocationRefusals (0.02s)
    deliveries_test.go: missing lat: got 404 {"error":{"code":"not_found","message":"not found"}}, want 400 validation on lat
--- FAIL: TestCustomerFollowsRider (0.02s)
    deliveries_test.go: customer read of ...100005: got 404 {"error":{"code":"not_found","message":"not found"}}, want 200
--- FAIL: TestCustomerLocationHiddenAfterDelivery (0.02s)
    deliveries_test.go: location 12.9716,77.5946: got 404 ..., want 204
--- FAIL: TestCustomerLocationBeforeClaimHidden (0.02s)
    deliveries_test.go: location 12.9,77.5: got 404 ..., want 204
--- FAIL: TestCustomerReadRefusals (0.02s)
    deliveries_test.go:838: unknown token: got 404 ..., want 401 unauthorized
```
- Test-commit fixture fix: the first `test:` commit had the refusal test's "another customer's order" case fail for the wrong reason (401, the stranger token was never known to the fake). Fixed by one line that gives the stranger an order, then amended into the same `test:` commit (still before the feat). The amended file is red without the feat (checked) and green with it.
- Commit history note: T5's `test: delivery demo seed` (`bf033d3`) landed on the branch between T4's test and feat work; T4's commits were made with `git commit --only` on T4's own file only. T5's uncommitted `internal/seed/` edits were not touched.
- Implemented per design.md: `auth.Bearer` exported (Decision 2, renamed at its three callers in `auth.go`, `rider.go`, `staff.go`; `coretest` keeps its own unexported helper). `delivery.PutLocation` (Decision 10: `lat` then `lng`, missing is 400 "is required", out of range 400 "must be between -90 and 90" / "-180 and 180", upsert with server `now()`, 204). `delivery.OrderDelivery` (Decisions 6 and 7: no bearer is 401 with no core call; `orderId` not a uuid is 404; `core.CustomerOrder` with the bearer, whose 401/404/502 pass through; then the row, none is 404; `location` only when the join found a position, which the SQL limits to assigned deliveries recorded at or after `assigned_at`). Routes: `PUT /api/rider/v1/me/location` behind `RequireRider`; `GET /api/rider/v1/orders/{orderId}/delivery` without middleware (the handler reads the bearer itself). No subject is logged on the customer route.
- `openapi.json`: operations `putLocation` (204, 400 `lat` example, 401) and `getOrderDelivery` (200, 401, 404, 502 with examples, bearer security); schemas `LocationUpdate` (request, no `additionalProperties: false`), `Location`, `CustomerDelivery`. Formatting kept (2-space JSON, round trip byte-identical before the edit).
- Choices design.md does not spell out, both small: (a) the customer route's no-bearer 401 uses `core.ErrUnauthorized` (the same `unauthorized` / "sign in required" envelope the rider's own 401 uses), so no new error value; (b) `coordinate` takes the limit and formats the message from it (`-90`/`90`, `-180`/`180`).
- Chore (final commit), decided within scope: the fake's `storeOrders` answers core's 404 for an unknown store. "Known" is what `AddStore` registered or any order names: a store that is neither gets 404. Design alternative (only `AddStore`-registered stores known) would have broken `core_test.go` `TestStoreOrdersReadsReadyWithServiceToken` (stores A and B are never registered there), which is outside the chore's two files. `TestStoreOrdersMissingStoreIs502` is unchanged and still passes (it uses `FailRoute` for the 404; the client maps it to 502). The setStatus comment and the `do` doc sentence are done as briefed.
- Gates: `gofmt -l` clean on the touched packages; `go vet` clean; `make gen` changed nothing (`core.d.ts` identical, no rider `.d.ts` created); `make postman` `# pass 17 # fail 0` (collection regenerated in the feat commit).
## Requests
- to rider-P3-L2 (the lead): the chore's known-store rule (registered or ordered) is a fake-only choice; say if you want the stricter registry-only rule, which needs `AddStore` in `core_test.go`.
## Blockers
None.
