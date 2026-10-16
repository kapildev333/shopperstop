# rider-P3-L2-T1 - core client and fake for orders (task 1 of rider-deliveries)
Status: started
## Doing
Task 1.1 committed (red). Next: task 1.2, the client and fake, then 1.3.
## Found
- Design Decision 5 and Interfaces followed; `CustomerFromToken` is not built (Decision 6), so the rider-P3-L1 note about it is superseded.
- Red run (`go test -race -count=1 ./internal/core/`, before any code): build failed, the new tests name `core.Actor`, `core.Order`, `core.OrderAddress`, `core.OrderItem`, `coretest.ServiceToken`, `Fake.AddOrder`, `Client.StoreOrders` and the rest of the new API, none yet defined:
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
## Requests
None.
## Blockers
None.
