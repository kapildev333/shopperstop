# rider-P3-L1-T1 - rider module skeleton, plumbing, health and contract (OpenSpec change rider-service-foundation, tasks 1.1 to 1.5)
Status: done
## Doing
Tasks 1.1 to 1.5 landed on `lane/rider-P3-L1-service-foundation`: `8620a7e test: rider config, health, http plumbing and contract` (red), then `feat: rider service skeleton with health, migrations and contract` (code, openapi.json, the Postman collection, ticks). Gates green. Awaiting reviewer.
## Found
- The test commit holds the test files plus `go.mod` and `go.sum`, so the red is compile failures against missing code, not "cannot find main module".
- Red run (`go test -race ./...` in `services/rider`, before any non-test code): every package fails to build: `internal/config`: no non-test Go files; `internal/app` and `internal/migrate`: `internal/testdb` missing; `cmd/rider`: `undefined: serve`, `undefined: newHTTPServer`; `cmd/rider-admin`: `undefined: run`; `internal/httpx`: `undefined: Error`, `undefined: ReadJSON`, `undefined: WriteError`, `undefined: Page`.
- Copies from core at `5335efc` (Decision 1): `internal/httpx` (all files; `ProductIDs` and `TestWriteErrorProductIDs` dropped), `internal/migrate`, `internal/testdb` (env `SHOPPERSTOP_RIDER_TEST_DATABASE_URL`, rider default URL, advisory lock `727101`), `migrations/migrations.go`, `cmd/rider` `serve` and `newHTTPServer` (with `TestServerReadHeaderTimeout`), `internal/app` contract test. Each copied package comment, and the `serve` and `newHTTPServer` doc comments, ends with `Copied from services/core at 5335efc (D31).`
- `internal/pg` lands with task 2 (not here). `internal/auth` and `internal/core` are task 2 and 4.
- `go mod tidy` (offline) dropped `golang.org/x/crypto` from `go.mod`; it returns with task 2's password hashing.
- `cmd/rider-admin` prints only `usage: rider-admin migrate`; `create-rider` and `seed-demo` come with tasks 2 and 5.
- `openapi.json`: the `Error` schema lists the codes the rider uses (no `out_of_stock`, `not_serviceable`, no `productIds`). The rider Error envelope's `field` stays.
- `make gen` prints `gen: services/rider/sqlc.yaml absent, skipping` and leaves the tree clean (`packages/ui/src/api/core.d.ts` unchanged). `make postman` writes `docs/postman/shopperstop-rider.postman_collection.json`: two requests (`/healthz`, `/readyz`), URL host `{{riderBaseUrl}}`; core's collection unchanged.
## Gate evidence
- `go clean -testcache; make test-rider` (gofmt, vet, `go test -race`), package lines:
  ```
  ok  	github.com/kapildev333/shopperstop/services/rider/cmd/rider	1.273s
  ok  	github.com/kapildev333/shopperstop/services/rider/cmd/rider-admin	1.466s
  ok  	github.com/kapildev333/shopperstop/services/rider/internal/app	4.296s
  ok  	github.com/kapildev333/shopperstop/services/rider/internal/config	1.595s
  ok  	github.com/kapildev333/shopperstop/services/rider/internal/httpx	1.777s
  ok  	github.com/kapildev333/shopperstop/services/rider/internal/migrate	2.045s
  ?   	github.com/kapildev333/shopperstop/services/rider/internal/testdb	[no test files]
  ?   	github.com/kapildev333/shopperstop/services/rider/migrations	[no test files]
  ```
- `make postman`: `node --test scripts/postman.test.mjs` 17 pass, 0 fail.
- `openspec validate --all --strict`: `Totals: 15 passed, 0 failed (15 items)`.
- `git status --short` after `make gen` and `make postman`: only the committed files.
## Requests
- none
## Blockers
