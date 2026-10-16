# rider-P3-L2-R3 - review of rider-P3-L2-T3 (b8cf8d8)
Status: done
## Doing
Review finished; verdict approve with nits.
## Found
- Gates in a detached checkout of b8cf8d8: gofmt, go vet clean; go test -race -count=1 ./... green in every package; openspec validate --all --strict 16 passed 0 failed.
- 3541d96 is red on its own: seven new tests fail (List x3, Get, DeliveredOnce, StaysAssigned, ClaimAndDeliveredLogged).
- Precondition fixes 1f7d150 and be0dcfd are exactly the described lines.
- Delivered: lock, status check in lock, core call, then update, one tx; log after commit; no phone or email in the log.
- Nits: openapi examples for list and get show id ...0901 as assigned although the seed's 0901 is delivered; no test for 401 on the new routes, for delivered by another rider (404), or for page 2 of List.
## Requests
## Blockers
