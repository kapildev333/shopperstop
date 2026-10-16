# rider-P3-L1-T3 - core client and fake (OpenSpec change rider-service-foundation, tasks 3.1 to 3.3)
Status: done
## Doing
Tasks 3.1 to 3.3 done: `d21c58b test: core client staff introspection and store read` (red), then `feat: core client and httptest fake` (code, ticks). Awaiting reviewer.
## Found
- Red run (`go test -race ./internal/core/... ./internal/coretest/...` in `services/rider`, before any non-test code) fails at setup: `internal/core/core_test.go:17:2: no required module provides package .../internal/coretest`, and `./internal/coretest/...` has no directory. The red is a missing-package failure, not an assertion failure.
- Tests use the real `httpx.NewRouter` for the failure cases so the context carries the request id; the log sink is a mutex-guarded buffer swapped into `slog.SetDefault`.
- Core 404 on `admin/me` is treated as core failing (502 logged), not as the caller's 404; a 404 from `stores/{id}` is `ErrNotFound`.
- `Client.serviceToken` is stored but unused until rider-P3-L2 (`do` takes the bearer per call); the design signature keeps it.
- The fake counts requests under `r.Pattern` and applies `Fail` before the handler, so `Fail` covers both routes.
## Gate evidence
- `gofmt -l` on `internal/core` and `internal/coretest`: no output.
- `go vet ./internal/core/... ./internal/coretest/...`: clean.
- `go test -race ./internal/core/... ./internal/coretest/...`: `ok  	.../internal/core	1.288s`; `coretest` has no test files.
- `make test-rider`: first runs failed in T2's in-progress packages (`internal/pg`: `undefined: IsUnique`; `internal/auth`: `undefined: Auth`; then `TestContract` on sign-in, sign-out and me not yet in `openapi.json`). After a wait it passed: gofmt clean, `go vet ./...` clean, `go test -race` ok for `cmd/rider`, `cmd/rider-admin`, `internal/app`, `internal/auth`, `internal/config`, `internal/core`, `internal/httpx`, `internal/migrate`, `internal/pg`; `coretest`, `testdb`, `migrations` have no test files.
- `go test -race -count=1 ./internal/core/... ./internal/coretest/...`: `ok  	.../internal/core	1.264s`.
- `openspec validate --all --strict`: `Totals: 15 passed, 0 failed (15 items)`.
## Requests
- to rider-P3-L1 (T2, same branch): commit `3d5b366 feat: rider accounts with peppered sliding sessions` swept in my uncommitted edits to this log and to `tasks.md` (ticks 3.1 to 3.3 are already in that commit). Content is correct, but the T3 ticks and log went in under T2's message; left as is, history not rewritten.
## Blockers
