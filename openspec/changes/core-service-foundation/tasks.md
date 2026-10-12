# Tasks

Four worker lanes, run in order on branch `lane/core-P1-L1-core-service` in `.worktrees/core-P1-L1`. Gates for every task, from `services/core`: `gofmt -l .` prints nothing, `go vet ./...` passes, `go test -race ./...` passes. Design: `design.md` (numbers below are its Decisions).

## 1. Configuration (plan task 5; no database)

Scope: `services/core/go.mod`, `services/core/internal/config/`. Scenarios: platform "Configuration fails fast" (both), "Configured origins are normalised" (Only commas), "Log level is configurable" (both). Start from `internal/config/config_test.go` `TestLoadNamesEveryMissingVariable`. Commits: `test: configuration fails fast naming every problem`, then `feat: core config from SHOPPERSTOP_CORE_ env`.

- [ ] 1.1 Create `services/core/go.mod` (`module github.com/kapildev333/shopperstop/services/core`, `go 1.27`) and `config_test.go` with `TestLoadNamesEveryMissingVariable`, `TestLoadRefusesShortPepper`, `TestLoadTrimsOrigins` (`"http://a, http://b,"` gives `[http://a http://b]`; `","` is named missing), `TestLoadLogLevel` (unset is info, `debug` is debug, `loud` names the variable); verify `go test ./internal/config` fails, commit
- [ ] 1.2 Implement `config.Load` per Decision 1; verify the four tests and the gates pass, commit

## 2. HTTP layer (plan task 6; no database)

Scope: `services/core/go.mod`, `go.sum`, `services/core/internal/httpx/`. Scenarios: platform "Request body limits" (both), "Error envelope" (both), "CORS" (both), "Configured origins are normalised" (Spaces and a trailing comma, Empty origin), "Request logging" (both). Start from `internal/httpx/json_test.go` `TestReadJSONRejectsNUL`. Commits: `test: request body limits and error envelope`, `feat: httpx JSON read and write, error envelope`, `test: router errors, request log and CORS`, `feat: httpx router, request log, CORS`.

- [ ] 2.1 `json_test.go`: `TestReadJSONRejectsNUL`, `TestReadJSONTooLarge` (1 MiB + 1 byte gives 400 `validation` "body too large"), `TestReadJSONRejectsMalformed`, `TestWriteErrorEnvelope` (`*Error` keeps status, code, field; a plain error becomes 500 `internal`); verify they fail, commit
- [ ] 2.2 `errors.go`, `json.go` per Decisions 5 and 6; verify 2.1 passes, commit
- [ ] 2.3 `router_test.go` (routes registered by the test on `NewRouter`, default logger swapped per Decision 3): `TestUnknownRouteIsNotFound`, `TestPanicIsInternal` (500 `internal`, log has `panic` and `requestId`), `TestLogUsesRoutePattern` (route `/api/core/v1/stores/{id}`, request to a uuid path, log `route` is the pattern), `TestRequestIDEchoed` (`abc` echoed and logged; absent header gets a generated one), `TestCORSAllowsConfiguredOrigin` (origins `http://a`, `http://b` as config would give them; `Origin: http://b` allowed; preflight gets 204 and the methods and headers), `TestCORSRejectsUnknownOrigin` (unknown and empty `Origin` get no `Access-Control-Allow-Origin`); `go get github.com/go-chi/chi/v5`; verify they fail, commit
- [ ] 2.4 `router.go`, `cors.go` per Decisions 2 to 4; verify all httpx tests and the gates pass, commit

## 3. Migrations and test database (plan task 7; needs Postgres)

Scope: `services/core/go.mod`, `go.sum`, `services/core/internal/migrate/`, `services/core/internal/testdb/`, `services/core/migrations/`, `services/core/cmd/core-admin/`. Scenarios: platform "Schema migrations apply once, in order" (all three), "A failed migration leaves no trace" (both). Start from `internal/migrate/migrate_test.go` `TestApplyRollsBackFailedMigration`. Commits: `test: migrations apply once in order and roll back on failure` (includes `internal/testdb/testdb.go`, test infrastructure with no spec behaviour), then `feat: migration runner, baseline migration, core-admin migrate and seed-demo stub`.

- [ ] 3.1 `go get github.com/jackc/pgx/v5`; `testdb.go` per Decision 10; `migrate_test.go` (external package `migrate_test`, TestMain with `testdb.Open("migrate")`, each test first drops `schema_migrations` and its own tables, files from `fstest.MapFS`): `TestApplyRecordsVersions` (0001 and 0002 applied in order and recorded; second run returns none), `TestApplyRollsBackFailedMigration` (0002 creates table `t2` then selects from a missing table: error names `0002_b.sql`, `t2` absent, only `0001_a` recorded; fixed 0002 applies on the next call), `TestApplyRejectsMisnamedFile` (`add-stores.sql` named, nothing recorded); verify they fail, commit
- [ ] 3.2 `migrate.go` per Decision 7, `migrations/migrations.go` and `0001_init.sql` per Decision 8, `cmd/core-admin/main.go` per Decision 16 with `migrate` and the `seed-demo [--reset]` stub (no test: argument wiring, behaviour is `Apply`; the stub has no behaviour); verify the tests and gates pass, `go run ./cmd/core-admin migrate` with the dev env applies `0001_init` then reports nothing to apply, `go run ./cmd/core-admin seed-demo --reset` prints `seed-demo: no demo data yet` and exits 0, and `go run ./cmd/core-admin bogus` exits 2, commit

## 4. Server, app and contract (plan task 8; needs Postgres)

Scope: `services/core/openapi.json`, `services/core/internal/app/`, `services/core/cmd/core/`. Scenarios: platform "Health endpoints" (both), "The OpenAPI file matches the router" (all three), "Graceful shutdown". Start from `internal/app/app_test.go` `TestReadyzWhenDatabaseAnswers`. Commits: `test: health endpoints and OpenAPI contract`, `feat: core app routes, health endpoints, openapi.json`, `test: graceful shutdown drains in-flight requests`, `feat: cmd/core serve with graceful shutdown`.

- [ ] 4.1 `app_test.go` (TestMain and shared `srv` per Decision 14): `TestHealthz`, `TestReadyzWhenDatabaseAnswers`, `TestReadyzWhenDatabaseIsDown` (pool to a silent listener per Test strategy: 503 `internal` within about 2 s); `contract_test.go` per Decision 13: `TestContract`, `TestContractNamesUndocumentedRoute`, `TestContractNamesUnservedPath`, `TestContractNamesMissingExample`; verify they fail, commit
- [ ] 4.2 `app.go` per Decision 11, `openapi.json` per Decision 12 (OpenAPI 3.1, `servers` `/api/core/v1`, tag `platform`, both routes with summary, description, 200 example, and for `readyz` the 503 envelope example; `components.schemas.Error`); verify 4.1 passes, commit
- [ ] 4.3 `cmd/core/main_test.go`: `TestServeDrainsInFlightRequest` (handler blocks on a channel; cancel the context while the request is in flight; release; response is 200 with its body and `serve` returns nil); verify it fails, commit
- [ ] 4.4 `cmd/core/main.go` per Decision 15; verify the gates pass, and with the dev env `go run ./cmd/core` answers `curl -s localhost:8080/api/core/v1/readyz` with `{"status":"ok"}` and exits 0 on Ctrl-C, commit

## Workflow follow-up

- Team lead runs `/opsx:verify core-service-foundation` once 1 to 4 are ticked.
- Archive after `platform-seed-specs` is archived and this feature's PR has merged.
