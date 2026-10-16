## Context

See proposal.md for why. Inputs read: PLAN.md Phase 5 and D48 to D53 (and D30, D33, D35), `.claude/areas/payment.md` (env names, ports, demo `paymentId`, the standing request to platform), `.claude/areas/platform.md`, `.claude/areas/ui.md` (ui-P5-L1 owns `gen:api` for payment), `openspec/specs/platform/spec.md`, the archived `platform-rider-wiring` (the model), `platform-postman-tooling` and `platform-mobile-readme-spec`, `Makefile`, `deploy/*`, `.github/workflows/ci.yml`, `scripts/postman.mjs` and its test, `docs/postman/local.postman_environment.json`, `README.md`, `CLAUDE.md`, `.claude/commands/*.md`, `openspec/config.yaml`, core's `internal/config` (service token parser).

Facts this design relies on, checked by the team lead on 2026-10-16:

- The running `shopperstop-postgres-1` does NOT have role `shopperstop_payment` yet: a pgx client as `shopperstop_payment` on `shopperstop_payment_test` fails with `password authentication failed`, and `pg_database` lists only the core and rider databases. D33 says the orchestrator applies the four payment statements as `postgres`; until then task 1.4 records the failure and the manager re-runs it after.
- Core's `SHOPPERSTOP_CORE_SERVICE_TOKENS` parser (`services/core/internal/config/config.go`) already takes several `name:token` entries, requires 32 bytes per token and refuses a token shared by two names. The dev and e2e payment tokens below are 36 bytes and differ from the rider's.
- `packages/ui`'s `gen:api` script is ui's and today generates `core.d.ts` and `rider.d.ts` only. `make gen` already runs `npm run gen:api --workspace packages/ui --if-present`, so `payment.d.ts` arrives with ui-P5-L1's edit of that script and needs no Makefile change.
- Every artifact below was prototyped in a scratch copy of the tree: `check-payment-wiring.sh` passes on it (all four sections) and fails on `origin/main` with 37 FAIL lines in `deploy make ci`; `node --test scripts/postman.test.mjs` passes 27 of 27 with the new tests and fails 6 (the expected names) against the unchanged `postman.mjs` and environment; the core and rider collections are byte-identical.
- The archived `platform-rider-wiring/check-wiring.sh` must not be run any more: `services/rider` exists, so its real `make rider` starts the rider server. `check-payment-wiring.sh` runs real targets only while `services/payment` is absent.
- The guard hook denies any Bash command whose text contains the compose command, `docker-compose` or `docker exec` (heredocs, `sed` and `git add <that path>` included). README and CLAUDE.md contain such text: edit them with the Edit tool, stage with `git add -A` or by directory.

## Goals / Non-Goals

**Goals:** every requirement in `specs/platform/spec.md`; the payment area starts on `main` with no platform edit: its `cmd/payment`, `cmd/payment-admin`, `openapi.json` and `sqlc.yaml` are picked up by existing targets the moment they exist; today's targets keep doing what they did, plus one skip line per payment step.

**Non-Goals:** anything under `services/`, `apps/` or `packages/`; a committed payment collection (the first payment PR with `openapi.json` runs `make postman` and commits it); the Playwright configs that start the payment server in e2e (web, mobile and admin Phase 5 lanes); `deploy/docker-compose.yml` (unchanged); Razorpay env in the Makefile (owner's keys, set in the shell; D49).

## Decisions

1. **Mirror the rider wiring line for line.** Same variable layout (`PAYMENT_ENV` beside `RIDER_ENV`), same skip-line pattern, same CI job shape, same check-script approach. Nothing is shared or generalised (no loop over services in the Makefile): three copies of a six-line pattern read better than a macro. Ceiling: the receipt service (Phase 6) adds a fourth copy; a per-service include file is worth it at five.
2. **Requirements that name "the rider" are MODIFIED, not renamed.** "make dev runs the rider service and app", "make e2e gives the rider an isolated environment", "make gen runs the rider sqlc" and "CI runs a rider job" keep their names (a rename churns every archived reference) and gain the payment facts that would otherwise make them false (`-j6`, two-entry token list, three-service sqlc, six jobs, `localhost:5176` and `:15176` named three times). The payment-only behaviour is ADDED under its own names. Scenario names stay too, even where the text moved on ("Dry run shows five servers" now lists six): `openspec validate` refuses a MODIFIED block that drops a current scenario name.
3. **One token list for core.** `SHOPPERSTOP_CORE_SERVICE_TOKENS ?= rider:$(SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN),payment:$(SHOPPERSTOP_PAYMENT_CORE_SERVICE_TOKEN)`: overriding either service's token keeps core in step. E2E has its own fixed pair. Core reads the second entry today; it admits the `payment` subject to its routes from core-P5-L1.
4. **Gateway `fake` and `PUBLIC_URL` are Makefile defaults** (`fake`, `http://localhost:8082`; e2e `fake`, `http://localhost:18082`). Razorpay needs keys that never enter the repository, so `make dev` can only run `fake`; an owner who wants Razorpay locally runs `make payment SHOPPERSTOP_PAYMENT_GATEWAY=razorpay` with the keys exported. Ceiling: under `make prod-local` the fake page is still served at `http://localhost:8082`, not through Caddy; fine for a local demo, revisit with Phase 7's deploy.
5. **Payment web origins are the four app origins** (5173 to 5176, e2e 15173 to 15176), as `.claude/areas/payment.md` asks; the rider app never calls payment, but one origin list for every service is simpler than a tailored one. The `shopperstop://` return scheme is checked in payment's code, not here.
6. **Postman: payment is one row in each table.** `payment: { baseUrl: 'paymentBaseUrl', ownToken: 'customerToken' }` (customers sign in through core, so the payment collection's `/me` routes read `customerToken`; payment has no `/auth`) and `payments: 'paymentId'`. `/fake/{id}` keeps its example (segment `fake` is not in the id table); the webhook has no `security`, so no auth. `paymentBaseUrl` and `paymentId` go before `serviceToken`, which stays last ("Postman environment carries the service token" is unchanged).
7. **`paymentId` is fixed now** from `.claude/areas/payment.md`: `00000000-0000-4000-8000-000000000a01`. Request to payment: its seed test ties that value to the seed (L1 already plans it).
8. **`make gen` gets a payment sqlc step** guarded by `services/payment/sqlc.yaml`, between rider's and `gen:api`, although the payment work package does not name sqlc: rider uses it, payment copies rider's shape (D52), and a skip line costs nothing. CI installs sqlc whenever `services/core/sqlc.yaml` exists, so the `core` job's clean-tree check covers payment's generated code too.
9. **prod-local migrations run in subshells.** The rider step used a bare `cd services/rider`, harmless while it was last; a payment step after it would run from `services/rider`. Both become `(cd ... && ...)`, joined by `&&`.
10. **CI `payment` job is a copy of `rider` with names replaced**, placed after `rider`. The `e2e` job keeps its guard (core and an app) and its Go from `services/core/go.mod`; payment's module builds with the same toolchain, and its migrate and seed in `make e2e` skip on their own.
11. **The test for files with no framework is `check-payment-wiring.sh`** (precedent: `check-wiring.sh`, `check-tooling.sh`), committed with this change before any worker starts. Sections `deploy`, `make` (real runs only while `services/payment` is absent, `make -n` otherwise, plus a scratch copy of the Makefile with every directory present), `ci`, `docs` (string checks plus the archived `check-docs.sh`, `check-readme-mobile.sh` and `check-tooling.sh docs`). The spec scenarios that need a database (payment role and ownership) are checked with a pgx client by task 1 and the manager.

## The files

### deploy/initdb.sql (append four lines)

```sql
create role shopperstop_payment login password 'shopperstop_payment';
create database shopperstop_payment owner shopperstop_payment;
create database shopperstop_payment_test owner shopperstop_payment;
create database shopperstop_payment_e2e owner shopperstop_payment;
```

### deploy/Caddyfile (insert after the `/api/rider/*` block)

```
	handle /api/payment/* {
		reverse_proxy host.docker.internal:8082
	}
```

### Makefile (whole file)

Recipe lines start with a tab. `git diff origin/main -- Makefile` shows only payment lines, the `.PHONY` line, `SHOPPERSTOP_CORE_SERVICE_TOKENS`, the e2e comment and tokens, `-j5` to `-j6`, `-j2` to `-j3`, and the prod-local subshells; the `db` target is byte-identical.

```make
# Local development. Needs Docker, Go and Node (see README.md). GNU make 3.81 or newer.
SHELL = /bin/sh
.PHONY: db dev seed core rider payment ui web admin rider-app test test-core test-rider test-payment test-web e2e gen postman prod-local

# Spec 1 §7 defaults; override from the shell or the command line. Passed inline to core commands only.
SHOPPERSTOP_CORE_DATABASE_URL ?= postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core?sslmode=disable
SHOPPERSTOP_CORE_ADDR ?= :8080
SHOPPERSTOP_CORE_SESSION_PEPPER ?= dev-pepper-dev-pepper-dev-pepper-00
SHOPPERSTOP_CORE_FILES_DIR ?= $(CURDIR)/services/core/data/files
SHOPPERSTOP_CORE_WEB_ORIGINS ?= http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176
SHOPPERSTOP_CORE_TEST_DATABASE_URL ?= postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable
# Rider service (D29, D30): its own database and port; it calls core with a service token that core accepts.
SHOPPERSTOP_RIDER_DATABASE_URL ?= postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider?sslmode=disable
SHOPPERSTOP_RIDER_ADDR ?= :8081
SHOPPERSTOP_RIDER_SESSION_PEPPER ?= dev-rider-pepper-dev-rider-pepper-00
SHOPPERSTOP_RIDER_WEB_ORIGINS ?= http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176
SHOPPERSTOP_RIDER_CORE_URL ?= http://localhost:8080
SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN ?= dev-rider-service-token-dev-rider-00
SHOPPERSTOP_RIDER_TEST_DATABASE_URL ?= postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable
# Payment service (D48, D49): its own database and port; it calls core with its own service token, and the fake gateway serves its pay page at PUBLIC_URL.
SHOPPERSTOP_PAYMENT_DATABASE_URL ?= postgres://shopperstop_payment:shopperstop_payment@localhost:5432/shopperstop_payment?sslmode=disable
SHOPPERSTOP_PAYMENT_ADDR ?= :8082
SHOPPERSTOP_PAYMENT_SESSION_PEPPER ?= dev-payment-pepper-dev-payment-pepper-00
SHOPPERSTOP_PAYMENT_WEB_ORIGINS ?= http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176
SHOPPERSTOP_PAYMENT_CORE_URL ?= http://localhost:8080
SHOPPERSTOP_PAYMENT_CORE_SERVICE_TOKEN ?= dev-payment-service-token-dev-pay-00
SHOPPERSTOP_PAYMENT_GATEWAY ?= fake
SHOPPERSTOP_PAYMENT_PUBLIC_URL ?= http://localhost:8082
SHOPPERSTOP_PAYMENT_TEST_DATABASE_URL ?= postgres://shopperstop_payment:shopperstop_payment@localhost:5432/shopperstop_payment_test?sslmode=disable
SHOPPERSTOP_CORE_SERVICE_TOKENS ?= rider:$(SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN),payment:$(SHOPPERSTOP_PAYMENT_CORE_SERVICE_TOKEN)
CORE_ENV = SHOPPERSTOP_CORE_DATABASE_URL='$(SHOPPERSTOP_CORE_DATABASE_URL)' SHOPPERSTOP_CORE_ADDR='$(SHOPPERSTOP_CORE_ADDR)' SHOPPERSTOP_CORE_SESSION_PEPPER='$(SHOPPERSTOP_CORE_SESSION_PEPPER)' SHOPPERSTOP_CORE_FILES_DIR='$(SHOPPERSTOP_CORE_FILES_DIR)' SHOPPERSTOP_CORE_WEB_ORIGINS='$(SHOPPERSTOP_CORE_WEB_ORIGINS)' SHOPPERSTOP_CORE_SERVICE_TOKENS='$(SHOPPERSTOP_CORE_SERVICE_TOKENS)'
RIDER_ENV = SHOPPERSTOP_RIDER_DATABASE_URL='$(SHOPPERSTOP_RIDER_DATABASE_URL)' SHOPPERSTOP_RIDER_ADDR='$(SHOPPERSTOP_RIDER_ADDR)' SHOPPERSTOP_RIDER_SESSION_PEPPER='$(SHOPPERSTOP_RIDER_SESSION_PEPPER)' SHOPPERSTOP_RIDER_WEB_ORIGINS='$(SHOPPERSTOP_RIDER_WEB_ORIGINS)' SHOPPERSTOP_RIDER_CORE_URL='$(SHOPPERSTOP_RIDER_CORE_URL)' SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN='$(SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN)'
PAYMENT_ENV = SHOPPERSTOP_PAYMENT_DATABASE_URL='$(SHOPPERSTOP_PAYMENT_DATABASE_URL)' SHOPPERSTOP_PAYMENT_ADDR='$(SHOPPERSTOP_PAYMENT_ADDR)' SHOPPERSTOP_PAYMENT_SESSION_PEPPER='$(SHOPPERSTOP_PAYMENT_SESSION_PEPPER)' SHOPPERSTOP_PAYMENT_WEB_ORIGINS='$(SHOPPERSTOP_PAYMENT_WEB_ORIGINS)' SHOPPERSTOP_PAYMENT_CORE_URL='$(SHOPPERSTOP_PAYMENT_CORE_URL)' SHOPPERSTOP_PAYMENT_CORE_SERVICE_TOKEN='$(SHOPPERSTOP_PAYMENT_CORE_SERVICE_TOKEN)' SHOPPERSTOP_PAYMENT_GATEWAY='$(SHOPPERSTOP_PAYMENT_GATEWAY)' SHOPPERSTOP_PAYMENT_PUBLIC_URL='$(SHOPPERSTOP_PAYMENT_PUBLIC_URL)'
# make e2e: fixed values, not overridable, so dev values never leak in. One env for core, rider and payment commands alike.
E2E_ENV = SHOPPERSTOP_CORE_DATABASE_URL='postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_e2e?sslmode=disable' SHOPPERSTOP_CORE_ADDR=':18080' SHOPPERSTOP_CORE_SESSION_PEPPER='e2e-pepper-e2e-pepper-e2e-pepper-00' SHOPPERSTOP_CORE_FILES_DIR='$(CURDIR)/services/core/data/e2e-files' SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175,http://localhost:15176' SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:e2e-rider-service-token-e2e-rider-00,payment:e2e-payment-service-token-e2e-pay-00' SHOPPERSTOP_RIDER_DATABASE_URL='postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_e2e?sslmode=disable' SHOPPERSTOP_RIDER_ADDR=':18081' SHOPPERSTOP_RIDER_SESSION_PEPPER='e2e-rider-pepper-e2e-rider-pepper-00' SHOPPERSTOP_RIDER_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175,http://localhost:15176' SHOPPERSTOP_RIDER_CORE_URL='http://localhost:18080' SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN='e2e-rider-service-token-e2e-rider-00' SHOPPERSTOP_PAYMENT_DATABASE_URL='postgres://shopperstop_payment:shopperstop_payment@localhost:5432/shopperstop_payment_e2e?sslmode=disable' SHOPPERSTOP_PAYMENT_ADDR=':18082' SHOPPERSTOP_PAYMENT_SESSION_PEPPER='e2e-payment-pepper-e2e-payment-pepper-00' SHOPPERSTOP_PAYMENT_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175,http://localhost:15176' SHOPPERSTOP_PAYMENT_CORE_URL='http://localhost:18080' SHOPPERSTOP_PAYMENT_CORE_SERVICE_TOKEN='e2e-payment-service-token-e2e-pay-00' SHOPPERSTOP_PAYMENT_GATEWAY='fake' SHOPPERSTOP_PAYMENT_PUBLIC_URL='http://localhost:18082'

db:
	docker compose -f $(CURDIR)/deploy/docker-compose.yml up -d --wait postgres

# ponytail: make -j6 runs the servers and Ctrl-C stops the process group; a crashed server leaves the others up until Ctrl-C, logs interleave.
dev:
	$(MAKE) db
	$(MAKE) seed
	$(MAKE) -j6 core rider payment web admin rider-app

seed:
	@if test -d services/core; then \
	  cd services/core && $(CORE_ENV) go run ./cmd/core-admin migrate && $(CORE_ENV) go run ./cmd/core-admin seed-demo --reset; \
	else echo "seed: services/core absent, skipping"; fi
	@if test -d services/rider; then \
	  cd services/rider && $(RIDER_ENV) go run ./cmd/rider-admin migrate && $(RIDER_ENV) go run ./cmd/rider-admin seed-demo --reset; \
	else echo "seed: services/rider absent, skipping"; fi
	@if test -d services/payment; then \
	  cd services/payment && $(PAYMENT_ENV) go run ./cmd/payment-admin migrate && $(PAYMENT_ENV) go run ./cmd/payment-admin seed-demo --reset; \
	else echo "seed: services/payment absent, skipping"; fi

core:
	@if test -d services/core; then cd services/core && $(CORE_ENV) go run ./cmd/core; \
	else echo "core: services/core absent, skipping"; fi

rider:
	@if test -d services/rider; then cd services/rider && $(RIDER_ENV) go run ./cmd/rider; \
	else echo "rider: services/rider absent, skipping"; fi

payment:
	@if test -d services/payment; then cd services/payment && $(PAYMENT_ENV) go run ./cmd/payment; \
	else echo "payment: services/payment absent, skipping"; fi

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

test: test-core test-rider test-payment test-web

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

test-payment:
	@if test -d services/payment; then \
	  cd services/payment && test -z "$$(gofmt -l . | tee /dev/stderr)" && go vet ./... && \
	  SHOPPERSTOP_PAYMENT_TEST_DATABASE_URL='$(SHOPPERSTOP_PAYMENT_TEST_DATABASE_URL)' go test -race ./...; \
	else echo "test-payment: services/payment absent, skipping"; fi

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
	  if test -d services/payment; then \
	    (cd services/payment && $(E2E_ENV) go run ./cmd/payment-admin migrate && $(E2E_ENV) go run ./cmd/payment-admin seed-demo --reset); \
	  else echo "e2e: services/payment absent, skipping"; fi && \
	  npm run build --workspaces --if-present && $(E2E_ENV) npm run e2e --workspaces --if-present; \
	else echo "e2e: services/core, or both apps/web and apps/admin, absent, skipping"; fi

gen:
	@if test -f services/core/sqlc.yaml; then cd services/core && sqlc generate; \
	else echo "gen: services/core/sqlc.yaml absent, skipping"; fi
	@if test -f services/rider/sqlc.yaml; then cd services/rider && sqlc generate; \
	else echo "gen: services/rider/sqlc.yaml absent, skipping"; fi
	@if test -f services/payment/sqlc.yaml; then cd services/payment && sqlc generate; \
	else echo "gen: services/payment/sqlc.yaml absent, skipping"; fi
	@if test -d packages/ui; then npm run gen:api --workspace packages/ui --if-present && npm run gen:tokens --workspace packages/ui --if-present; \
	else echo "gen: packages/ui absent, skipping"; fi

postman:
	@if test -f scripts/postman.mjs; then npm run postman && node --test scripts/postman.test.mjs; \
	else echo "postman: scripts/postman.mjs absent, skipping"; fi

# Servers run through make -j3 on their own line: a $(MAKE) line runs even under make -n, so it must not share a line with compose.
prod-local:
	@if test -d services/core && test -d apps/web && test -d apps/admin; then \
	  npm run build --workspaces --if-present && \
	  docker compose -f $(CURDIR)/deploy/docker-compose.yml --profile prod up -d --wait && \
	  (cd services/core && $(CORE_ENV) go run ./cmd/core-admin migrate) && \
	  if test -d services/rider; then (cd services/rider && $(RIDER_ENV) go run ./cmd/rider-admin migrate); \
	  else echo "prod-local: services/rider absent, skipping"; fi && \
	  if test -d services/payment; then (cd services/payment && $(PAYMENT_ENV) go run ./cmd/payment-admin migrate); \
	  else echo "prod-local: services/payment absent, skipping"; fi; \
	else echo "prod-local: services/core, apps/web or apps/admin absent, skipping"; fi
	@$(MAKE) --no-print-directory -j3 core rider payment
```

### .github/workflows/ci.yml (new job between `rider` and `web`)

```yaml
  payment:
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
      SHOPPERSTOP_PAYMENT_TEST_DATABASE_URL: postgres://shopperstop_payment:shopperstop_payment@localhost:5432/shopperstop_payment_test?sslmode=disable
    steps:
      - uses: actions/checkout@v4
      - if: hashFiles('services/payment/go.mod') == ''
        run: 'echo "payment: services/payment absent, skipping"'
      - if: hashFiles('services/payment/go.mod') != ''
        uses: actions/setup-go@v5
        with:
          go-version-file: services/payment/go.mod
          cache-dependency-path: services/payment/go.sum
      - if: hashFiles('services/payment/go.mod') != ''
        run: psql -v ON_ERROR_STOP=1 -h localhost -U postgres -f deploy/initdb.sql
        env:
          PGPASSWORD: postgres
      - if: hashFiles('services/payment/go.mod') != ''
        run: make test-payment
```

### scripts/postman.mjs (two lines)

In `ID_VARS`, after `deliveries: 'deliveryId',`: `  payments: 'paymentId',`. In `SERVICES`, after the `rider` row: `  payment: { baseUrl: 'paymentBaseUrl', ownToken: 'customerToken' },`. Nothing else changes.

### docs/postman/local.postman_environment.json (insert before `serviceToken`)

Two entries in the existing shape: `paymentBaseUrl` = `http://localhost:8082/api/payment/v1` (`default`), `paymentId` = `00000000-0000-4000-8000-000000000a01` (`default`). Two-space JSON with a trailing newline.

### scripts/postman.test.mjs (additions)

1. Header comment: the second line ends `... platform-rider-wiring/specs/platform/spec.md and` and a third line names `openspec/changes/platform-payment-wiring/specs/platform/spec.md.`
2. Insert this fixture after `riderFixture`, before the `// Every request in the collection` comment:

```js
// Payment contract shaped like services/payment/openapi.json (platform-payment-wiring design.md, test fixture).
const ok = (example) => ({ 200: { description: 'OK.', content: { 'application/json': { schema: { type: 'object' }, example } } } });
const paymentFixture = {
  openapi: '3.1.0',
  info: { title: 'payment fixture', version: '0.0.0' },
  servers: [{ url: '/api/payment/v1' }],
  tags: [{ name: 'platform' }, { name: 'payment-service' }],
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
  paths: {
    '/healthz': { get: { summary: 'Payment liveness', tags: ['platform'], responses: ok({ status: 'ok' }) } },
    '/me/payments': {
      post: {
        summary: 'Create payment',
        tags: ['payment-service'],
        security: [{ bearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' }, example: { orderId: 'o1', returnUrl: 'http://localhost:5173/orders/o1' } } } },
        responses: ok({ id: 'p1' }),
      },
    },
    '/me/payments/{id}': {
      get: {
        summary: 'Payment',
        tags: ['payment-service'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'p1' }],
        responses: ok({ id: 'p1' }),
      },
    },
    '/orders/{orderId}/payment': {
      get: {
        summary: 'Order payment',
        tags: ['payment-service'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' }, example: 'o1' }],
        responses: ok({ id: 'p1' }),
      },
    },
    '/webhooks/razorpay': { post: { summary: 'Razorpay webhook', tags: ['payment-service'], responses: ok({ status: 'ok' }) } },
    '/fake/{id}': {
      get: {
        summary: 'Fake pay page',
        tags: ['payment-service'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'p1' }],
        responses: { 200: { description: 'The page.', content: { 'text/html': { schema: { type: 'string' }, example: '<form></form>' } } } },
      },
    },
  },
};
```

3. Insert these tests before `two runs give identical bytes with no generated ids`:

```js
test('payment URLs read the payment base URL', async () => {
  const text = await generate(paymentFixture, 'payment');
  assert.ok(!text.includes('{{baseUrl}}'), 'payment collection must not mention {{baseUrl}}');
  const c = JSON.parse(text);
  for (const r of requests(c.item)) assert.deepEqual(r.request.url.host, ['{{paymentBaseUrl}}'], r.name);
});

test('payment routes read the customer token', async () => {
  const c = JSON.parse(await generate(paymentFixture, 'payment'));
  for (const name of ['Create payment', 'Payment', 'Order payment']) {
    assert.equal(requestNamed(c, name).request.auth?.bearer[0].value, '{{customerToken}}', name);
  }
  for (const name of ['Payment liveness', 'Razorpay webhook', 'Fake pay page']) {
    assert.ok(!requestNamed(c, name).request.auth, `${name} must carry no auth`);
    assert.deepEqual(testScript(requestNamed(c, name)), [], `${name} must carry no script`);
  }
});

test('payment ids read environment variables', async () => {
  const c = JSON.parse(await generate(paymentFixture, 'payment'));
  const vars = (name) => requestNamed(c, name).request.url.variable.map((v) => [v.key, v.value]);
  assert.deepEqual(vars('Payment'), [['id', '{{paymentId}}']]);
  assert.deepEqual(vars('Order payment'), [['orderId', '{{orderId}}']]);
  assert.deepEqual(vars('Fake pay page'), [['id', 'p1']]);
});

test('payment collection follows the payment contract', async () => {
  const contract = new URL('../services/payment/openapi.json', import.meta.url);
  const collection = '../docs/postman/shopperstop-payment.postman_collection.json';
  if (existsSync(contract)) {
    assert.equal(read(collection), await generate(JSON.parse(read('../services/payment/openapi.json')), 'payment'));
  } else {
    assert.equal(existsSync(new URL(collection, import.meta.url)), false, 'no payment collection without a payment contract');
  }
});

test('postman CLI skips an absent payment contract', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const stdout = execFileSync(process.execPath, ['scripts/postman.mjs'], { cwd: root, encoding: 'utf8' });
  if (existsSync(new URL('../services/payment/openapi.json', import.meta.url))) {
    assert.ok(!stdout.includes('services/payment/openapi.json absent'));
  } else {
    assert.ok(stdout.includes('postman: services/payment/openapi.json absent, skipping'), stdout);
  }
  assert.equal(read('../docs/postman/shopperstop-core.postman_collection.json'), committed);
});
```

4. In `two runs give identical bytes with no generated ids`, the loop list ends `[riderFixture, 'rider'], [paymentFixture, 'payment']]`.
5. Rename `environment holds the twelve variables` to `environment holds the fourteen variables`; its key list gets `'paymentBaseUrl', 'paymentId'` between `'deliveryId'` and `'serviceToken'`; after the `riderBaseUrl` assertion add `assert.equal(byKey.paymentBaseUrl, 'http://localhost:8082/api/payment/v1');`; at the end add the comment `// The payment seed's paid payment of core's demo online order (.claude/areas/payment.md).` and `assert.equal(byKey.paymentId, '00000000-0000-4000-8000-000000000a01');`.

### README.md, CLAUDE.md, .claude/commands/*.md, openspec/config.yaml (find and replace)

Each "find" text occurs exactly once in today's file; replace it with "replace". Use the Edit tool (the README lines contain text the hook denies in Bash).

#### README.md

1. find:

````text
is in progress on `main`: the app shell, sign-in, register, account and addresses; see [Mobile app](#mobile-app).
````

   replace:

````text
is in progress on `main`: the app shell, sign-in, register, account and addresses; see [Mobile app](#mobile-app).

Phase 5 (the payment service, `services/payment` on :8082, D48) is being built; its make targets, CI job and Postman collection skip until it lands.
````

2. find:

````text
and the rider app on <http://localhost:5175/rider/> (Phase 3).
````

   replace:

````text
and the rider app on <http://localhost:5175/rider/> (Phase 3). From Phase 5 it also runs the payment service on <http://localhost:8082> with the fake gateway (`SHOPPERSTOP_PAYMENT_GATEWAY=fake`), whose pay page has Pay and Fail buttons; no gateway keys are needed locally.
````

3. find:

````text
(the `psql` inside the container; none is needed on the host).
````

   replace:

````text
(the `psql` inside the container; none is needed on the host).

**Cloned before Phase 5?** The same applies to the payment role and databases: `grep shopperstop_payment deploy/initdb.sql | docker exec -i shopperstop-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres`.
````

4. find:

````text
| `make dev` | `db`, then the seed, then core, rider, web, admin and the rider app together. |
````

   replace:

````text
| `make dev` | `db`, then the seed, then core, rider, payment, web, admin and the rider app together. |
````

5. find:

````text
| `make test` | `test-core`, `test-rider`, then `test-web`. |
````

   replace:

````text
| `make test` | `test-core`, `test-rider`, `test-payment`, then `test-web`. |
````

6. find:

````text
| `make test-rider` | gofmt, `go vet`, and `go test -race` on `shopperstop_rider_test`. |
````

   replace:

````text
| `make test-rider` | gofmt, `go vet`, and `go test -race` on `shopperstop_rider_test`. |
| `make test-payment` | gofmt, `go vet`, and `go test -race` on `shopperstop_payment_test`. |
````

7. find:

````text
| `make rider` | The rider service alone, on :8081. |
````

   replace:

````text
| `make rider` | The rider service alone, on :8081. |
| `make payment` | The payment service alone, on :8082, with the fake gateway. |
````

8. find:

````text
on `shopperstop_core_e2e` and `shopperstop_rider_e2e`, core on :18080, rider on :18081,
````

   replace:

````text
on `shopperstop_core_e2e`, `shopperstop_rider_e2e` and `shopperstop_payment_e2e`, core on :18080, rider on :18081, payment on :18082 (fake gateway),
````

9. find:

````text
and the rider sqlc code and `packages/ui/src/api/rider.d.ts` once the rider contract exists, then
````

   replace:

````text
the rider sqlc code and `packages/ui/src/api/rider.d.ts` once the rider contract exists, the payment sqlc code and `packages/ui/src/api/payment.d.ts` once the payment contract exists, then
````

10. find:

````text
The rider contract, [services/rider/openapi.json](services/rider/openapi.json), follows the same rules.
````

   replace:

````text
The rider contract, [services/rider/openapi.json](services/rider/openapi.json), follows the same rules, and so does the payment contract, `services/payment/openapi.json`, from Phase 5: its collection reads `paymentBaseUrl` and `paymentId`, and its customer routes `customerToken`.
````

11. find:

````text
`rider` from Phase 3 and `mobile` from Phase 4)
````

   replace:

````text
`rider` from Phase 3, `mobile` from Phase 4 and `payment` from Phase 5)
````

#### CLAUDE.md

1. find:

````text
Phase 4, the customer mobile app (D36), is in progress on `main`.
````

   replace:

````text
Phase 4, the customer mobile app (D36), is in progress on `main`; Phase 5 adds the payment service (D48).
````

2. find:

````text
then core, rider, web, admin and the rider app together; Ctrl-C stops them |
````

   replace:

````text
then core, rider, payment, web, admin and the rider app together; Ctrl-C stops them |
````

3. find:

````text
| `make test` | `test-core`, `test-rider`, then `test-web` |
````

   replace:

````text
| `make test` | `test-core`, `test-rider`, `test-payment`, then `test-web` |
````

4. find:

````text
| `make test-rider` | gofmt, `go vet`, `go test -race` on `shopperstop_rider_test` |
````

   replace:

````text
| `make test-rider` | gofmt, `go vet`, `go test -race` on `shopperstop_rider_test` |
| `make test-payment` | gofmt, `go vet`, `go test -race` on `shopperstop_payment_test` |
````

5. find:

````text
| `make rider` | the rider service alone, on :8081 |
````

   replace:

````text
| `make rider` | the rider service alone, on :8081 |
| `make payment` | the payment service alone, on :8082, with the fake gateway |
````

6. find:

````text
| `make e2e` | Playwright on `shopperstop_core_e2e` and `shopperstop_rider_e2e`: core :18080, rider :18081,
````

   replace:

````text
| `make e2e` | Playwright on `shopperstop_core_e2e`, `shopperstop_rider_e2e` and `shopperstop_payment_e2e`: core :18080, rider :18081, payment :18082 (fake gateway),
````

7. find:

````text
into `packages/ui/src/api/core.d.ts` and `packages/ui/src/api/rider.d.ts` |
````

   replace:

````text
into `packages/ui/src/api/core.d.ts`, `packages/ui/src/api/rider.d.ts` and `packages/ui/src/api/payment.d.ts` |
````

8. find:

````text
`shopperstop-rider.postman_collection.json` once `services/rider/openapi.json` exists), then
````

   replace:

````text
`shopperstop-rider.postman_collection.json` and `shopperstop-payment.postman_collection.json` once their `openapi.json` exists), then
````

9. find:

````text
`seed`, `core`, `rider`, `ui`, `web`, `admin` and `rider-app` are the pieces
````

   replace:

````text
`seed`, `core`, `rider`, `payment`, `ui`, `web`, `admin` and `rider-app` are the pieces
````

10. find:

````text
go test -race -run TestName ./internal/<pkg>` for the rider, and
````

   replace:

````text
go test -race -run TestName ./internal/<pkg>` for the rider, the same with `services/payment` and `SHOPPERSTOP_PAYMENT_TEST_DATABASE_URL` for payment, and
````

11. find:

````text
apps/web/           customer site
````

   replace:

````text
services/payment/   Phase 5: the payment service, same shape, module .../services/payment, routes /api/payment/v1, port 8082, no app (D48)
apps/web/           customer site
````

12. find:

````text
`mobile` (`apps/mobile/`, Phase 4, D36); later services become areas.
````

   replace:

````text
`mobile` (`apps/mobile/`, Phase 4, D36), `payment` (`services/payment/`, Phase 5, D48); later services become areas.
````

13. find:

````text
skipped while `services/rider` is absent), `web`
````

   replace:

````text
skipped while `services/rider` is absent), `payment` (`make test-payment` against `shopperstop_payment_test` on a Postgres service from `deploy/initdb.sql`; skipped while `services/payment` is absent), `web`
````

14. find:

````text
`e2e` (`make e2e`: Playwright, Chromium only, `shopperstop_core_e2e` and `shopperstop_rider_e2e`, core :18080, rider :18081,
````

   replace:

````text
`e2e` (`make e2e`: Playwright, Chromium only, `shopperstop_core_e2e`, `shopperstop_rider_e2e` and `shopperstop_payment_e2e`, core :18080, rider :18081, payment :18082,
````

15. find:

````text
(and `shopperstop-rider.postman_collection.json` once `services/rider/openapi.json` exists)
````

   replace:

````text
(and `shopperstop-rider.postman_collection.json` and `shopperstop-payment.postman_collection.json` once their `openapi.json` exists)
````

16. find:

````text
holds `baseUrl`, `riderBaseUrl` and the token and id variables
````

   replace:

````text
holds `baseUrl`, `riderBaseUrl`, `paymentBaseUrl` and the token and id variables
````

#### .claude/commands/orchestrate.md

1. find:

````text
`mobile` (`apps/mobile/`, D36); later services (`payment`, `receipt`) become areas
````

   replace:

````text
`mobile` (`apps/mobile/`, D36), `payment` (`services/payment/`, D48); later services (`receipt`) become areas
````

#### .claude/commands/manage.md

1. find:

````text
`mobile` = `apps/mobile/`.
````

   replace:

````text
`mobile` = `apps/mobile/`; `payment` = `services/payment/`.
````

#### openspec/config.yaml

1. find:

````text
rider (services/rider/ and apps/rider/), mobile (apps/mobile/).
````

   replace:

````text
rider (services/rider/ and apps/rider/), mobile (apps/mobile/), payment (services/payment/).
````

2. find:

````text
rider-service, deliveries, rider-app, and mobile-app from Phase 4.
````

   replace:

````text
rider-service, deliveries, rider-app, mobile-app from Phase 4, and payment-service and
  payment-gateway-razorpay from Phase 5.
````


## Risks / Trade-offs

- [The running container lacks the payment role] → escalated: the orchestrator applies the four statements (D33) before payment-P5-L1 runs its tests; task 1.4 records the state either way, task 4.2 re-checks.
- [Payment seed needs a running core] → `make seed`, `make dev` and `make e2e` run `payment-admin seed-demo --reset` before any server starts. Request to payment: the seed must not call core (L1 already says so).
- [e2e suites must start the payment server themselves] → the Makefile only passes env; each Playwright config that needs payment starts `go run ./cmd/payment` in `services/payment` on :18082 with the inherited env (request to web, mobile and admin Phase 5 lanes).
- [Core's living scenario "The Makefile tokens are accepted" names one rider entry] → still true as a parser test; the Makefile now passes two entries. Request to core-P5-L1: extend that scenario and `config_test.go` to the two-entry dev and e2e values.
- [CLAUDE.md's `make gen` row names `payment.d.ts` before ui-P5-L1 generates it] → the row describes the target once all of Phase 5 has landed; `gen:api` skips nothing today, it just does not know the file yet.
- [`make dev`, `make prod-local`, Ctrl-C and a fresh volume are only dry-run here] → the orchestrator walks them at phase close with the payment service present.
