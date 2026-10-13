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
	@if test -d packages/ui; then test -d node_modules || npm ci; npm run build --workspace packages/ui; \
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
	@if test -d services/core && { test -d apps/web || test -d apps/admin; }; then \
	  (cd services/core && $(E2E_ENV) go run ./cmd/core-admin migrate && $(E2E_ENV) go run ./cmd/core-admin seed-demo --reset) && \
	  npm run build --workspaces --if-present && $(E2E_ENV) npm run e2e --workspaces --if-present; \
	else echo "e2e: services/core, or both apps/web and apps/admin, absent, skipping"; fi

gen:
	@if test -f services/core/sqlc.yaml; then cd services/core && sqlc generate; \
	else echo "gen: services/core/sqlc.yaml absent, skipping"; fi
	@if test -d packages/ui; then npm run gen:api --workspace packages/ui --if-present; \
	else echo "gen: packages/ui absent, skipping"; fi

postman:
	@if test -f scripts/postman.mjs; then npm run postman && node --test scripts/postman.test.mjs; \
	else echo "postman: scripts/postman.mjs absent, skipping"; fi

prod-local:
	@if test -d services/core && test -d apps/web && test -d apps/admin; then \
	  npm run build --workspaces --if-present && \
	  docker compose -f $(CURDIR)/deploy/docker-compose.yml --profile prod up -d --wait && \
	  cd services/core && $(CORE_ENV) go run ./cmd/core-admin migrate && $(CORE_ENV) go run ./cmd/core; \
	else echo "prod-local: services/core, apps/web or apps/admin absent, skipping"; fi
