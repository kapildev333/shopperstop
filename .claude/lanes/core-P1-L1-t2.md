# core-P1-L1 task 2 - HTTP layer (plan task 6, internal/httpx)
Status: done
## Doing
Done: tasks 2.1 to 2.4 ticked, four commits (test, feat, test, feat), gates green. Awaiting reviewer.
## Found
- Commits on `lane/core-P1-L1-core-service`: `7e3c329` test: request body limits and error envelope; `c18185a` feat: httpx JSON read and write, error envelope; `d2f95aa` test: router errors, request log and CORS; `ae08f07` feat: httpx router, request log, CORS.
- Review fixes: `875d707` test: 404 carries request id and CORS headers; then `fix: httpx re-panics ErrAbortHandler, Vary Origin on every response`. Added `TestAbortHandlerPropagates` (not in the coordinator list) so the re-panic is test-first. Gates re-run green.
- `httpx` exports: `Error` (envelope body, `Status` not serialised), `WriteJSON`, `WriteError`, `ReadJSON`, `RequestID(ctx)`, `NewRouter(origins []string) chi.Router`. `NewRouter` expects the caller to register routes flat with full paths.
- `RequestID` and its context key live in `errors.go`, not `router.go`, because `WriteError` needs them in commit 2 and the middleware that sets them lands in commit 4.
- Panics are logged as `panic` with `requestId` and `stack`, then answered 500 `internal`; `route` in the request line is the chi route pattern, empty for an unmatched path.
- Logging goes through `slog.Default()`; httpx tests that read logs swap it with `captureLogs` and must not run in parallel.
- `go.mod` now requires `github.com/go-chi/chi/v5 v5.4.0` (direct); `go.sum` added. No pgx yet (task 3).
- Gates from `services/core`: `gofmt -l .` empty; `go vet ./...` clean; `go test -race -count=1 ./...` ok for `internal/config` and `internal/httpx`.
## Requests
(none)
## Blockers
(none)
