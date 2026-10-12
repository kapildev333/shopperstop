# Design

## Context
Greenfield module; see proposal.md for why. Behaviour comes from the seeded `platform` spec (platform-P1-L3: configuration fails fast, health endpoints, error envelope, request body limits, CORS, request logging) plus this change's deltas. Constraints: only `go-chi/chi/v5` (including its `middleware` subpackage), `jackc/pgx/v5` and stdlib; `log/slog`; no sqlc yet (D3); tests against the real `shopperstop_core_test` database, no mocks of the database or HTTP layer; an in-memory `fstest.MapFS` and a silent TCP listener are fakes at the process boundary (files, network peer), which Spec 1 §5.2 allows.

## Goals / Non-Goals

**Goals:** every scenario in the seeded `platform` spec and in this change's delta has a Go test; Phase 2 lanes get a router to mount on, a migration runner, a per-package test schema and a shared test server.

**Non-Goals:** `internal/pg`, rate limiting, auth, `FILES_DIR`, `seed-demo`, `create-admin`, `sqlc.yaml`, Makefile targets, CI, Postman.

## Files (all inside `services/core/`)

```
go.mod, go.sum                       module github.com/kapildev333/shopperstop/services/core, go 1.27
openapi.json                         OpenAPI 3.1, servers [{url: /api/core/v1}], tag "platform", paths /healthz, /readyz
migrations/migrations.go             package migrations; //go:embed *.sql; var FS embed.FS
migrations/0001_init.sql             baseline: a comment and `select 1;` (embed needs at least one file)
cmd/core/main.go, main_test.go       run: config, logger, pool, router, serve; serve() tested
cmd/core-admin/main.go               `core-admin migrate`; no test (wiring only, see Decisions)
internal/config/config.go, config_test.go
internal/httpx/errors.go, json.go, router.go, cors.go, json_test.go, router_test.go
internal/migrate/migrate.go, migrate_test.go
internal/testdb/testdb.go
internal/app/app.go, app_test.go, contract_test.go
```

## Interfaces

```go
// internal/config
type Config struct {
    DatabaseURL   string     // SHOPPERSTOP_CORE_DATABASE_URL, required
    Addr          string     // SHOPPERSTOP_CORE_ADDR, required
    SessionPepper string     // SHOPPERSTOP_CORE_SESSION_PEPPER, required, >= 32 bytes
    WebOrigins    []string   // SHOPPERSTOP_CORE_WEB_ORIGINS, required, trimmed, empties dropped
    LogLevel      slog.Level // SHOPPERSTOP_CORE_LOG_LEVEL, optional, default info
}
func Load(getenv func(string) string) (Config, error) // main passes os.Getenv

// internal/httpx
type Error struct {
    Status  int    `json:"-"`
    Code    string `json:"code"`
    Message string `json:"message"`
    Field   string `json:"field,omitempty"`
}
func (e *Error) Error() string
func WriteJSON(w http.ResponseWriter, status int, v any)
func WriteError(w http.ResponseWriter, r *http.Request, err error)
func ReadJSON(w http.ResponseWriter, r *http.Request, dst any) error // returns *Error on any failure
func RequestID(ctx context.Context) string
func NewRouter(origins []string) chi.Router

// internal/migrate
func Apply(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) ([]string, error) // returns versions applied this run

// internal/testdb
func Open(name string) (*pgxpool.Pool, func()) // for TestMain; panics with the cause on failure

// internal/app
func New(pool *pgxpool.Pool, origins []string) chi.Router

// cmd/core (package main)
func serve(ctx context.Context, srv *http.Server, ln net.Listener, grace time.Duration) error
```

## Decisions

1. **config.Load collects every problem.** Each missing (empty after `strings.TrimSpace`) required variable, a short pepper and a bad log level each add one message; the result is `errors.Join` of all, so one start names everything. `getenv` is a parameter so tests never depend on the developer's shell. Log level parses with `slog.Level.UnmarshalText` after checking the value is one of the four names (UnmarshalText also accepts `info+2`, which the spec does not allow). Main prints the error to stderr and exits 1.
2. **One middleware stack in `NewRouter`, in this order:** request id → log-and-recover → CORS → routes. Request id: take `X-Request-Id` when 1 to 128 bytes, else 16 random bytes from `crypto/rand` as hex; store in the context, set on the response before the handler runs. Log-and-recover wraps the writer with chi's `middleware.NewWrapResponseWriter`, `defer`s a `recover()` that logs `panic` with `requestId`, the value and `debug.Stack()`, then writes 500 `internal` "internal error" (never the panic text); after the handler it logs one line `request` with `method`, `route` (`chi.RouteContext(r.Context()).RoutePattern()`, empty for an unmatched path, never `r.URL.Path`), `status`, `durationMs`, `requestId`. `NotFound` and `MethodNotAllowed` both write 404 `not_found` "not found".
3. **All logging goes through `slog.Default()`.** `cmd/core` sets it to a JSON handler on stdout at the configured level. Tests swap it for a JSON handler on a `bytes.Buffer` and restore it with `t.Cleanup`, so httpx tests that read logs do not use `t.Parallel()`. Ceiling: a global logger; pass a `*slog.Logger` when two routers in one process need different sinks.
4. **CORS is hand-written (go-chi/cors is another module).** Allowed set built from the given origins, skipping `""`. A request whose `Origin` is in the set gets `Access-Control-Allow-Origin: <origin>` and `Vary: Origin`; if it is also a preflight (`OPTIONS` with `Access-Control-Request-Method`) it gets `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE`, `Access-Control-Allow-Headers: Authorization, Content-Type`, `Access-Control-Max-Age: 600` and 204 without reaching the routes. Anything else passes through untouched (an unknown origin's preflight ends in the 404 envelope with no CORS headers, which the browser blocks).
5. **ReadJSON reads the whole body under `http.MaxBytesReader` (1 MiB), then checks, then `json.Unmarshal`.** `*http.MaxBytesError` gives 400 `validation` "body too large"; a raw `0x00` byte or the escape `\u0000` anywhere in the body gives 400 `validation` "body contains a NUL byte"; any unmarshal error (malformed, empty, trailing data, wrong type) gives 400 `validation` "invalid JSON". Simplification: the NUL check is a byte search, so a string holding the literal six characters `\u0000` (sent as `\\u0000`) is refused too; ceiling is a false refusal on text nobody types. Unknown fields are accepted (no spec asks otherwise). The 16 MiB image limit is multipart and Phase 2's.
6. **WriteError:** `errors.As` to `*Error` writes its status and `{"error": e}`; anything else is logged with `requestId` and written as 500 `internal` "internal error". WriteJSON sets `Content-Type: application/json`, writes the status, encodes; an encode failure is logged.
7. **Migrations.** `Apply` first runs `create table if not exists schema_migrations (version text primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`. It lists `*.sql` in `fsys` root (`fs.ReadDir`, already sorted); every name must match `^\d{4}_[a-z0-9_]+\.sql$` or `Apply` returns an error naming the file before applying anything. The version is the name without `.sql` (`0001_init`). For each version not in `schema_migrations`, `pgx.BeginFunc(ctx, pool, ...)` executes the file (pgx's no-argument `Exec` uses the simple protocol, so one file may hold many statements) and inserts the version in the same transaction; an error is wrapped as `migrate <file>: <cause>` and returned at once. No advisory lock: a second concurrent runner hits the primary key on `version`, rolls back and fails. Ceiling: two migrators racing get one failure instead of a wait; add `pg_advisory_lock` when deploys run migrate from more than one process.
8. **`0001_init.sql` holds a comment and `select 1;`.** `go:embed *.sql` needs one match and Phase 1 has no tables (D3); the first Phase 2 migration is `0002_<name>.sql`.
9. **No `internal/pg` in this change.** Pool is `pgxpool.New`; a transaction is `pgx.BeginFunc`, which already commits on nil, rolls back on error and on panic, so `pg.WithTx` would be a one-line alias; the error mapping (unique and FK violation to `conflict`, no rows to `not_found`) has no caller until the first query. Ceiling: none in Phase 1; the first Phase 2 change that writes a constrained row adds `internal/pg` with its test.
10. **testdb.Open(name)** reads `SHOPPERSTOP_CORE_TEST_DATABASE_URL` (default `postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`), builds a pool whose `ConnConfig.RuntimeParams["search_path"]` is `test_<name>_<pid>`, runs `create schema` for it (identifier quoted with `pgx.Identifier.Sanitize`), and returns the pool and a cleanup that drops the schema `cascade` and closes the pool. It does not run migrations (that would make `migrate`'s own tests import cycle back into it); callers that need tables call `migrate.Apply(ctx, pool, migrations.FS)` in their TestMain. The pid suffix keeps two worktrees running the same package apart. Ceiling: a crashed run leaves its schema behind; add a sweep of `test_%` schemas older than a day if they pile up. Unreachable database is a failure, never a skip.
11. **Health handlers live in `app`.** `healthz` writes 200 `{"status":"ok"}`. `readyz` pings with a 2-second `context.WithTimeout`; success is 200 `{"status":"ok"}`, failure is 503 `internal` "database not ready". Routes are registered flat (`r.Get("/api/core/v1/healthz", ...)`), so `chi.Walk` yields full paths.
12. **Both health routes are in `openapi.json`.** Spec 1 §11 requires every served route in the file; Spec 2 §6 calls them "outside the contract". Listing them keeps the contract test free of an exception list and gives Postman a first request. Escalated to the owner in the lane report; the alternative is a two-entry skip list in the contract test.
13. **Contract test** (`contract_test.go`, package `app`): `contractProblems(routes chi.Routes, doc []byte) []string` collects `METHOD /api/core/v1<path>` from `doc.paths` (methods get, post, put, patch, delete) and from `chi.Walk`, reports each pair present on one side only, and each operation missing `summary`, `description`, a tag or a response example (`example` or non-empty `examples` on any response content). `TestContract` runs it on `New(pool, nil)` and `../../openapi.json` and fails listing every problem; two more tests feed it a toy router and a toy document to pin the scenarios. Ceiling: route patterns with chi regex (`{id:[0-9]+}`) would not match OpenAPI paths; convention is plain `{id}`.
14. **Shared test server:** `app_test.go` TestMain opens `testdb.Open("app")`, builds `New(pool, []string{"http://localhost:5173"})`, starts `httptest.NewServer`, exposes it as package var `srv`; Phase 2 route tests reuse it.
15. **Graceful shutdown in `serve`.** `serve` runs `srv.Serve(ln)` in a goroutine; on `ctx.Done()` it calls `srv.Shutdown` with a `grace` timeout and returns its error (`http.ErrServerClosed` from Serve is not an error). `main` uses `signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)`, `net.Listen("tcp", cfg.Addr)`, grace 10 s, then `pool.Close()`; a non-nil result logs and exits 1. The test drives `serve` by cancelling the context while a handler is blocked, which is what the signal does.
16. **core-admin** parses `os.Args`: `migrate` loads `config.Load(os.Getenv)`, opens the pool, runs `migrate.Apply(ctx, pool, migrations.FS)`, prints each applied version (or `nothing to apply`); any other argument prints usage to stderr and exits 2. Simplification: migrate requires the full core env, not just the database URL; ceiling is an operator having to set a pepper to migrate, split when a deploy migrates from a job without app secrets. No test: it is argument wiring; `Apply` carries the behaviour and the manager runs `core-admin migrate` against the real database at verification.

## Test strategy
One test per scenario, named in tasks.md. Packages `config`, `httpx` and `cmd/core` need no database; `migrate` and `app` open `testdb` in TestMain and fail when Postgres is unreachable. Every test runs under `go test -race ./...` from `services/core`. The `readyz` down case uses a `net.Listener` on `127.0.0.1:0` that accepts and never answers, so the 2-second timeout is exercised for real (the test takes about 2 s).

## Risks / Trade-offs
- [The `platform` capability exists only in platform-P1-L3's change] → this delta is ADDED-only with distinct requirement names; archive this change after `platform-seed-specs` is archived, and re-run `openspec validate --all --strict` on main then.
- [Postgres is not running yet (platform-P1-L4)] → tasks 1 and 2 need no database; tasks 3 and 4 wait for `make db`.
- [`go get` needs network access in the worker's sandbox] → tasks 2 and 3 add chi and pgx; a worker without network reports instead of vendoring.
- [`0001_init.sql` is a no-op] → harmless; it documents the baseline and proves the runner against the real database.
