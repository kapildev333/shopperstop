## ADDED Requirements

### Requirement: Make targets skip absent parts

Every Makefile target that drives a directory or file SHALL check that it exists and, when it does not, print one line `<target>: <path> absent, skipping` and exit 0, so the targets are green on a tree where `services/core`, `packages/ui`, `apps/web`, `apps/admin` or `scripts/postman.mjs` have not landed yet.

#### Scenario: Targets skip on the foundation tree
- **WHEN** `make test`, `make e2e`, `make gen`, `make postman`, `make seed`, `make core`, `make ui`, `make web`, `make admin` and `make prod-local` each run on a tree without `services/core`, `packages/ui`, `apps/web`, `apps/admin` and `scripts/postman.mjs`
- **THEN** each exits 0, every line it prints is a skip line naming a target and an absent path, and none of them runs `go`, `npm` or `docker`

#### Scenario: A present directory is not skipped
- **WHEN** `services/core` exists and `make test` runs
- **THEN** it prints no `test-core` skip line and runs `gofmt -l .`, `go vet ./...` and `go test -race ./...` in `services/core`

### Requirement: make dev runs the whole stack

`make dev` SHALL run `make db`, then from `services/core` `core-admin migrate` and `core-admin seed-demo --reset`, then core, the web app and the admin app side by side until interrupted. Core commands SHALL receive `SHOPPERSTOP_CORE_DATABASE_URL`, `_ADDR`, `_SESSION_PEPPER`, `_FILES_DIR` and `_WEB_ORIGINS` with the Spec 1 §7 defaults, each overridable from the shell or the make command line.

#### Scenario: Dry run shows the full sequence with defaults
- **WHEN** `make -n dev` runs with no `SHOPPERSTOP_CORE_*` variable in the environment
- **THEN** it prints, in order, the `docker compose ... up -d --wait postgres` command, `go run ./cmd/core-admin migrate`, `go run ./cmd/core-admin seed-demo --reset`, then `go run ./cmd/core`, `npm run dev --workspace apps/web` and `npm run dev --workspace apps/admin`, and the core commands carry `SHOPPERSTOP_CORE_ADDR=':8080'` and the `shopperstop_core` database URL

#### Scenario: A variable is overridden
- **WHEN** `make -n core SHOPPERSTOP_CORE_ADDR=:9090` runs with `services/core` present
- **THEN** the printed core command carries `SHOPPERSTOP_CORE_ADDR=':9090'`

#### Scenario: Interrupt stops every server
- **WHEN** `make dev` is running the three servers and the user presses Ctrl-C
- **THEN** core, the web dev server and the admin dev server all exit

### Requirement: Apps build against a fresh packages/ui

The apps import the `packages/ui` build output, so `make web`, `make admin`, `make test`, `make e2e`, `make prod-local` and the CI `web` and `e2e` jobs SHALL build `packages/ui` before any app command (dev server, lint, typecheck, test, build or e2e). `make ui` SHALL build it alone.

#### Scenario: Web dev server starts after the ui build
- **WHEN** `packages/ui` and `apps/web` exist and `make web` runs
- **THEN** `npm run build --workspace packages/ui` completes before `npm run dev --workspace apps/web` starts

#### Scenario: One ui build for both dev servers
- **WHEN** `make dev` starts the servers
- **THEN** `packages/ui` is built once, before either app's dev server starts

### Requirement: make test runs core then web gates

`make test` SHALL run the core gates from `services/core` (`gofmt -l .` prints nothing, `go vet ./...`, `go test -race ./...` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL`, default the local `shopperstop_core_test` database) and then the web gates from the root workspace (lint, typecheck, test, build of every workspace, `packages/ui` first), and SHALL exit non-zero when any gate fails.

#### Scenario: Unformatted Go fails the gate
- **WHEN** a `.go` file under `services/core` is not gofmt-formatted and `make test` runs
- **THEN** it prints the file's path and exits non-zero before running `go test`

#### Scenario: Build runs only the workspaces that exist
- **WHEN** `packages/ui` exists, `apps/web` and `apps/admin` do not, and `make test` runs
- **THEN** the web gates lint, typecheck, test and build `packages/ui` and exit 0 without naming the absent apps

### Requirement: make e2e is isolated from dev

`make e2e` SHALL migrate and reseed the `shopperstop_core_e2e` database, build every workspace, and run each workspace's `e2e` script with a complete core environment of its own: database `shopperstop_core_e2e`, core on port 18080, web origin `http://localhost:15173`, admin origin `http://localhost:15174`, and an e2e-only pepper. Values from the developer's shell or the dev defaults SHALL NOT reach it.

#### Scenario: Dev variables do not leak into e2e
- **WHEN** the shell exports `SHOPPERSTOP_CORE_DATABASE_URL` pointing at `shopperstop_core` and `make -n e2e` runs with `services/core` and `apps/web` present
- **THEN** every printed core and `npm run e2e` command carries `SHOPPERSTOP_CORE_DATABASE_URL` for `shopperstop_core_e2e` and `SHOPPERSTOP_CORE_ADDR=':18080'`

### Requirement: make gen and make postman regenerate committed files

`make gen` SHALL run `sqlc generate` in `services/core` when `services/core/sqlc.yaml` exists and then the `gen:api` script of `packages/ui` when that workspace defines it; each half skips on its own. `make postman` SHALL run the root `postman` script, which writes `docs/postman/shopperstop-core.postman_collection.json`.

#### Scenario: gen halves skip independently
- **WHEN** `services/core` exists without `sqlc.yaml`, `packages/ui` exists, and `make gen` runs
- **THEN** it prints `gen: services/core/sqlc.yaml absent, skipping` and still runs `npm run gen:api --workspace packages/ui --if-present`

#### Scenario: postman runs the root script
- **WHEN** `scripts/postman.mjs` exists and `make -n postman` runs
- **THEN** it prints `npm run postman`

### Requirement: make prod-local serves the builds through Caddy

`make prod-local` SHALL build every workspace, start the compose `prod` profile (Postgres and Caddy on port 80), migrate the core database and run core on the host with the dev environment, so `http://localhost/` serves the web build, `/admin/` the admin build and `/api/core/` the core service.

#### Scenario: Dry run shows build, Caddy and core
- **WHEN** `make -n prod-local` runs with `services/core`, `apps/web` and `apps/admin` present
- **THEN** it prints `npm run build --workspaces --if-present`, `docker compose -f <repo>/deploy/docker-compose.yml --profile prod up -d --wait`, `go run ./cmd/core-admin migrate` and `go run ./cmd/core`, in that order

### Requirement: CI runs four jobs

`.github/workflows/ci.yml` SHALL define workflow `ci`, triggered by every pull request and every push to `main`, with read-only repository permissions and exactly the jobs `core`, `web`, `e2e` and `spec` on `ubuntu-latest`, using actions pinned to major versions, Go from `services/core/go.mod` and Node 22.

#### Scenario: Workflow shape
- **WHEN** `.github/workflows/ci.yml` is parsed as YAML
- **THEN** its name is `ci`, its triggers are `pull_request` and `push` to `main`, and its jobs are exactly `core`, `web`, `e2e` and `spec`

### Requirement: CI jobs skip absent directories

The `core`, `web` and `e2e` jobs SHALL each print one skip line naming the absent path and succeed without setting up toolchains while the files they need are absent: `services/core/go.mod` for `core`, `packages/ui/package.json` for `web`, both `services/core/go.mod` and `apps/web/package.json` for `e2e`. The `spec` job always runs.

#### Scenario: Foundation tree is green
- **WHEN** CI runs on a pull request whose tree has no `services/core`, `packages/ui` or `apps/*`
- **THEN** all four jobs succeed, and the `core`, `web` and `e2e` logs each show their skip line

### Requirement: CI core job gates core and generated files

When `services/core/go.mod` exists, the `core` job SHALL start a `postgres:16` service, apply `deploy/initdb.sql` to it, run the core gates of `make test` against `shopperstop_core_test`, then run `make gen` and `make postman` and fail if either left the working tree different from the commit.

#### Scenario: Stale Postman collection fails CI
- **WHEN** a pull request changes `services/core/openapi.json` without regenerating `docs/postman/shopperstop-core.postman_collection.json`
- **THEN** the `core` job fails and its log names the collection file

#### Scenario: Core tests reach the CI database
- **WHEN** the `core` job runs `go test -race ./...`
- **THEN** the tests connect as `shopperstop_core` to `shopperstop_core_test` on the job's Postgres service

### Requirement: CI web, e2e and spec jobs

The `web` job SHALL run `npm ci` then the web gates of `make test`. The `e2e` job SHALL start a `postgres:16` service loaded from `deploy/initdb.sql`, install the Playwright Chromium browser and run `make e2e`. The `spec` job SHALL install the OpenSpec CLI and run `openspec validate --all --strict`.

#### Scenario: Invalid OpenSpec change fails CI
- **WHEN** a pull request adds a requirement without a `#### Scenario:`
- **THEN** the `spec` job fails

#### Scenario: Failing web test fails CI
- **WHEN** a pull request makes a Vitest test in `packages/ui` fail
- **THEN** the `web` job fails
