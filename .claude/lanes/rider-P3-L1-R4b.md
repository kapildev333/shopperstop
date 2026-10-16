# rider-P3-L1-R4b - review of T4b (fields before the store, request schemas)
Status: done
## Doing
Reviewed 5c0dbd7 and cbac655 in a detached checkout; verdict approve, no findings.
## Found
- Gates at cbac655: gofmt clean, go vet clean, go test -race app and auth ok, openspec validate --all --strict 15 passed.
- Test commit 5c0dbd7 red alone: names field "storeId", want email. Test also asserts no core store call.
- CreateRider order: email, name, phone, password, store, hash; admin route and rider-admin create-rider both call it.
- openapi.json: only three additionalProperties:false removed (6 remain, responses); JSON round trip byte-identical.
- Scope: test, staff.go, openapi.json, tasks.md 4b ticks, lane log only.
## Requests
none
## Blockers
none
