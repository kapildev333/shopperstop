# rider-P3-L1-T1 - rider module skeleton, plumbing, health and contract (OpenSpec change rider-service-foundation, tasks 1.1 to 1.5)
Status: started
## Doing
Task 1.1 committed as `test: rider config, health, http plumbing and contract` (red). Next: 1.2 the copies, config, app, cmd and migration (feat commit).
## Found
- Test commit holds the test files plus `go.mod` and `go.sum` (copied from core at the same versions, module renamed), so the red is compile failures against missing code, not "cannot find main module".
- Red run, `go test -race ./...` in `services/rider` with no non-test code: every package fails to build (`internal/config`: no non-test Go files; `internal/app`, `internal/migrate`: `internal/testdb` missing; `cmd/rider`: `undefined: serve`, `undefined: newHTTPServer`; `cmd/rider-admin`: `undefined: run`; `internal/httpx`: `undefined: Error`, `undefined: ReadJSON`, `undefined: WriteError`, `undefined: Page`).
- Dropped from the httpx copy: `TestWriteErrorProductIDs` (design Decision 1), with its `ProductIDs` field to go in the feat commit.
- `cmd/rider-admin` test checks `usage: rider-admin migrate` only; the DB-backed admin tests land with rider-P3-L1 tasks 2 and 5.
## Requests
- none
## Blockers
