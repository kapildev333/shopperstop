# rider-P3-L2-T5 - delivery demo seed (task 5 of rider-deliveries)
Status: done (tasks 5.1 to 5.3 ticked; gates green on the feat commit; reviewer pending)
## Doing
Done. Waiting for the reviewer and the manager's landing.
## Found
- Red commit `test: delivery demo seed` (`bf033d3`): `server()` passes `delivery.New(testPool, c)`; `TestSeededDeliveryInHistory` added; `TestResetTwiceLeavesDemoRiders` also inserts a delivery and a location for the other rider before the resets and asserts one delivery after two resets and none of the other rows; `TestSummaryMatchesSeed` reads the table of each id line (`riders` or `deliveries`), expects 5 ids, and checks both Postman ids (`riderId`, `deliveryId`) against the environment. Red run (`go test -race -count=1 ./internal/seed/...`), before product code:
```
--- FAIL: TestResetTwiceLeavesDemoRiders (2.48s)
    seed_test.go:116: deliveries after two resets: 0, want 1 (the demo delivery)
--- FAIL: TestSeededDeliveryInHistory (4.91s)
    seed_test.go:177: delivered list holds 0 items, want 1: {"items":[],"page":1,"pageSize":24,"total":0}
--- FAIL: TestSummaryMatchesSeed (9.80s)
    seed_test.go:254: summary holds 4 sign-ins and 4 ids, want 4 and 5
FAIL
```
- Feat commit `feat: delivery demo seed` (`552030c`): `seed.go` gets the `deliveries` row (design.md Data model: SS-DEMOAAAB, rider `...0801`, 33900, 3 items) in `load`, after the riders, with no core call; constants `demoDeliveryID` and `demoOrderID`. `truncateTables` is unchanged (T3's fix already covers the delivery tables, so 5.2's truncate item was already done). `summary.go` gets the header `seed-demo: demo riders and delivery loaded (local databases only)` and the line `  00000000-0000-4000-8000-000000000901  deliveries  SS-DEMOAAAB by Arjun Rao, delivered (Postman deliveryId)`.
- Gates (worktree root): `make test-rider` exit 0, every package ok, no FAIL lines (seed 29.2s). `openspec validate --all --strict`: `Totals: 16 passed, 0 failed (16 items)`.
- Printed summary (`seed.Summary`) after this change:
```
seed-demo: demo riders and delivery loaded (local databases only)

sign-ins (email, password, store)
  rider1-koramangala@shopperstop.local  rider12345  Koramangala
  rider2-koramangala@shopperstop.local  rider12345  Koramangala
  rider1-indiranagar@shopperstop.local  rider12345  Indiranagar
  rider2-indiranagar@shopperstop.local  rider12345  Indiranagar

fixed ids (id, table, what)
  00000000-0000-4000-8000-000000000801  riders  Arjun Rao, Koramangala (Postman riderId)
  00000000-0000-4000-8000-000000000802  riders  Meera Iyer, Koramangala
  00000000-0000-4000-8000-000000000803  riders  Kabir Shah, Indiranagar
  00000000-0000-4000-8000-000000000804  riders  Divya Nair, Indiranagar
  00000000-0000-4000-8000-000000000901  deliveries  SS-DEMOAAAB by Arjun Rao, delivered (Postman deliveryId)
```
- Choices design.md does not spell out, for the reviewer: the delivery row is inserted by `load`, so `Load` (no reset) loads it too, same as the riders; the test's extra other-rider delivery uses order id `...9000-000000000001` and number `SS-OTHER` (test data only).
## Requests
- none
## Blockers
- none
