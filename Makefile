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
