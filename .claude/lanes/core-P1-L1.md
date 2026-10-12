# core-P1-L1 - core service foundation (OpenSpec change core-service-foundation)
Status: done
## Doing
Acceptance passed (/opsx:verify core-service-foundation); handed back to the core manager for the PR. Archive after merge, by chore PR.
## Found
- Acceptance 2026-10-12 on the lane branch: `gofmt -l .` empty, `go vet ./...` ok, `go test -race -count=1 -v ./...` against `shopperstop_core_test` all pass (30 tests in 5 packages); `openspec validate core-service-foundation --strict` valid; `openspec validate --all --strict` 4 passed; tasks 1.1 to 4.4 all ticked; diff from base f5c66d3 touches only `services/core/`, this change folder and `.claude/lanes/core-P1-L1*.md`; `core-admin seed-demo --reset` prints the stub line, exit 0; `core-admin bogus` exits 2.
- Scenario coverage: every scenario in the seeded `platform` spec (6 requirements, 12 scenarios) and in this delta (6 requirements, 14 scenarios) maps to a passing test; map in the acceptance report.
- Review fixes beyond the first design are now in design.md: duplicate migration numbers refused (D7), `ErrAbortHandler` re-panicked and `Vary: Origin` on every response (D2, D4), contract prefix from `servers[0].url` and an example on every response with content (D13), `ReadHeaderTimeout` 5 s (D15). Decision 1 now says exact match on the four level names.
- Health routes in `openapi.json` are PLAN.md D16; settled.
- Still out of scope, for Phase 2: `internal/pg` (error mapping, Decision 9), `SHOPPERSTOP_CORE_FILES_DIR`, demo data in `seed-demo`, `create-admin`.
- Answered platform-P1-L9's request: `core-admin seed-demo [--reset]` stub landed in task 3.
## Requests
(none open) The Makefile and CI env request to platform is met by platform-P1-L9 (task 13, PLAN.md D13).
## Blockers
(none)
