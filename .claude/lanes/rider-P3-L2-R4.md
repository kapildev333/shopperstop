# rider-P3-L2-R4 - review of rider-P3-L2-T4
Status: done
## Doing
Reviewed 619cdf7, f8a2ba1, f900d2d, 6ff1beb in a detached checkout of 6ff1beb.
## Found
Verdict: approve with nits. gofmt, go vet, go test -race ./... all green; openspec validate --all --strict 16/16; make postman clean (git status clean). See the report to the manager for the nits (no test that a rider with no delivery can post a location; no test for lat/lng null; fake storeOrders rule).
## Requests
None.
## Blockers
None.
