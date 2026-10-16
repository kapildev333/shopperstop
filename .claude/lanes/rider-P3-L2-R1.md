# rider-P3-L2-R1 - review of rider-P3-L2-T1 (7ddae1b, 11b03ae)
Status: done
## Doing
Verdict: approve with nits (details in the reviewer report).
## Found
- Gates on detached 11b03ae: gofmt clean, go vet clean, go test -race -count=1 ./... all ok, openspec validate --all --strict 16 passed.
- Order, OrderAddress, OrderItem field names and types match core's openapi.json; status body and codes match core's SetStatus.
- Fake differs from core: no 400 for invalid status or non-uuid actor id/name or non-uuid path ids; unknown store lists empty (core 404); test fix folded into the feat commit.
## Requests
None.
## Blockers
None.
