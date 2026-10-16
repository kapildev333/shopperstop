## Why

Phase 3 adds a second service and a third app (PLAN.md D29): `services/rider` (Go, own database, port 8081, routes `/api/rider/v1`) and `apps/rider` (served under `/rider/`, dev 5175, preview 15175). Every other Phase 3 lane needs the local wiring first: the rider role and databases, Makefile targets and env for dev, test and e2e, Caddy routes, a CI job, the rider Postman collection and environment variables, and the docs. The rider area cannot start until this is on `main`, so every piece must skip while `services/rider` and `apps/rider` are absent and leave today's targets working as they do now.

## What Changes

- `deploy/initdb.sql`: role `shopperstop_rider` and databases `shopperstop_rider`, `_test`, `_e2e` owned by it. The running `shopperstop-postgres-1` already has them (D33, applied by the orchestrator); README gives existing clones a one-line command.
- `deploy/Caddyfile` and `deploy/docker-compose.yml`: `/api/rider/*` to `host.docker.internal:8081`, `/rider/*` from the rider build with the prefix stripped; Caddy mounts `../apps` once and roots each app at `/srv/apps/<app>/dist`, so a missing `apps/rider/dist` never makes compose create directories in the tree.
- `Makefile`: rider defaults (`SHOPPERSTOP_RIDER_DATABASE_URL`, `_ADDR`, `_SESSION_PEPPER`, `_WEB_ORIGINS`, `_CORE_URL`, `_CORE_SERVICE_TOKEN`, `_TEST_DATABASE_URL`) as `RIDER_ENV`; `SHOPPERSTOP_CORE_SERVICE_TOKENS` (`rider:<the rider's token>`) and origin `:5175` added to core; targets `rider`, `rider-app`, `test-rider`; `seed`, `dev`, `test`, `e2e`, `gen`, `prod-local` include rider. `E2E_ENV` gains fixed rider values (`shopperstop_rider_e2e`, `:18081`, core `http://localhost:18080`, origins 15173 to 15175). Each new recipe prints one skip line while its path is absent.
- `scripts/postman.mjs`: generates one collection per service whose `services/<name>/openapi.json` exists (core and rider); the rider collection's URLs read `{{riderBaseUrl}}`, its `/auth` and `/me` routes `{{riderToken}}`, `/admin/` routes `{{staffToken}}`, others `{{customerToken}}`; path ids after `riders` and `deliveries` read `{{riderId}}` and `{{deliveryId}}`, and a path parameter named like an id variable (`{orderId}`) reads that variable. The core collection stays byte-identical. `docs/postman/local.postman_environment.json` gains `riderBaseUrl`, `riderToken`, `riderId`, `deliveryId`.
- `.github/workflows/ci.yml`: a `rider` job like `core`'s test half, guarded by `hashFiles('services/rider/go.mod')`. The `core` job's `make gen postman` clean-tree check now also covers the rider's generated files.
- `README.md`, `CLAUDE.md`: rider URLs, targets, demo riders, the D33 one-liner, the fifth CI job.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform`: MODIFIED "One database and owner role per service", "Caddy runs only under the prod profile", the five Postman requirements ("Postman collection is generated from the contract", "Postman requests authenticate from environment tokens", "Sign-in requests store the returned token", "Path ids read environment variables", "Local Postman environment") and "Repository documentation matches the tree". ADDED rider requirements for the Makefile and CI. The Makefile and CI requirements of the still-open change `platform-ci-makefile` are not in `openspec/specs/platform` yet, so they cannot be MODIFIED here; the rider behaviour is ADDED under distinct names and does not restate them (see design.md, Decision 1).

## Impact

- Area: platform. Files: `deploy/initdb.sql`, `deploy/Caddyfile`, `deploy/docker-compose.yml`, `Makefile`, `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/local.postman_environment.json`, `.github/workflows/ci.yml`, `README.md`, `CLAUDE.md`, and this change folder (including its `check-wiring.sh`).
- Cross-area contracts relied on, none of them existing yet: `services/rider/openapi.json` (rider: `servers` `/api/rider/v1`, bearer `security`, sign-in 2xx example with a string `token`, staff routes under `/admin/`), `services/rider/cmd/rider`, `cmd/rider-admin migrate` and `seed-demo --reset` (rider; the seed must not need a running core), `apps/rider` with `dev`, `build` and `e2e` npm scripts (rider), the `gen:api` script of `packages/ui` generating both contracts (ui-P3-L2), `SHOPPERSTOP_CORE_SERVICE_TOKENS` read by core (core-P3-L1).
- Out of scope: the rider service, app and their tests; `packages/ui` `gen:api`; `.claude/commands/*.md` and `.claude/areas/*` (orchestrator, already name the area); a rider collection file (written by the first rider PR that adds `openapi.json`); Newman runs; a shared Go module (D31).
