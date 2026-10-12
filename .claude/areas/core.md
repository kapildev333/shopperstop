# core
Scope: `services/core/`
Depends on: platform (`deploy/initdb.sql` and `make db` from task 4, landed #4; `.github/workflows/ci.yml` core job from task 13, landed #15; CI blocked by account billing, see PLAN.md)
Spec: Spec 1 §3, §4, §11; Spec 2 §9, §10, §12, §13; plan tasks 5, 6, 7, 8 (sequential, one module, one feature)
## Doing
Nothing running. Phase 1 core work is complete; Phase 2 (Spec 2) starts when the orchestrator writes the work package. No `make e2e` from core in Phase 1.
## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| core-P1-L1 | plan tasks 5-8: OpenSpec change `core-service-foundation` (config, httpx, migrations + testdb + core-admin, app + openapi.json + cmd/core) | `services/core/`, `openspec/changes/core-service-foundation/` | done 2026-10-12: PR https://github.com/kapildev333/shopperstop/pull/23 (a182e00); 4 workers, 4 reviews (all findings applied test-first), team-lead acceptance passed; manager verified `make test-core`, `core-admin migrate`/`seed-demo`, real server on :8080 (healthz, readyz, 404 envelope, CORS, request id, SIGINT exit 0); archive PR https://github.com/kapildev333/shopperstop/pull/24 |
## Requests
- to platform (accepted into platform-P1-L9, D13-D15): `make test-core` runs `gofmt -l .`, `go vet ./...`, `go test -race ./...` from `services/core` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL` (default `postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`); `make dev`/`make e2e` run `core-admin migrate`, `core-admin seed-demo --reset`, then `cmd/core` with the full `SHOPPERSTOP_CORE_*` env (`DATABASE_URL`, `ADDR`, `SESSION_PEPPER` ≥32 bytes, `WEB_ORIGINS`; `LOG_LEVEL` optional); CI core job uses the same env against its Postgres; Postman reads `openapi.json` with `servers: [{url: "/api/core/v1"}]`, relative paths, tag `platform`.
- from platform (accepted): Phase 1 `core-admin seed-demo [--reset]` stub printing `seed-demo: no demo data yet`, exit 0; e2e runs core on :18080 against `shopperstop_core_e2e` with origins 15173/15174, all via env.
- to ui and admin: `services/core/openapi.json` is on `origin/main` since #23 (Phase 1 holds only `healthz` and `readyz`, `servers` `/api/core/v1`, tag `platform`).
## Found
- core-P1-L1 landed as #23 with CI blocked by account billing (zero-step job failures); gates were run locally and pasted in the PR per the orchestrator's rule.
- Reviewer findings applied during the lane and now in design.md: duplicate migration versions refused; `ErrAbortHandler` re-panicked and `Vary: Origin` on every response; contract test takes its prefix from `servers[0].url` and requires an example on every response with content; `ReadHeaderTimeout` 5 s on the server.
- Core defaults taken by the manager (team-lead escalations): health routes listed in `openapi.json` (Spec 1 §11 wins over Spec 2 §6 "outside the contract"); `internal/pg` deferred to Phase 2 (`pgx.BeginFunc` covers `WithTx`, error mapping has no caller yet); `core-admin migrate` loads the full env; `SHOPPERSTOP_CORE_FILES_DIR` unread in Phase 1.
- Design ceilings named in `design.md`: no advisory lock in the migration runner; `0001_init.sql` is a no-op baseline; per-package test schemas `test_<pkg>_<pid>` are not cleaned after a crash; hand-written CORS; wrong method answers 404 `not_found`.
- `psql` is not installed on this host; ad-hoc checks go through pgx from Go. `docker exec` is denied by the guard hook, as intended.
- Archive order: `core-service-foundation` archives after the platform archives (done, #5 and #6) and its own PR.
## Backlog
- Phase 2 contract rules for `openapi.json` (orchestrator, D13/D19/D20, from platform-P1-L8 Postman and ui-P1-L2 types), binding for every Phase 2 lane and brief:
  - D19: a lane that changes `openapi.json` runs `make gen` (or `npm run gen:api --workspace packages/ui`; Node >= 22.12, user-space node at `~/.local/node-v22.23.3/bin`) and commits the regenerated `packages/ui/src/api/core.d.ts` in the same PR as a mechanical change; never hand-edited; reviewers treat it as generated. It is the one cross-area file a core lane may touch.
  - Declare `components.securitySchemes.bearer` (type http, scheme bearer) and put `security: [{bearer: []}]` on every authenticated operation (Postman derives "needs a token" from it). Add a contract-test assertion that every non-public operation declares `security`.
  - Every staff route lives under `/admin/` (Postman picks `{{staffToken}}` by that prefix, `{{customerToken}}` otherwise).
  - Sign-in and register 2xx response examples carry a string `token` (triggers Postman's token-storing script).
  - D20: `seed-demo` uses fixed, documented ids for the demo store, products, addresses and orders so `docs/postman/local.postman_environment.json` can ship `storeId`, `productId`, `addressId`, `orderId` and the collection runs top to bottom against `make dev` (Spec 1 §11).
- Phase 2: `internal/pg` error mapping with the first query; `sqlc.yaml` and `queries/` (D3); `core-admin seed-demo` real data and `create-admin`; auth, rate limiter, files dir.
