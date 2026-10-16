# Tasks

Two worker tasks, in order, on branch `lane/rider-P4-L2-hygiene-carryover` in `.worktrees/rider-P4-L2`. Every change is a verbatim diff in `design.md` ("Code"); a choice neither file settles is a stop-and-report. Workers write their own log `.claude/lanes/rider-P4-L2-T<n>.md` and tick this file in their `feat:` commit.

Databases: tests only, on the per-package schemas of `shopperstop_rider_test`. No `rider-admin migrate` or `seed-demo` on any other database, no `make dev`/`make seed`/`make e2e`, no `docker`.

Gates, from the worktree root with `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`: `GOFLAGS=-count=1 make test-rider` (gofmt, `go vet`, `go test -race`; the Makefile supplies `SHOPPERSTOP_RIDER_TEST_DATABASE_URL`); `make gen postman`, then `git status --short` clean after the commit; `openspec validate --all --strict`.

## 1. Sign-in sweeps expired sessions

Scope: `services/rider/queries/auth.sql`, `services/rider/internal/auth/db/auth.sql.go` (generated), `services/rider/internal/auth/auth.go`, `services/rider/internal/auth/auth_test.go`, this file (ticks). Scenario: rider-service "Expired rider sessions are deleted" / Sign-in sweeps expired sessions; the existing session tests (Expiry and sliding, Sign-out ends only that session) stay green. Starts from `services/rider/internal/auth/auth_test.go` `TestStartSessionSweepsExpired` (fails: `expired session still stored (1 rows), want swept`). Commits: `test: rider sign-in sweeps expired sessions`, `feat: rider sign-in deletes expired sessions first`.

- [x] 1.1 Apply the "Task 1: sweep, tests" diff; run `go test -race -count=1 -run TestStartSessionSweepsExpired ./internal/auth/` from `services/rider` with `SHOPPERSTOP_RIDER_TEST_DATABASE_URL` from the Makefile and see it fail; commit.
- [x] 1.2 Apply the `auth.sql` and `auth.go` hunks of "Task 1: sweep, code"; `make gen` (only `services/rider/internal/auth/db/auth.sql.go` changes, equal to the diff's hunk); run the gates; tick 1.1 and 1.2; commit.

## 2. The sign-in limiter trusts a proxy only when told

Scope: `services/rider/internal/config/config.go`, `config_test.go`, `services/rider/internal/auth/limit.go`, `services/rider/internal/auth/rider.go`, `services/rider/cmd/rider/main.go`, `services/rider/internal/app/riders_test.go`, this file (ticks). Scenarios: rider-service "The rider sign-in limiter trusts a proxy only when told" / Clients behind a trusted proxy (`TestRiderSignInRateLimitedPerForwardedIP`), Empty forwarded address falls back to the connection (`TestRiderSignInEmptyForwardedForFallsBackToConnection`), Proxy not trusted (`TestRiderSignInRateLimitedPerIP`), Unknown value refused (`TestLoadTrustProxy`); "Rider sign-in is rate limited" stays green. Starts from `services/rider/internal/config/config_test.go` `TestLoadTrustProxy` (fails to compile: `cfg.TrustProxy undefined`) and `services/rider/internal/app/riders_test.go` `TestRiderSignInRateLimitedPerForwardedIP` (fails to compile: `limit.TrustProxy undefined`). Commits: `test: rider sign-in limiter trusts a proxy only when told`, `feat: SHOPPERSTOP_RIDER_TRUST_PROXY keys the rider limiter on X-Forwarded-For`.

- [ ] 2.1 Apply the "Task 2: trusted proxy, tests" diff; run `go vet ./internal/config/ ./internal/app/` from `services/rider` and see both undefined-field errors; commit.
- [ ] 2.2 Apply the "Task 2: trusted proxy, code" diff; run the gates; tick 2.1 and 2.2; commit.

## 3. Acceptance (team lead) and verification (manager)

- [ ] 3.1 Team lead: `/opsx:verify rider-hygiene-carryover`: every scenario in the delta has a passing test, tasks 1 and 2 ticked, nothing outside design.md "Files" landed.
- [ ] 3.2 Manager: re-run the gates on the merged head; exercise the real rider service on a throwaway database: an expired session row is gone after a sign-in; with `SHOPPERSTOP_RIDER_TRUST_PROXY=yes` the service refuses to start naming the variable; with `true`, 101 sign-in attempts with distinct emails (unknown emails are fine: refused attempts count) carrying one `X-Forwarded-For` address end in 429 on the 101st, and one more from another forwarded address does not answer 429.
