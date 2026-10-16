# rider-P3-L2-T7 - guard tests and demo-matching examples (task 7 of rider-deliveries)
Status: done (tasks 7.1 to 7.3 ticked; gates green on the docs commit; reviewer pending)
## Doing
Done. Waiting for the reviewer and the manager's landing.
## Found
- Test commit `test: delivered on another rider's delivery is not found; null lat refused` (`62c0a6b`): `TestDeliveredOtherRidersDelivery` added to `deliveries_test.go`, and a `null lat` row (`{"lat": null, "lng": 77.6}`, field `lat`) in `TestPutLocationRefusals`. Both pass on the current code (green expected, no product change): `--- PASS: TestDeliveredOtherRidersDelivery (3.69s)` and `--- PASS: TestPutLocationRefusals (0.03s)`. These guard uncovered paths: the rider-scoped delivered route and the null-lat refusal. The brief said `77.6` for the null row; tasks.md 7.1 says `77.5`; the test uses `77.6` as the brief states.
- Docs commit `docs: delivery examples match the demo seed` (`e260e26`): `openapi.json` examples for the claim 201, the claim request body, `listDeliveries` 200 and `delivered` 200 use id `...0910`, order `...0703`, `SS-DEMOAAAD`, 4 items (Banana Robusta x1, Pomegranate Bhagwa x3), `itemCount` 4, `totalCents` 103000. `getDelivery` 200 is the seeded row (`delivered`, `deliveredAt` 2026-10-15T09:40:00Z, `SS-DEMOAAAB`, 3 items, 33900). Path-parameter examples and the `delivered` 409 example are unchanged. The regenerated `docs/postman/shopperstop-rider.postman_collection.json` is in the same commit. `make gen` changed nothing tracked.
- Not changed, outside 7.2's list: the `ready orders` 200 example (`/me/ready-orders`) still shows order `...0701` / `SS-DEMOAAAB`, which is not the demo order the claim flow now uses. Left as is per tasks.md; the manager may want it aligned later.
- Gates (worktree root):
  - `make test-rider` exit 0; `internal/app` ok (30.093s, includes the contract test); all other packages ok.
  - `make gen` exit 0; `make postman` exit 0 (`# fail 0`); `git status --short` clean after the docs commit.
  - `openspec validate --all --strict`: `Totals: 16 passed, 0 failed (16 items)`.
## Requests
- none
## Blockers
- none
