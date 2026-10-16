## Context

See proposal.md for why. Inputs read: PLAN.md D29 to D35, `.claude/areas/platform.md` (Phase 3 work package), `.claude/areas/rider.md` (env names, ports, demo ids), `openspec/specs/platform/spec.md`, the open change `platform-ci-makefile` (its Makefile and CI requirements are not archived, see Decision 1), `Makefile`, `deploy/*`, `.github/workflows/ci.yml`, `scripts/postman.mjs` and its test, `README.md`, `CLAUDE.md`.

Facts this design relies on, checked by the team lead on 2026-10-15:

- The running `shopperstop-postgres-1` already has role `shopperstop_rider` and its three databases (D33): a pgx client as `shopperstop_rider` on `shopperstop_rider_test` answers `select 1`, and the role owns exactly `shopperstop_rider`, `shopperstop_rider_e2e`, `shopperstop_rider_test`.
- Every artifact below was prototyped in a scratch copy of the tree: `check-wiring.sh deploy make ci` passes with the files of this design and fails (62 FAIL lines) on `origin/main`; the generator below writes a core collection byte-identical to the committed one, prints the rider skip line, and passes the existing 11 tests; with an inline rider fixture it gives `{{riderBaseUrl}}` hosts, `riderToken` on `/auth` and `/me*`, `staffToken` on `/admin/riders/{id}` with `id` = `{{riderId}}`, `deliveryId` on `/me/deliveries/{id}`, `customerToken` and `orderId` = `{{orderId}}` on `/orders/{orderId}/delivery`.
- Docker compose creates a missing bind-mount source directory on the host (short volume syntax). Mounting `../apps/rider/dist` before the rider app exists would create `apps/rider/dist`, after which `test -d apps/rider` is true and `make rider-app` and `npm` workspaces break.
- A recipe line containing `$(MAKE)` runs even under `make -n`. A line that has both `$(MAKE)` and the compose command would start containers on a dry run.
- The guard hook denies any Bash command whose text contains the compose command, `docker-compose` or `docker exec`, heredocs and `git add <that path>` included. Write those files with the Write or Edit tool and stage with `git add deploy` or `git add -A`.

## Goals / Non-Goals

**Goals:** every requirement in `specs/platform/spec.md`; the rider area can start on `main` with no platform edit: its `cmd/rider`, `cmd/rider-admin`, `openapi.json`, `sqlc.yaml`, `apps/rider` are picked up by existing targets the moment they exist; `make dev`, `make test`, `make e2e`, `make gen`, `make postman` on today's tree do what they did, plus one skip line per rider step.

**Non-Goals:** anything under `services/rider`, `apps/rider` or `packages/ui` (the `gen:api` script is ui-P3-L2's); `.claude/commands/*` and `.claude/areas/*` (orchestrator, already updated); a committed rider collection (the first rider PR with `openapi.json` runs `make postman` and commits it); Newman runs; the e2e Playwright wiring of `apps/rider` (rider-P3-L3).

## Decisions

1. **ADDED rider requirements instead of MODIFIED Makefile and CI requirements.** The Makefile and CI requirements live only in the unarchived change `platform-ci-makefile` (kept open until a first green CI run, blocked by billing), so `openspec validate` refuses MODIFIED on them (it checks MODIFIED against `openspec/specs/platform`). The rider behaviour is ADDED under distinct names ("Rider make targets skip...", "make dev runs the rider service and app", "make test runs the rider gates", "make e2e gives the rider an isolated environment", "make gen runs the rider sqlc", "make prod-local runs the rider behind Caddy", "CI runs a rider job"). Ceiling: `platform-ci-makefile`'s "CI runs four jobs" says "exactly the jobs core, web, e2e and spec", which this change makes false; the orchestrator archives `platform-ci-makefile` with that requirement amended to five jobs (escalated in the lane report). Requirements that are in `openspec/specs/platform` (initdb, Caddy, Postman, docs) are MODIFIED.
2. **One `E2E_ENV` for both services.** Every `make e2e` command (core migrate and seed, rider migrate and seed, each workspace's `npm run e2e`) gets all core and rider e2e values. Each Playwright config starts the servers it needs with the inherited env, so the rider suite starts core and rider and the web suite ignores the rider values. Simpler than per-service env strings; ceiling: none known.
3. **The service token is one value.** `SHOPPERSTOP_CORE_SERVICE_TOKENS ?= rider:$(SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN)`, so overriding the rider's token keeps core in step. Dev and e2e tokens differ. Core ignores the variable until core-P3-L1 reads it.
4. **The e2e outer guard is unchanged** (`services/core` and `apps/web` or `apps/admin`). `apps/rider` cannot be useful without core, and web and admin exist on `main`; adding it would only rename the skip line. The CI `e2e` job's guard stays the same for the same reason (the work package's "e2e guard includes apps/rider" is dropped as a no-op). Rider's migrate and seed in `make e2e` skip on their own.
5. **Caddy mounts `../apps` once** at `/srv/apps` and roots each app at `/srv/apps/<app>/dist` (fact 3). Only the `dist` directories are served, as before.
6. **prod-local runs the servers with `@$(MAKE) --no-print-directory -j2 core rider` on its own recipe line** (fact 4). Ceiling: when `services/core` exists but an app does not, the first line prints its skip line and the second still starts core; this tree never occurs on `main`.
7. **The Postman generator takes no CLI argument.** It loops over `core` and `rider` and skips a service whose contract is absent, printing `postman: services/<service>/openapi.json absent, skipping`. `generate(spec, service = 'core')` takes the service name; the per-service table holds the base-URL variable and the token that the service's own `/auth` and `/me` routes read (`customerToken` for core, `riderToken` for rider), so core's output does not change. The converter always roots URLs at `{{baseUrl}}`; the rider collection's text replaces `"{{baseUrl}}"` with `"{{riderBaseUrl}}"` (an exact quoted-string match, which occurs only as URL hosts).
8. **Id variables:** `riders` → `riderId`, `deliveries` → `deliveryId` join the table; a path parameter named exactly like the variable for its segment (`{orderId}` after `orders`) also reads it. Core has only `{id}`, `{kind}`, `{name}`, `{slug}` path parameters, so its output does not change.
9. **Environment ids are fixed now** from `.claude/areas/rider.md`: `riderId` `00000000-0000-4000-8000-000000000801` (rider1-koramangala), `deliveryId` `00000000-0000-4000-8000-000000000901` (the demo delivery). The four rider variables are appended after `orderId`; core's seed test reads only its own four keys, so it is unaffected. Request to rider: its seed test ties these two values to the seed, as core's does.
10. **D33 one-liner for an existing clone uses the container's own `psql`** (the owner's machine has none): `grep shopperstop_rider deploy/initdb.sql | docker exec -i shopperstop-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres`. One line, no Go program; the README already sends people to `docker exec ... psql` for looking at data. Agents never run it (the hook denies it); it is for people.
11. **CI `rider` job runs only `make test-rider`.** The `core` job's `make gen postman` clean-tree check already regenerates every committed generated file, the rider's included (rider sqlc runs there because sqlc is installed whenever `services/core/sqlc.yaml` exists, the `gen:api` script covers `rider.d.ts` once ui-P3-L2 lands, and the generator writes the rider collection). So the rider job needs no Node.
12. **The test for the files that have no test framework is `check-wiring.sh`**, committed with this change (precedent: `platform-readme-claude/check-docs.sh`). It has four sections: `deploy`, `make` (real runs only of targets that skip, `make -n` otherwise, plus a scratch copy of the Makefile with every directory present), `ci` (YAML shape of the `rider` job) and `docs` (the archived docs check plus the rider strings). The team lead committed it before any worker starts, so each task's red step is that script failing on the unchanged tree.

## The files

### deploy/initdb.sql (append four lines)

```sql
create role shopperstop_rider login password 'shopperstop_rider';
create database shopperstop_rider owner shopperstop_rider;
create database shopperstop_rider_test owner shopperstop_rider;
create database shopperstop_rider_e2e owner shopperstop_rider;
```

### deploy/Caddyfile (whole file)

```
:80 {
	handle /api/core/* {
		reverse_proxy host.docker.internal:8080
	}
	handle /api/rider/* {
		reverse_proxy host.docker.internal:8081
	}
	handle /admin/* {
		uri strip_prefix /admin
		root * /srv/apps/admin/dist
		try_files {path} /index.html
		file_server
	}
	handle /rider/* {
		uri strip_prefix /rider
		root * /srv/apps/rider/dist
		try_files {path} /index.html
		file_server
	}
	handle {
		root * /srv/apps/web/dist
		try_files {path} /index.html
		file_server
	}
}
```

### deploy/docker-compose.yml (caddy volumes only)

The two lines `- ../apps/web/dist:/srv/web:ro` and `- ../apps/admin/dist:/srv/admin:ro` become the one line `- ../apps:/srv/apps:ro`. Nothing else changes.

### Makefile (whole file)

Recipe lines start with a tab. `git diff origin/main -- Makefile` shows only the rider lines, the `.PHONY` line, the `:5175` origins, `SHOPPERSTOP_CORE_SERVICE_TOKENS`, `-j3` to `-j5`, and the prod-local rewrite; the `db` target is byte-identical.

```make
# Local development. Needs Docker, Go and Node (see README.md). GNU make 3.81 or newer.
SHELL = /bin/sh
.PHONY: db dev seed core rider ui web admin rider-app test test-core test-rider test-web e2e gen postman prod-local

# Spec 1 §7 defaults; override from the shell or the command line. Passed inline to core commands only.
SHOPPERSTOP_CORE_DATABASE_URL ?= postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core?sslmode=disable
SHOPPERSTOP_CORE_ADDR ?= :8080
SHOPPERSTOP_CORE_SESSION_PEPPER ?= dev-pepper-dev-pepper-dev-pepper-00
SHOPPERSTOP_CORE_FILES_DIR ?= $(CURDIR)/services/core/data/files
SHOPPERSTOP_CORE_WEB_ORIGINS ?= http://localhost:5173,http://localhost:5174,http://localhost:5175
SHOPPERSTOP_CORE_TEST_DATABASE_URL ?= postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable
# Rider service (D29, D30): its own database and port; it calls core with a service token that core accepts.
SHOPPERSTOP_RIDER_DATABASE_URL ?= postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider?sslmode=disable
SHOPPERSTOP_RIDER_ADDR ?= :8081
SHOPPERSTOP_RIDER_SESSION_PEPPER ?= dev-rider-pepper-dev-rider-pepper-00
SHOPPERSTOP_RIDER_WEB_ORIGINS ?= http://localhost:5173,http://localhost:5174,http://localhost:5175
SHOPPERSTOP_RIDER_CORE_URL ?= http://localhost:8080
SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN ?= dev-rider-service-token-dev-rider-00
SHOPPERSTOP_RIDER_TEST_DATABASE_URL ?= postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable
SHOPPERSTOP_CORE_SERVICE_TOKENS ?= rider:$(SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN)
CORE_ENV = SHOPPERSTOP_CORE_DATABASE_URL='$(SHOPPERSTOP_CORE_DATABASE_URL)' SHOPPERSTOP_CORE_ADDR='$(SHOPPERSTOP_CORE_ADDR)' SHOPPERSTOP_CORE_SESSION_PEPPER='$(SHOPPERSTOP_CORE_SESSION_PEPPER)' SHOPPERSTOP_CORE_FILES_DIR='$(SHOPPERSTOP_CORE_FILES_DIR)' SHOPPERSTOP_CORE_WEB_ORIGINS='$(SHOPPERSTOP_CORE_WEB_ORIGINS)' SHOPPERSTOP_CORE_SERVICE_TOKENS='$(SHOPPERSTOP_CORE_SERVICE_TOKENS)'
RIDER_ENV = SHOPPERSTOP_RIDER_DATABASE_URL='$(SHOPPERSTOP_RIDER_DATABASE_URL)' SHOPPERSTOP_RIDER_ADDR='$(SHOPPERSTOP_RIDER_ADDR)' SHOPPERSTOP_RIDER_SESSION_PEPPER='$(SHOPPERSTOP_RIDER_SESSION_PEPPER)' SHOPPERSTOP_RIDER_WEB_ORIGINS='$(SHOPPERSTOP_RIDER_WEB_ORIGINS)' SHOPPERSTOP_RIDER_CORE_URL='$(SHOPPERSTOP_RIDER_CORE_URL)' SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN='$(SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN)'
# make e2e: fixed values, not overridable, so dev values never leak in. One env for core and rider commands alike.
E2E_ENV = SHOPPERSTOP_CORE_DATABASE_URL='postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_e2e?sslmode=disable' SHOPPERSTOP_CORE_ADDR=':18080' SHOPPERSTOP_CORE_SESSION_PEPPER='e2e-pepper-e2e-pepper-e2e-pepper-00' SHOPPERSTOP_CORE_FILES_DIR='$(CURDIR)/services/core/data/e2e-files' SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175' SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:e2e-rider-service-token-e2e-rider-00' SHOPPERSTOP_RIDER_DATABASE_URL='postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_e2e?sslmode=disable' SHOPPERSTOP_RIDER_ADDR=':18081' SHOPPERSTOP_RIDER_SESSION_PEPPER='e2e-rider-pepper-e2e-rider-pepper-00' SHOPPERSTOP_RIDER_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175' SHOPPERSTOP_RIDER_CORE_URL='http://localhost:18080' SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN='e2e-rider-service-token-e2e-rider-00'

db:
	docker compose -f $(CURDIR)/deploy/docker-compose.yml up -d --wait postgres

# ponytail: make -j5 runs the servers and Ctrl-C stops the process group; a crashed server leaves the others up until Ctrl-C, logs interleave.
dev:
	$(MAKE) db
	$(MAKE) seed
	$(MAKE) -j5 core rider web admin rider-app

seed:
	@if test -d services/core; then \
	  cd services/core && $(CORE_ENV) go run ./cmd/core-admin migrate && $(CORE_ENV) go run ./cmd/core-admin seed-demo --reset; \
	else echo "seed: services/core absent, skipping"; fi
	@if test -d services/rider; then \
	  cd services/rider && $(RIDER_ENV) go run ./cmd/rider-admin migrate && $(RIDER_ENV) go run ./cmd/rider-admin seed-demo --reset; \
	else echo "seed: services/rider absent, skipping"; fi

core:
	@if test -d services/core; then cd services/core && $(CORE_ENV) go run ./cmd/core; \
	else echo "core: services/core absent, skipping"; fi

rider:
	@if test -d services/rider; then cd services/rider && $(RIDER_ENV) go run ./cmd/rider; \
	else echo "rider: services/rider absent, skipping"; fi

ui:
	@if test -d packages/ui; then test -d node_modules || npm ci; npm run build --workspace packages/ui; \
	else echo "ui: packages/ui absent, skipping"; fi

web: ui
	@if test -d apps/web; then npm run dev --workspace apps/web; \
	else echo "web: apps/web absent, skipping"; fi

admin: ui
	@if test -d apps/admin; then npm run dev --workspace apps/admin; \
	else echo "admin: apps/admin absent, skipping"; fi

rider-app: ui
	@if test -d apps/rider; then npm run dev --workspace apps/rider; \
	else echo "rider-app: apps/rider absent, skipping"; fi

test: test-core test-rider test-web

test-core:
	@if test -d services/core; then \
	  cd services/core && test -z "$$(gofmt -l . | tee /dev/stderr)" && go vet ./... && \
	  SHOPPERSTOP_CORE_TEST_DATABASE_URL='$(SHOPPERSTOP_CORE_TEST_DATABASE_URL)' go test -race ./...; \
	else echo "test-core: services/core absent, skipping"; fi

test-rider:
	@if test -d services/rider; then \
	  cd services/rider && test -z "$$(gofmt -l . | tee /dev/stderr)" && go vet ./... && \
	  SHOPPERSTOP_RIDER_TEST_DATABASE_URL='$(SHOPPERSTOP_RIDER_TEST_DATABASE_URL)' go test -race ./...; \
	else echo "test-rider: services/rider absent, skipping"; fi

test-web: ui
	@if test -d packages/ui; then \
	  npm run lint && npm run typecheck && npm run test && npm run build --workspaces --if-present; \
	else echo "test-web: packages/ui absent, skipping"; fi

e2e:
	@if test -d services/core && { test -d apps/web || test -d apps/admin; }; then \
	  (cd services/core && $(E2E_ENV) go run ./cmd/core-admin migrate && $(E2E_ENV) go run ./cmd/core-admin seed-demo --reset) && \
	  if test -d services/rider; then \
	    (cd services/rider && $(E2E_ENV) go run ./cmd/rider-admin migrate && $(E2E_ENV) go run ./cmd/rider-admin seed-demo --reset); \
	  else echo "e2e: services/rider absent, skipping"; fi && \
	  npm run build --workspaces --if-present && $(E2E_ENV) npm run e2e --workspaces --if-present; \
	else echo "e2e: services/core, or both apps/web and apps/admin, absent, skipping"; fi

gen:
	@if test -f services/core/sqlc.yaml; then cd services/core && sqlc generate; \
	else echo "gen: services/core/sqlc.yaml absent, skipping"; fi
	@if test -f services/rider/sqlc.yaml; then cd services/rider && sqlc generate; \
	else echo "gen: services/rider/sqlc.yaml absent, skipping"; fi
	@if test -d packages/ui; then npm run gen:api --workspace packages/ui --if-present; \
	else echo "gen: packages/ui absent, skipping"; fi

postman:
	@if test -f scripts/postman.mjs; then npm run postman && node --test scripts/postman.test.mjs; \
	else echo "postman: scripts/postman.mjs absent, skipping"; fi

# Servers run through make -j2 on their own line: a $(MAKE) line runs even under make -n, so it must not share a line with compose.
prod-local:
	@if test -d services/core && test -d apps/web && test -d apps/admin; then \
	  npm run build --workspaces --if-present && \
	  docker compose -f $(CURDIR)/deploy/docker-compose.yml --profile prod up -d --wait && \
	  (cd services/core && $(CORE_ENV) go run ./cmd/core-admin migrate) && \
	  if test -d services/rider; then cd services/rider && $(RIDER_ENV) go run ./cmd/rider-admin migrate; \
	  else echo "prod-local: services/rider absent, skipping"; fi; \
	else echo "prod-local: services/core, apps/web or apps/admin absent, skipping"; fi
	@$(MAKE) --no-print-directory -j2 core rider
```

### .github/workflows/ci.yml (new job between `core` and `web`)

```yaml
  rider:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 2s --health-timeout 2s --health-retries 30
    env:
      SHOPPERSTOP_RIDER_TEST_DATABASE_URL: postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable
    steps:
      - uses: actions/checkout@v4
      - if: hashFiles('services/rider/go.mod') == ''
        run: 'echo "rider: services/rider absent, skipping"'
      - if: hashFiles('services/rider/go.mod') != ''
        uses: actions/setup-go@v5
        with:
          go-version-file: services/rider/go.mod
          cache-dependency-path: services/rider/go.sum
      - if: hashFiles('services/rider/go.mod') != ''
        run: psql -v ON_ERROR_STOP=1 -h localhost -U postgres -f deploy/initdb.sql
        env:
          PGPASSWORD: postgres
      - if: hashFiles('services/rider/go.mod') != ''
        run: make test-rider
```

The `core`, `web`, `e2e` and `spec` jobs are unchanged (Decisions 4 and 11).

### scripts/postman.mjs (whole file)

```js
// Generates one Postman collection per service from services/<service>/openapi.json (Spec 1 §11).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import converter from 'openapi-to-postmanv2';

const ID_VARS = {
  stores: 'storeId',
  products: 'productId',
  addresses: 'addressId',
  orders: 'orderId',
  riders: 'riderId',
  deliveries: 'deliveryId',
};

// Per service: the environment variable holding its base URL, and the token its own /auth and /me routes read.
const SERVICES = {
  core: { baseUrl: 'baseUrl', ownToken: 'customerToken' },
  rider: { baseUrl: 'riderBaseUrl', ownToken: 'riderToken' },
};

function tokenVar(path, svc) {
  if (path[0] === 'admin') return 'staffToken';
  return path[0] === 'auth' || path[0] === 'me' ? svc.ownToken : 'customerToken';
}

function returnsToken(item) {
  return item.response.some((r) => {
    if (r.code < 200 || r.code > 299) return false;
    try { return typeof JSON.parse(r.body).token === 'string'; } catch { return false; }
  });
}

function stripIds(node) {
  if (Array.isArray(node)) node.forEach(stripIds);
  else if (node && typeof node === 'object') {
    delete node.id;
    delete node._postman_id;
    Object.values(node).forEach(stripIds);
  }
}

function fixRequest(item, svc) {
  const { url, auth } = item.request;
  if (auth?.type === 'bearer') auth.bearer = [{ key: 'token', value: `{{${tokenVar(url.path, svc)}}}`, type: 'string' }];
  for (const v of url.variable) {
    const name = ID_VARS[url.path[url.path.indexOf(`:${v.key}`) - 1]];
    if (name && (v.key === 'id' || v.key === name)) v.value = `{{${name}}}`;
  }
  if (url.path.includes('auth') && returnsToken(item)) {
    item.event.push({
      listen: 'test',
      script: { type: 'text/javascript', exec: [`pm.environment.set('${tokenVar(url.path, svc)}', pm.response.json().token);`] },
    });
  }
}

function walk(items, svc) {
  for (const item of items) (item.item ? walk(item.item, svc) : fixRequest(item, svc));
}

export async function generate(spec, service = 'core') {
  const svc = SERVICES[service];
  const result = await new Promise((resolve, reject) =>
    converter.convertV2(
      { type: 'json', data: structuredClone(spec) },
      { folderStrategy: 'Tags', parametersResolution: 'Example' },
      (err, res) => (err ? reject(err) : resolve(res)),
    ),
  );
  if (!result.result) throw new Error(`openapi-to-postmanv2: ${result.reason}`);
  const collection = result.output[0].data;
  delete collection.variable; // the base URL comes from the environment
  walk(collection.item, svc);
  stripIds(collection);
  // The converter roots every URL at {{baseUrl}}; each service reads its own variable.
  return `${JSON.stringify(collection, null, 2).replaceAll('"{{baseUrl}}"', `"{{${svc.baseUrl}}}"`)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const service of Object.keys(SERVICES)) {
    const contract = new URL(`../services/${service}/openapi.json`, import.meta.url);
    if (!existsSync(contract)) {
      console.log(`postman: services/${service}/openapi.json absent, skipping`);
      continue;
    }
    const out = new URL(`../docs/postman/shopperstop-${service}.postman_collection.json`, import.meta.url);
    writeFileSync(out, await generate(JSON.parse(readFileSync(contract, 'utf8')), service));
  }
}
```

### docs/postman/local.postman_environment.json (append after `orderId`)

Four entries in the existing shape (`key`, `value`, `type`, `enabled: true`), in this order: `riderBaseUrl` = `http://localhost:8081/api/rider/v1` (`default`), `riderToken` = `""` (`secret`), `riderId` = `00000000-0000-4000-8000-000000000801` (`default`), `deliveryId` = `00000000-0000-4000-8000-000000000901` (`default`). Two-space JSON with a trailing newline, like the rest of the file.

### scripts/postman.test.mjs (tests to add or change)

Header comment: name both `platform-postman` and `platform-rider-wiring`. Add a `riderFixture` next to `fixture`: OpenAPI `3.1.0`, `servers: [{url: '/api/rider/v1'}]`, tags `platform`, `rider-service`, `deliveries`, `components.securitySchemes.bearer` (http bearer), and these operations, each with a 200 response whose `application/json` content has a `schema` and an `example`:

| Path | Summary | Tag | security | Notes |
|---|---|---|---|---|
| `GET /healthz` | `Rider liveness` | `platform` | none | example `{status: 'ok'}` |
| `POST /auth/sign-in` | `Rider sign in` | `rider-service` | none | request example `{email: 'rider1-koramangala@shopperstop.local', password: 'rider12345'}`, 200 example `{token: 't', rider: {id: 'r1'}}` |
| `GET /me` | `Rider me` | `rider-service` | bearer | |
| `GET /me/deliveries/{id}` | `Delivery` | `deliveries` | bearer | path param `id`, example `d1` |
| `GET /admin/riders/{id}` | `Rider for staff` | `rider-service` | bearer | path param `id`, example `r1` |
| `GET /orders/{orderId}/delivery` | `Order delivery` | `deliveries` | bearer | path param `orderId`, example `o1` |

Tests (names are the scenario names where one exists):

- `rider URLs read the rider base URL`: `generate(riderFixture, 'rider')` text has no `{{baseUrl}}`; every request's `url.host` is `['{{riderBaseUrl}}']`.
- `rider routes read their tokens`: `Rider me` and `Delivery` carry `{{riderToken}}`, `Rider for staff` `{{staffToken}}`, `Order delivery` `{{customerToken}}`; `Rider liveness` and `Rider sign in` carry no auth.
- `rider sign-in stores riderToken`: the test script of `Rider sign in` is exactly `["pm.environment.set('riderToken', pm.response.json().token);"]`.
- `rider and delivery ids read environment variables`: path variables `[['id', '{{riderId}}']]`, `[['id', '{{deliveryId}}']]`, `[['orderId', '{{orderId}}']]`.
- `rider collection follows the rider contract`: when `services/rider/openapi.json` exists, the committed `docs/postman/shopperstop-rider.postman_collection.json` equals `generate(<that contract>, 'rider')`; otherwise that collection file does not exist.
- `postman CLI skips an absent rider contract`: run `node scripts/postman.mjs` with `execFileSync(process.execPath, [...])` from the repository root; when `services/rider/openapi.json` is absent its stdout contains `postman: services/rider/openapi.json absent, skipping`, otherwise it does not; in both cases the core collection file afterwards equals `committed` (the bytes read at the top of the file).
- `two runs give identical bytes with no generated ids`: also loop over `[riderFixture, 'rider']` (pass the service to both `generate` calls).
- `environment holds the eleven variables` (replaces `environment holds the seven variables`): keys exactly `baseUrl, customerToken, staffToken, storeId, productId, addressId, orderId, riderBaseUrl, riderToken, riderId, deliveryId`; `riderBaseUrl` `http://localhost:8081/api/rider/v1`; `customerToken`, `staffToken`, `riderToken` empty with `type` `secret`; `riderId` `00000000-0000-4000-8000-000000000801`, `deliveryId` `00000000-0000-4000-8000-000000000901`; the existing core id assertions stay.

### README.md and CLAUDE.md

README:

- Status: Phase 3 (rider service and rider app) in progress; `services/rider` and `apps/rider` are not on `main` yet; their targets skip until they land.
- Quick start paragraph: after core, web and admin, "the rider service on <http://localhost:8081> and the rider app on <http://localhost:5175/rider/> once they land (Phase 3)". One more paragraph, "Cloned before Phase 3?": `deploy/initdb.sql` runs only when the Postgres volume is first created, so an existing volume lacks the rider role and databases; apply the rider lines once with `grep shopperstop_rider deploy/initdb.sql | docker exec -i shopperstop-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres` (the `psql` inside the container; none is needed on the host).
- Demo sign-ins: a sentence and one row per demo rider: `rider1-koramangala@shopperstop.local`, `rider2-koramangala@shopperstop.local`, `rider1-indiranagar@shopperstop.local`, `rider2-indiranagar@shopperstop.local`, password `rider12345`, app "Rider app (`localhost:5175/rider/`)", loaded by `rider-admin seed-demo --reset` from Phase 3 (not on `main` yet).
- Commands table: `make dev` names the five servers; `make test` is `test-core`, `test-rider`, then `test-web`; new rows `make test-rider` (gofmt, `go vet`, `go test -race` on `shopperstop_rider_test`), `make rider` (the rider service alone on :8081) and `make rider-app` (the rider app's dev server alone on :5175); `make e2e` adds `shopperstop_rider_e2e`, rider on :18081 and the rider preview on :15175 (under /rider/); `make gen` adds the rider sqlc code and `packages/ui/src/api/rider.d.ts`; `make postman` names one collection per service.
- API: the rider contract `services/rider/openapi.json` and `docs/postman/shopperstop-rider.postman_collection.json` once the rider service lands; the environment holds `riderBaseUrl`, `riderToken`, `riderId`, `deliveryId`. Do not link `services/rider/openapi.json` (it does not exist yet, and the docs check resolves links).
- How it is built: the areas list adds `rider`.

CLAUDE.md:

- "What this directory is": replace the stale "Phase 1 (foundation) is on `main` except the two apps" sentence with "Phases 1 and 2 are on `main` (`v0.1.0`, `v0.2.0`); Phase 3 adds the rider service and app (D29)".
- Commands table: `make dev` "core, rider, web, admin and the rider app together"; `make test` "`test-core`, `test-rider`, then `test-web`"; new row `make test-rider` "gofmt, `go vet`, `go test -race` on `shopperstop_rider_test`"; `make e2e` adds "`shopperstop_rider_e2e`, rider :18081, rider preview 15175 (under /rider/)"; `make gen` "sqlc generate per service (only while its `sqlc.yaml` exists), then `openapi-typescript` into `packages/ui/src/api/core.d.ts` and `packages/ui/src/api/rider.d.ts`"; `make postman` "regenerates one collection per service under `docs/postman/` (`shopperstop-core.postman_collection.json`, `shopperstop-rider.postman_collection.json` once `services/rider/openapi.json` exists) ...". The pieces sentence: "`seed`, `core`, `rider`, `ui`, `web`, `admin` and `rider-app` are the pieces `dev` composes".
- Single tests: add `cd services/rider && SHOPPERSTOP_RIDER_TEST_DATABASE_URL=... go test -race -run TestName ./internal/<pkg>`.
- Git and GitHub, `ci.yml` jobs: add "`rider` (`make test-rider` against `shopperstop_rider_test` on a Postgres service from `deploy/initdb.sql`; skipped while `services/rider` is absent)" after `core`, and in `e2e` add `shopperstop_rider_e2e`, rider :18081 and preview 15175.
- API documentation: "`make postman` regenerates one collection per service" and "`make gen` turns each file into `packages/ui/src/api/<service>.d.ts`"; the D19 sentence in Orchestration workflow is unchanged (the rider extension is in `.claude/areas/rider.md`).
- Layout `docs/postman/` line: "Postman collections (one per service) and the shared environment".

## Risks / Trade-offs

- [Rider seed needs a running core] → `make seed`, `make dev` and `make e2e` run `rider-admin seed-demo --reset` before any server starts. Request to rider: the seed must not call core.
- [Fresh-volume initdb is not testable by a lane] → workers never start containers; the rider statements are verified by `check-wiring.sh deploy` (text) and by the pgx check against the running container (already applied, D33). A fresh volume is exercised by CI once billing is fixed and by the orchestrator's fresh-clone `make dev` at phase close.
- [`make prod-local`, `make dev` and Ctrl-C are only dry-run here] → the orchestrator walks them at phase close (four servers plus the rider app).
- [Postman host rewrite is a string replace] → it matches only the exact JSON string `"{{baseUrl}}"`; a contract example containing that exact string would be rewritten too. None does; the rider tests catch a stray `{{baseUrl}}`.
- [`platform-ci-makefile`'s "exactly four jobs"] → escalated (Decision 1).
