# rider-P3-L1-R5 - review of T5 (operator commands and demo seed)
Status: done
## Doing
Reviewed d64602d + 10cac32 in a detached checkout. Verdict: approve with nits. Gates: gofmt, vet, go test -race ./... (all ok), openspec validate --all --strict (15 passed).
## Found
- nit: TestRunRefusesBadArguments dropped the old `{}` and `migrate extra` cases; no case for `seed-demo extra`.
- nit: seed imports auth (HashPassword), auth imports core: transitive only; design decision 13 (no direct import, no client) holds; acceptable.
## Requests
- none
## Blockers
- none
