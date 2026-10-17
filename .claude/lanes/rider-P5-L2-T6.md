# rider-P5-L2-T6 - store location and ETA ranking (task 6 of rider-dispatch)
Status: done (test `ee2e871`, feat `4f226e4`)

## Commits
- `ee2e871` test: candidates rank by ETA to the store; no location, no dispatch
- `4f226e4` feat: store location from core and ETA ranking (`core.go`, `dispatch.go`, `admin.go`, new `eta.go`; ticks 6.1 and 6.2)

Precondition: core-P5-L2 `090a4a8` (#360) is an ancestor of the lane branch.

## Red run
Before the feat, `go vet ./...` prints (as expected):
```
vet: internal/dispatch/dispatch_test.go:70:89: undefined: core.StoreLocation
vet: internal/app/dispatch_test.go:24:86: undefined: core.StoreLocation
```
`go test` build failures: `internal/dispatch` and `internal/app` `[build failed]`. No `--- FAIL` lines, because the packages do not compile. The expected note holds: `TestOrderDispatchRefusals` cannot run before compile, and passes once the package compiles (see green).

## Green run
After `4f226e4`: `go vet ./...` clean. `GOFLAGS=-count=1 make test-rider` exit 0, all packages `ok`, including `internal/dispatch` (2.2s) and `internal/app` (27.3s). `TestOrderDispatchRefusals` passes in the green run, as the brief says it does once compiled.

## Gates
- `GOFLAGS=-count=1 make test-rider`: exit 0; cmd/rider, cmd/rider-admin, app, auth, config, core, dispatch, httpx, migrate, pg, seed all `ok`.
- `make gen postman`: exit 0, changes nothing (`git status` clean after it).
- `openspec validate --all --strict`: `Totals: 20 passed, 0 failed (20 items)`.
- Race: `go test -race -count=20 ./internal/dispatch/ ./internal/app/ -run 'Tick|Accept|Offer|Dispatch'`: exit 0; `ok internal/dispatch 8.272s`, `ok internal/app 19.441s`; no `--- FAIL` and no `DATA RACE` lines.

## Found
- Nothing new beyond the brief. Scope held: only the four listed rider files, plus tasks.md and this log.

## Blockers
None.
