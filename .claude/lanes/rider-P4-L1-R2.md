# rider-P4-L1-R2 - review of rider-P4-L1-T2 (405 with Allow)
Status: done
## Doing
Reviewed 4a17f30 and df3620a in a detached checkout of df3620a. Verdict: approve.
## Found
router.go matches core's byte for byte except the "rider" comment word; router_test.go differs only in route names. Test commit red (TestWrongMethodIs405: 404 want 405). Gates green: gofmt, vet, go test -race all packages, openspec validate --all --strict (19 passed). openapi.json: one enum line; rider.d.ts: one line. Nothing probes with HEAD.
## Requests
## Blockers
