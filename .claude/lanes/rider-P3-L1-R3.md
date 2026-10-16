# rider-P3-L1-R3 - review of T3 (core client and fake)
Status: done
## Doing
Reviewed d21c58b and 675005b in a detached checkout; gates green; verdict approve with nits.
## Found
- Gates at 675005b: gofmt clean, go vet clean, go test -race all ok (core pkg ok), openspec validate --all --strict 15 passed. Red commit d21c58b fails to build (no coretest package).
- Nit: remember() prunes by full scan on every insert; design says prune above 10 000 entries. Not tested, no concurrency test.
- Nit: the admin/me 404 -> 502 path has no test.
## Requests
none
## Blockers
none
