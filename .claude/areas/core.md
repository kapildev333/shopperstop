# core
Scope: `services/core/`
Depends on: platform (`deploy/initdb.sql` and `make db` from task 4, landed #4; `.github/workflows/ci.yml` core job from task 13, landed #15; CI blocked by account billing, see PLAN.md)
Spec: Spec 1 §3, §4, §11; Spec 2 §9, §10, §12, §13; plan tasks 5, 6, 7, 8 (sequential, one module, one feature)
## Doing
core-P1-L1 worker 1 (config, plan task 5) running on `lane/core-P1-L1-core-service`. No `make e2e` from core in Phase 1.
## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| core-P1-L1 | plan tasks 5-8: OpenSpec change `core-service-foundation` (config, httpx, migrations + testdb + core-admin, app + openapi.json + cmd/core) | `services/core/`, `openspec/changes/core-service-foundation/` | change proposed and validated 2026-10-12, seen by the orchestrator; workers run in order 1→4 under D13, reviewer after each landing, then team-lead acceptance; one PR for the feature |
## Requests
- to platform (accepted into platform-P1-L9, D13-D15): `make test-core` runs `gofmt -l .`, `go vet ./...`, `go test -race ./...` from `services/core` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL` (default `postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`); `make dev`/`make e2e` run `core-admin migrate`, `core-admin seed-demo --reset`, then `cmd/core` with the full `SHOPPERSTOP_CORE_*` env (`DATABASE_URL`, `ADDR`, `SESSION_PEPPER` ≥32 bytes, `WEB_ORIGINS`; `LOG_LEVEL` optional); CI core job uses the same env against its Postgres; Postman reads `openapi.json` with `servers: [{url: "/api/core/v1"}]`, relative paths, tag `platform`.
- from platform (accepted): Phase 1 `core-admin seed-demo [--reset]` stub printing `seed-demo: no demo data yet`, exit 0; e2e runs core on :18080 against `shopperstop_core_e2e` with origins 15173/15174, all via env.
- to ui: `services/core/openapi.json` lands with core-P1-L1 (Phase 1 holds only `healthz` and `readyz`); core announces when it is on `origin/main`.
## Found
- Core defaults taken by the manager (team-lead escalations): health routes listed in `openapi.json` (Spec 1 §11 wins over Spec 2 §6 "outside the contract"); `internal/pg` deferred to Phase 2 (`pgx.BeginFunc` covers `WithTx`, error mapping has no caller yet); `core-admin migrate` loads the full env; `SHOPPERSTOP_CORE_FILES_DIR` unread in Phase 1.
- Design ceilings named in `design.md`: no advisory lock in the migration runner; `0001_init.sql` is a no-op baseline; per-package test schemas `test_<pkg>_<pid>` are not cleaned after a crash; hand-written CORS; wrong method answers 404 `not_found`.
- `psql` is not installed on this host; ad-hoc checks go through pgx from Go. `docker exec` is denied by the guard hook, as intended.
- Archive order: `core-service-foundation` archives after the platform archives (done, #5 and #6) and its own PR.
## Backlog
- Phase 2: `internal/pg` error mapping with the first query; `sqlc.yaml` and `queries/` (D3); `core-admin seed-demo` real data and `create-admin`; auth, rate limiter, files dir.
