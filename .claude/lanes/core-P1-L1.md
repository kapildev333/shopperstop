# core-P1-L1 - core service foundation (OpenSpec change core-service-foundation)
Status: started
## Doing
Change validated on origin/main 6b63030; briefs for tasks 1 to 4 handed to the core manager, awaiting the owner's go.
## Found
- Change: `openspec/changes/core-service-foundation/` (proposal, `specs/platform/spec.md` ADDED-only, design, tasks). No `docs/design/core-P1-L1.md`: design.md carries interfaces, files and test strategy.
- Delta adds to `platform`: Configured origins are normalised; Log level is configurable; Schema migrations apply once, in order; A failed migration leaves no trace; The OpenAPI file matches the router; Graceful shutdown. No name clash with the seeded `platform` spec (now on main) or `platform-deploy-db`. Branch rebased on origin/main 6b63030; `openspec validate --all --strict` 5 passed. Archive after `platform-seed-specs` and `platform-deploy-db`.
- No `internal/pg` in Phase 1: `pgx.BeginFunc` is WithTx, error mapping waits for the first query (design Decision 9). Escalated.
- `healthz`/`readyz` are listed in `openapi.json` (Spec 1 §11) despite Spec 2 §6 "outside the contract" (Decision 12). Escalated.
- `SHOPPERSTOP_CORE_FILES_DIR` not read in Phase 1; harmless if the Makefile sets it.
- Env contract for platform (Makefile, CI): required `SHOPPERSTOP_CORE_DATABASE_URL`, `_ADDR`, `_SESSION_PEPPER` (>= 32 bytes), `_WEB_ORIGINS`; optional `_LOG_LEVEL`; tests read `SHOPPERSTOP_CORE_TEST_DATABASE_URL` (default local `shopperstop_core_test`). `core-admin migrate` needs the full env.
- Workers share this branch and worktree; suggested worker logs `.claude/lanes/core-P1-L1-t<N>.md` so this file keeps one writer.
## Requests
- to platform (via core manager): Makefile `test` core step runs `gofmt -l`, `go vet ./...`, `go test -race ./...` in `services/core` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL`; `dev` runs `go run ./cmd/core-admin migrate` then `go run ./cmd/core`; CI core job sets the same env against its Postgres service. Postman task reads `openapi.json` with `servers: [{url: "/api/core/v1"}]` and tag `platform`.
## Blockers
(none) Postgres up and healthy per the core manager (2026-10-12); tasks 3 and 4 unblocked.
