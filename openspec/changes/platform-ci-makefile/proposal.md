## Why

Every later PR needs a `ci` check, and every lane needs one command per chore (`make dev`, `make test`, `make e2e`, `make gen`, `make postman`) instead of remembering per-directory incantations (Spec 1 §6, §7, §11, §12). Today the repository has only `make db` and no workflow, and most of the directories these commands drive (`services/core`, `packages/ui`, `apps/*`, `scripts/postman.mjs`) do not exist yet. The commands must be green now and must not need editing when those directories land.

## What Changes

- Extend `Makefile` (the `db` target stays byte-identical) with `dev`, `seed`, `core`, `web`, `admin`, `test` (`test-core` then `test-web`), `e2e`, `gen`, `postman`, `prod-local`. Each guards on the directory or file it drives and, when absent, prints one line `<target>: <path> absent, skipping` and exits 0.
- Dev defaults for the five `SHOPPERSTOP_CORE_*` variables of Spec 1 §7, overridable from the shell or the command line, passed inline only to the commands that run core; `make e2e` sets its own complete environment (database `shopperstop_core_e2e`, scratch ports) so dev values never reach it.
- Add `.github/workflows/ci.yml`, workflow `ci`, jobs `core`, `web`, `e2e`, `spec` on pull requests and pushes to `main`. `core`, `web` and `e2e` skip every step after one skip message while their directory is absent; `spec` always runs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform`: ADDED requirements for the developer commands and the CI workflow (Make targets skip absent parts; make dev runs the whole stack; make test runs core then web gates; make e2e is isolated from dev; make gen and make postman regenerate committed files; make prod-local serves the builds through Caddy; CI runs four jobs; CI jobs skip absent directories; CI core job keeps generated files current; CI spec job validates OpenSpec). No existing requirement changes.

## Impact

- Area: platform. Files: `Makefile`, `.github/workflows/ci.yml`. Nothing else.
- Cross-area contracts relied on, none of which exists yet (each target skips until it does):
  - core: `services/core/go.mod` (Go version for CI), `go run ./cmd/core`, `go run ./cmd/core-admin migrate` and `seed-demo --reset`, the env variables `SHOPPERSTOP_CORE_DATABASE_URL`, `_ADDR`, `_SESSION_PEPPER`, `_FILES_DIR`, `_WEB_ORIGINS`, `_LOG_LEVEL`, `_TEST_DATABASE_URL`; `services/core/sqlc.yaml` from Phase 2 (PLAN.md D3).
  - ui: workspace scripts `lint`, `typecheck`, `test`, `build`, and `gen:api` (writes `packages/ui/src/api/core.d.ts`).
  - web and admin: workspace scripts `dev`, `lint`, `typecheck`, `test`, `build`, `e2e`; Playwright configs that start core and `vite preview` on the scratch ports this change fixes (core 18080, web 15173, admin 15174).
  - platform: root `package.json` scripts `lint`, `typecheck`, `test`, `postman`; `scripts/postman.mjs` (plan Task 12); `deploy/initdb.sql` and `deploy/docker-compose.yml` (Task 4).
- Out of scope: the content of any of those contracts, Caddy on Linux hosts (`extra_hosts`), branch protection (waits for a public repo, Spec 1 §6), release tagging, caching beyond `setup-node`/`setup-go` defaults.
