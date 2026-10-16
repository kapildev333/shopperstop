# rider-P3-L1-T3 - core client and fake (OpenSpec change rider-service-foundation, tasks 3.1 to 3.3)
Status: started
## Doing
Task 3.1 written: `services/rider/internal/core/core_test.go` (red). Next: commit `test: core client staff introspection and store read`, then `internal/core` and `internal/coretest` per design.md Interfaces.
## Found
- Red run (`go test -race ./internal/core/... ./internal/coretest/...` in `services/rider`, before any non-test code) fails at setup: `internal/core/core_test.go:17:2: no required module provides package .../internal/coretest`, and `./internal/coretest/...` has no directory. Both packages are absent, so the red is a missing-package failure, not an assertion failure.
- Tests use the real `httpx.NewRouter` for the failure cases so the context carries the request id; the log sink is a mutex-guarded buffer swapped into `slog.SetDefault`.
## Requests
- none
## Blockers
