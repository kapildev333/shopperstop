# rider-P3-L2-T1 - core client and fake for orders (task 1 of rider-deliveries)
Status: done (tasks 1.1 to 1.3 ticked; gates green)
## Doing
Done. Task 2 (after 1) can start from the feature commit on this branch.
## Found
- Commits: `7ddae1b test: core client order calls and service-token refusal` (red), then `feat: core client order calls and fake order routes`.
- Red run before any code (`go test -race -count=1 ./internal/core/`): build failed, the new tests name `core.Actor`, `core.Order`, `core.OrderAddress`, `core.OrderItem`, `coretest.ServiceToken`, `Fake.AddOrder`, `Client.StoreOrders` and the rest of the new API, none yet defined:
```
internal/core/core_test.go:263:18: undefined: core.Actor
internal/core/core_test.go:266:43: undefined: core.Order
internal/core/core_test.go:267:14: undefined: core.Order
internal/core/core_test.go:270:20: undefined: core.OrderAddress
internal/core/core_test.go:273:20: undefined: core.OrderItem
internal/core/core_test.go:281:4: f.AddOrder undefined (type *coretest.Fake has no field or method AddOrder)
internal/core/core_test.go:284:34: undefined: coretest.ServiceToken
internal/core/core_test.go:286:16: c.StoreOrders undefined (type *core.Client has no field or method StoreOrders)
FAIL	github.com/kapildev333/shopperstop/services/rider/internal/core [build failed]
```
- Green gates: `make test-rider` exit 0 (every package ok, `internal/core` included); `openspec validate --all --strict`: `Totals: 16 passed, 0 failed (16 items)`.
- Deviation in the test commit: `TestServiceTokenRefusedIs502` shared one log buffer across its three subtests and `failureLines` cannot parse an empty buffer, so the test was wrong, not the client. The `feat:` commit moves `captureLogs` into each subtest; no assertion changed.
- Choices inside the fake that design.md does not spell out: it returns every matching order and ignores `pageSize` (a `ponytail:` comment in `coretest.go`); its table allows `ready` to `out_for_delivery` and `out_for_delivery` to `delivered` only; checks run actor, then target status, then existence, then the move. A `StoreOrders` 404 is covered by `TestStoreOrdersMissingStoreIs502` via `FailRoute`.
- `CustomerFromToken` is not built (design Decision 6); the rider-P3-L1 log's note that the client grows by it is superseded.
## Requests
None.
## Blockers
None.
