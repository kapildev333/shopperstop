# core-P1-L1 task 4 - server, app and contract (plan task 8)
Status: done
## Doing
Done: tasks 4.1 to 4.4 ticked, four commits (test, feat, test, feat) plus the tick, gates and dev-env gate green. Awaiting reviewer.
## Found
- Commits on `lane/core-P1-L1-core-service`: `9d32d25` test: health endpoints and OpenAPI contract; `959b2af` feat: core app routes, health endpoints, openapi.json; `66f1665` test: graceful shutdown drains in-flight requests; `d052768` feat: cmd/core serve with graceful shutdown; `572c20e` chore: tick tasks 4.1-4.4; `ccbf5b5` chore: lane log for task 4.
- Review fixes (coordinator verdict pass with findings): `1a271e0` test: contract uses servers url, every response needs an example, healthz needs no database (red: two contract tests failed); `aea69be` fix: contract prefix from servers url, per-response examples, ReadHeaderTimeout, test race. `contractProblems` now joins paths with `servers[0].url` and flags each response with content but no example; `TestReadyzWhenDatabaseIsDown` pins healthz 200 with the pool down and its accept loop owns its conns; `cmd/core` builds the server with `newHTTPServer` (ReadHeaderTimeout 5 s).
- `app.New(pool, origins) chi.Router` registers `GET /api/core/v1/healthz` and `/api/core/v1/readyz` flat on `httpx.NewRouter`. `readyz` pings with a 2 s timeout; a failure logs `readyz: database ping failed` with `err` and `requestId`, then answers 503 `internal` "database not ready".
- `contractProblems(routes, doc)` lives in `internal/app/contract_test.go` (test-only helper, so it went in the red commit). It reports `METHOD /api/core/v1/path: ...` for served-not-documented, documented-not-served, missing summary, description, tag or response example.
- `openapi.json`: OpenAPI 3.1.0, `servers` `/api/core/v1`, tag `platform`, paths `/healthz` and `/readyz`, `components.schemas.Status` and `Error` (the envelope, `code` enum of the nine Spec codes). Both operations carry `operationId`, a 200 example; `readyz` also a 503 example.
- `cmd/core`: `run` loads config, opens the pool with `pgxpool.New`, listens on `SHOPPERSTOP_CORE_ADDR`, and calls `serve(ctx, srv, ln, 10s)` under `signal.NotifyContext(SIGINT, SIGTERM)`; the pool is closed on return. Logs are JSON on stdout at `SHOPPERSTOP_CORE_LOG_LEVEL`.
- Gates from `services/core`: `gofmt -l .` empty; `go vet ./...` clean; `SHOPPERSTOP_CORE_TEST_DATABASE_URL=... go test -race -count=1 ./...` all ok (app 3.6 s including the 2 s readyz timeout). `go mod tidy` left go.mod and go.sum unchanged.
- Dev-env gate (binary `/private/tmp/claude-501/core-bin` built from this branch, dev env, :8080): `curl localhost:8080/api/core/v1/readyz` gave `{"status":"ok"}`; `GET /api/core/v1/nope` gave `HTTP/1.1 404 Not Found`, `{"error":{"code":"not_found","message":"not found"}}`; SIGINT gave exit 0 and log line `core stopped`.
- Judgement calls: `TestReadyzWhenDatabaseIsDown` uses its own `httptest` server over a pool to the silent listener (the shared `srv` has a healthy pool). The silent listener keeps accepted conns in a slice so they stay open for the test. `ReadHeaderTimeout` (5 s) was added after the review, so a slow-header client cannot hold shutdown for the whole grace.
- Both health routes are listed in `openapi.json` per Decision 12; still the escalated point (Spec 2 §6 says "outside the contract").
## Requests
(none)
## Blockers
(none)
