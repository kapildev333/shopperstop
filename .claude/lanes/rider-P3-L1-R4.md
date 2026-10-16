# rider-P3-L1-R4 - review of T4 (staff routes through core)
Status: done
## Doing
Reviewed 48c38ce and 62948a1 in a detached checkout; gates green; verdict approve with nits.
## Found
- Gates at 62948a1: gofmt clean, go vet clean, go test -race all ok, sqlc diff clean, openspec validate --all --strict 15 passed. queries/auth.sql and internal/auth/db unchanged.
- Nit: CreateRider calls core before field checks (design Decision 9 literally); no test pins the order. Fields first is cheaper and spec-compatible.
- Nit: no test for list pagination/bounds, unknown-uuid GET/PATCH 404, or store-staff list with bad store.
- Nit: RiderPatch/RiderCreate say additionalProperties false but ReadJSON/ReadPatch ignore unknown members (design Decision 10).
## Requests
none
## Blockers
none
