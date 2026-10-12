## Context

Spec 1 §6 (CI jobs), §7 (Makefile targets and default env), §11 (`make postman`, CI fails on a diff), §12 (gates). PLAN.md D3: no `sqlc.yaml` in Phase 1. The tree today has only `deploy/`, `openspec/`, `docs/`, the root `package.json` and a `Makefile` with `db`. `services/core`, `packages/ui`, `apps/web`, `apps/admin` and `scripts/postman.mjs` land later from other lanes, so every command guards on what it drives.

Inputs folded in: the core manager's requests (gates, `make dev` sequence, CI core job, `_e2e` database) and the ui area's (Node at least 22.12; build `packages/ui` before any app command because the apps import its `dist`).

## Goals / Non-Goals

**Goals:** one Makefile and one workflow that are green on today's tree and need no edit when the other directories land; CI and `make` share one definition of each gate.

**Non-Goals:** the scripts the targets call (owned by core, ui, web, admin, and platform Task 12), branch protection, release tags, Linux support for Caddy, a test harness for Make or Actions.

## Decisions

1. **Guard = one shell `if` per recipe line.** `@if test -d <dir>; then <commands>; else echo "<target>: <dir> absent, skipping"; fi`. One logical line (backslash continuations), so the skip really skips and a failing command still fails the target. No includes, no generated targets, no make conditionals.
2. **Env passed inline, never exported.** The six variables get `?=` defaults (Spec 1 §7 plus `SHOPPERSTOP_CORE_TEST_DATABASE_URL`), so the shell or `make VAR=...` overrides them. `CORE_ENV` expands them as `VAR='value'` prefixes on core commands only. `E2E_ENV` is a fixed literal for `make e2e`; it sets every required variable, so neither the dev defaults nor anything in the developer's shell reaches e2e. `SHOPPERSTOP_CORE_LOG_LEVEL` is optional and simply inherited. Ceiling: values with a single quote break the quoting; none do.
3. **`make dev` = `$(MAKE) db`, `$(MAKE) seed`, `$(MAKE) -j3 core web admin`.** Make runs the three servers in parallel; Ctrl-C reaches the whole foreground process group, so no `&`, `wait` or `trap`. Ceiling: a server that crashes leaves the others running until Ctrl-C, and logs interleave without prefixes. Add a supervisor if that bites. `seed` = `core-admin migrate` then `core-admin seed-demo --reset`.
4. **`ui` target, a prerequisite of `web`, `admin` and `test-web`.** Builds `packages/ui` once per make invocation, so `make -j3 core web admin` builds it once before either dev server (ui request). `make e2e` and `make prod-local` build every workspace with `npm run build --workspaces --if-present`, which runs in the root `workspaces` order (`packages/*` first, checked with npm 10.9).
5. **`test` = `test-core` then `test-web`.** Separate targets so the CI `core` and `web` jobs call exactly the same gates. `test-core`: `test -z "$(gofmt -l . | tee /dev/stderr)" && go vet ./... && go test -race ./...` (prints unformatted files, stops before `go test`). `test-web`: `npm run lint && npm run typecheck && npm run test && npm run build --workspaces --if-present` (the `ui` prerequisite already built `packages/ui`).
6. **Builds never use the root `build` script.** It names all three workspaces explicitly and fails while any is missing (`No workspaces found: --workspace=apps/web`); `--workspaces --if-present` builds what exists. The root script stays as is (out of this lane's scope; see the report).
7. **`sqlc diff` is replaced by "`make gen postman` leaves the tree clean".** In the CI `core` job: `make gen postman`, then fail on any `git status --porcelain` output. One step covers sqlc output, `packages/ui/src/api/core.d.ts` and the Postman collection. sqlc is installed with `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest` only when `services/core/sqlc.yaml` exists. Ceiling: generated files carry the sqlc version in their header, so a new sqlc release fails the check; pin the version in the change that adds `sqlc.yaml`.
8. **e2e uses `shopperstop_core_e2e`, not `_test`.** Spec 1 §6 says `_test`; Spec 2 §13, the Phase 1 plan and `deploy/initdb.sql` say `_e2e`, which keeps Playwright data apart from `go test` schemas. Scratch ports: core `:18080`, web `http://localhost:15173`, admin `http://localhost:15174`.
9. **Playwright owns server lifecycle; the Makefile owns the database and env.** `make e2e`: migrate and `seed-demo --reset` the e2e database, build every workspace, then `$(E2E_ENV) npm run e2e --workspaces --if-present`. Each app's Playwright config starts core and `vite preview` through `webServer` (inherits the env) on the ports above. No background processes in the Makefile. Guard: `services/core` and `apps/web` both present. Ceiling: a web smoke test that needs no core is skipped until core lands.
10. **CI guards are step-level `hashFiles` conditions.** A job-level `if` cannot see the checkout. Each guarded job has one step `if: hashFiles(<file>) == ''` that echoes the skip line and every other step `if: hashFiles(<file>) != ''`. Files: `services/core/go.mod` (core), `packages/ui/package.json` (web), `services/core/go.mod` and `apps/web/package.json` (e2e). `spec` has no guard; `openspec/` exists.
11. **Versions.** `actions/checkout@v4`, `actions/setup-go@v5` (`go-version-file: services/core/go.mod`), `actions/setup-node@v4` (`node-version: 22`, `cache: npm`). `22` resolves to the newest 22.x; the floor is 22.12 (Vite 8, Vitest 5, jsdom 27). Playwright installs Chromium only (`npx playwright install --with-deps chromium`). OpenSpec CLI `@fission-ai/openspec@latest`; ceiling: a breaking CLI release fails `spec`; pin then.
12. **`make prod-local`** = build every workspace, `docker compose -f $(CURDIR)/deploy/docker-compose.yml --profile prod up -d --wait`, then `core-admin migrate` and `go run ./cmd/core` in the foreground with `CORE_ENV`. No seed (run `make seed` once). Ceilings: `go run`, not a release binary; Caddy reaching `host.docker.internal` needs `extra_hosts` on Linux (deploy/, out of scope).

## The Makefile

Recipe lines start with a tab. The header comment, `SHELL` line and `db` target stay byte-identical; only the `.PHONY` line grows.

```make
# Local development. Needs Docker, Go and Node (see README.md). GNU make 3.81 or newer.
SHELL = /bin/sh
.PHONY: db dev seed core ui web admin test test-core test-web e2e gen postman prod-local

# Spec 1 §7 defaults; override from the shell or the command line. Passed inline to core commands only.
SHOPPERSTOP_CORE_DATABASE_URL ?= postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core?sslmode=disable
SHOPPERSTOP_CORE_ADDR ?= :8080
SHOPPERSTOP_CORE_SESSION_PEPPER ?= dev-pepper-dev-pepper-dev-pepper-00
SHOPPERSTOP_CORE_FILES_DIR ?= $(CURDIR)/services/core/data/files
SHOPPERSTOP_CORE_WEB_ORIGINS ?= http://localhost:5173,http://localhost:5174
SHOPPERSTOP_CORE_TEST_DATABASE_URL ?= postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable
CORE_ENV = SHOPPERSTOP_CORE_DATABASE_URL='$(SHOPPERSTOP_CORE_DATABASE_URL)' SHOPPERSTOP_CORE_ADDR='$(SHOPPERSTOP_CORE_ADDR)' SHOPPERSTOP_CORE_SESSION_PEPPER='$(SHOPPERSTOP_CORE_SESSION_PEPPER)' SHOPPERSTOP_CORE_FILES_DIR='$(SHOPPERSTOP_CORE_FILES_DIR)' SHOPPERSTOP_CORE_WEB_ORIGINS='$(SHOPPERSTOP_CORE_WEB_ORIGINS)'
# make e2e: fixed values, not overridable, so dev values never leak in.
E2E_ENV = SHOPPERSTOP_CORE_DATABASE_URL='postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_e2e?sslmode=disable' SHOPPERSTOP_CORE_ADDR=':18080' SHOPPERSTOP_CORE_SESSION_PEPPER='e2e-pepper-e2e-pepper-e2e-pepper-00' SHOPPERSTOP_CORE_FILES_DIR='$(CURDIR)/services/core/data/e2e-files' SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:15173,http://localhost:15174'

db:
	docker compose -f $(CURDIR)/deploy/docker-compose.yml up -d --wait postgres

# ponytail: make -j3 runs the servers and Ctrl-C stops the process group; a crashed server leaves the others up until Ctrl-C, logs interleave.
dev:
	$(MAKE) db
	$(MAKE) seed
	$(MAKE) -j3 core web admin

seed:
	@if test -d services/core; then \
	  cd services/core && $(CORE_ENV) go run ./cmd/core-admin migrate && $(CORE_ENV) go run ./cmd/core-admin seed-demo --reset; \
	else echo "seed: services/core absent, skipping"; fi

core:
	@if test -d services/core; then cd services/core && $(CORE_ENV) go run ./cmd/core; \
	else echo "core: services/core absent, skipping"; fi

ui:
	@if test -d packages/ui; then npm run build --workspace packages/ui; \
	else echo "ui: packages/ui absent, skipping"; fi

web: ui
	@if test -d apps/web; then npm run dev --workspace apps/web; \
	else echo "web: apps/web absent, skipping"; fi

admin: ui
	@if test -d apps/admin; then npm run dev --workspace apps/admin; \
	else echo "admin: apps/admin absent, skipping"; fi

test: test-core test-web

test-core:
	@if test -d services/core; then \
	  cd services/core && test -z "$$(gofmt -l . | tee /dev/stderr)" && go vet ./... && \
	  SHOPPERSTOP_CORE_TEST_DATABASE_URL='$(SHOPPERSTOP_CORE_TEST_DATABASE_URL)' go test -race ./...; \
	else echo "test-core: services/core absent, skipping"; fi

test-web: ui
	@if test -d packages/ui; then \
	  npm run lint && npm run typecheck && npm run test && npm run build --workspaces --if-present; \
	else echo "test-web: packages/ui absent, skipping"; fi

e2e:
	@if test -d services/core && test -d apps/web; then \
	  (cd services/core && $(E2E_ENV) go run ./cmd/core-admin migrate && $(E2E_ENV) go run ./cmd/core-admin seed-demo --reset) && \
	  npm run build --workspaces --if-present && $(E2E_ENV) npm run e2e --workspaces --if-present; \
	else echo "e2e: services/core or apps/web absent, skipping"; fi

gen:
	@if test -f services/core/sqlc.yaml; then cd services/core && sqlc generate; \
	else echo "gen: services/core/sqlc.yaml absent, skipping"; fi
	@if test -d packages/ui; then npm run gen:api --workspace packages/ui --if-present; \
	else echo "gen: packages/ui absent, skipping"; fi

postman:
	@if test -f scripts/postman.mjs; then npm run postman; \
	else echo "postman: scripts/postman.mjs absent, skipping"; fi

prod-local:
	@if test -d services/core && test -d apps/web && test -d apps/admin; then \
	  npm run build --workspaces --if-present && \
	  docker compose -f $(CURDIR)/deploy/docker-compose.yml --profile prod up -d --wait && \
	  cd services/core && $(CORE_ENV) go run ./cmd/core-admin migrate && $(CORE_ENV) go run ./cmd/core; \
	else echo "prod-local: services/core, apps/web or apps/admin absent, skipping"; fi
```

## The workflow

`.github/workflows/ci.yml`. Gotcha: `run: echo "core: ..."` is invalid YAML (a colon followed by a space inside a plain scalar); quote the whole value as `run: 'echo "core: services/core absent, skipping"'`.

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read

jobs:
  core:
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
      SHOPPERSTOP_CORE_TEST_DATABASE_URL: postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable
    steps:
      - uses: actions/checkout@v4
      - if: hashFiles('services/core/go.mod') == ''
        run: 'echo "core: services/core absent, skipping"'
      - if: hashFiles('services/core/go.mod') != ''
        uses: actions/setup-go@v5
        with:
          go-version-file: services/core/go.mod
          cache-dependency-path: services/core/go.sum
      - if: hashFiles('services/core/go.mod') != ''
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - if: hashFiles('services/core/go.mod') != ''
        run: npm ci
      - if: hashFiles('services/core/go.mod') != ''
        run: psql -v ON_ERROR_STOP=1 -h localhost -U postgres -f deploy/initdb.sql
        env:
          PGPASSWORD: postgres
      - if: hashFiles('services/core/go.mod') != ''
        run: make test-core
      - if: hashFiles('services/core/sqlc.yaml') != ''
        run: go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
      - if: hashFiles('services/core/go.mod') != ''
        run: |
          make gen postman
          git status --porcelain
          test -z "$(git status --porcelain)"

  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - if: hashFiles('packages/ui/package.json') == ''
        run: 'echo "web: packages/ui absent, skipping"'
      - if: hashFiles('packages/ui/package.json') != ''
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - if: hashFiles('packages/ui/package.json') != ''
        run: npm ci
      - if: hashFiles('packages/ui/package.json') != ''
        run: make test-web

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 2s --health-timeout 2s --health-retries 30
    steps:
      - uses: actions/checkout@v4
      - if: hashFiles('services/core/go.mod') == '' || hashFiles('apps/web/package.json') == ''
        run: 'echo "e2e: services/core or apps/web absent, skipping"'
      - if: hashFiles('services/core/go.mod') != '' && hashFiles('apps/web/package.json') != ''
        uses: actions/setup-go@v5
        with:
          go-version-file: services/core/go.mod
          cache-dependency-path: services/core/go.sum
      - if: hashFiles('services/core/go.mod') != '' && hashFiles('apps/web/package.json') != ''
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - if: hashFiles('services/core/go.mod') != '' && hashFiles('apps/web/package.json') != ''
        run: |
          npm ci
          npx playwright install --with-deps chromium
          PGPASSWORD=postgres psql -v ON_ERROR_STOP=1 -h localhost -U postgres -f deploy/initdb.sql
          make e2e

  spec:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm i -g @fission-ai/openspec@latest
      - run: openspec validate --all --strict
```

## Files

`Makefile`, `.github/workflows/ci.yml`, plus this change folder and `.claude/lanes/platform-P1-L9.md`. All in the platform area.

## Test strategy

There is no test framework for a Makefile or a workflow, so no task starts from a committed failing test. The red step is behavioural and recorded in the lane log: before the change, `make test` prints `make: *** No rule to make target 'test'`; after it, the scenario commands below pass. Scenarios and how each is checked:

- Skip lines, `make -n dev`, override, e2e isolation, `make -n prod-local`, gen halves, `make -n postman`: run on the worktree (and, for present-directory cases, in a scratch copy with empty `services/core`, `apps/web`, `packages/ui` directories). Never run `make dev`, `make db` or `make prod-local` without `-n`: they start containers (guard hook).
- Unformatted Go fails: in a scratch copy with `services/core/x.go` badly formatted, `make test-core` prints `x.go` and exits non-zero.
- Workflow shape: YAML parse plus a job and trigger check (tasks.md 2.2). `act` and `actionlint` are not installed.
- Foundation tree is green, CI core, web, e2e, spec behaviour: the PR's own CI run (all four jobs green, three skip lines), read by the manager. The stale-Postman, core-database and failing-web-test scenarios first become exercisable when core, Task 12 and ui land; their PRs' CI runs are the evidence, and the acceptance names them as pending until then.
- Interrupt stops every server, ui built once for `make dev`: the orchestrator's `make dev` check at phase close (Spec 1 §12).

## Risks / Trade-offs

- `make dev` and `make e2e` call `core-admin seed-demo --reset`, which core plans for Phase 2; until it exists both fail at that step once `services/core` lands (escalated).
- The owner's machine runs Node 22.11.0, below the 22.12 floor the ui area needs.
- `sqlc@latest` and `openspec@latest` float (Decisions 7 and 11).
