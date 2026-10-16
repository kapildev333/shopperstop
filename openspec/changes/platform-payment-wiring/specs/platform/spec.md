## MODIFIED Requirements

### Requirement: One database and owner role per service

The local Postgres SHALL be initialised from `deploy/initdb.sql`, which creates for each service, `core`, `rider` and `payment`, a login role named `shopperstop_<service>` with password `shopperstop_<service>` and the databases `shopperstop_<service>`, `shopperstop_<service>_test` and `shopperstop_<service>_e2e`, all owned by that role. No role SHALL own another service's database.

#### Scenario: Core role reaches its test database
- **WHEN** Postgres has been initialised from `deploy/initdb.sql` and a client connects to `localhost:5432` as `shopperstop_core` with password `shopperstop_core` to database `shopperstop_core_test`
- **THEN** `select 1` returns `1`

#### Scenario: Core owns all three of its databases
- **WHEN** `select datname from pg_database where pg_get_userbyid(datdba) = 'shopperstop_core'` runs on the initialised Postgres
- **THEN** it returns exactly `shopperstop_core`, `shopperstop_core_test` and `shopperstop_core_e2e`

#### Scenario: Rider role reaches its test database
- **WHEN** Postgres has the rider statements of `deploy/initdb.sql` applied and a client connects to `localhost:5432` as `shopperstop_rider` with password `shopperstop_rider` to database `shopperstop_rider_test`
- **THEN** `select 1` returns `1`

#### Scenario: Rider owns all three of its databases
- **WHEN** `select datname from pg_database where pg_get_userbyid(datdba) = 'shopperstop_rider'` runs on that Postgres
- **THEN** it returns exactly `shopperstop_rider`, `shopperstop_rider_e2e` and `shopperstop_rider_test`

#### Scenario: Payment role reaches its test database
- **WHEN** Postgres has the payment statements of `deploy/initdb.sql` applied and a client connects to `localhost:5432` as `shopperstop_payment` with password `shopperstop_payment` to database `shopperstop_payment_test`
- **THEN** `select 1` returns `1`

#### Scenario: Payment owns all three of its databases
- **WHEN** `select datname from pg_database where pg_get_userbyid(datdba) = 'shopperstop_payment' order by 1` runs on that Postgres
- **THEN** it returns exactly `shopperstop_payment`, `shopperstop_payment_e2e` and `shopperstop_payment_test`

#### Scenario: initdb.sql holds four statements per service
- **WHEN** `deploy/initdb.sql` is read
- **THEN** it holds exactly twelve lines: the four core statements, the four rider statements, then `create role shopperstop_payment login password 'shopperstop_payment';`, `create database shopperstop_payment owner shopperstop_payment;`, `create database shopperstop_payment_test owner shopperstop_payment;` and `create database shopperstop_payment_e2e owner shopperstop_payment;`

### Requirement: Caddy routes each prefix to its service or app

`deploy/Caddyfile` SHALL route `/api/core/*` to the core process on port 8080, `/api/rider/*` to the rider process on port 8081, `/api/payment/*` to the payment process on port 8082, `/admin/*` to `/srv/apps/admin/dist` and `/rider/*` to `/srv/apps/rider/dist`, each app with its prefix stripped and SPA fallback to `index.html`, and every other path to `/srv/apps/web/dist` with SPA fallback. Payment has no app and no static route.

#### Scenario: Caddyfile routes the three prefixes
- **WHEN** `deploy/Caddyfile` is read
- **THEN** it has a `handle /api/core/*` block with `reverse_proxy host.docker.internal:8080`, a `handle /admin/*` block with `uri strip_prefix /admin` and `try_files {path} /index.html` rooted at `/srv/apps/admin/dist`, and a catch-all `handle` rooted at `/srv/apps/web/dist` with the same `try_files`

#### Scenario: Caddyfile routes the rider prefixes
- **WHEN** `deploy/Caddyfile` is read
- **THEN** it has a `handle /api/rider/*` block with `reverse_proxy host.docker.internal:8081` and a `handle /rider/*` block with `uri strip_prefix /rider` and `try_files {path} /index.html` rooted at `/srv/apps/rider/dist`

#### Scenario: Caddyfile routes the payment prefix
- **WHEN** `deploy/Caddyfile` is read
- **THEN** it has a `handle /api/payment/*` block with `reverse_proxy host.docker.internal:8082` after the `/api/rider/*` block and before the `/admin/*` block, no `handle /payment/*` block, and `try_files {path} /index.html` in exactly three blocks

### Requirement: Postman collection is generated from the contract

`make postman` SHALL write `docs/postman/shopperstop-<service>.postman_collection.json` for `core`, `rider` and `payment` from `services/<service>/openapi.json` alone: a folder per tag in tag order, a request per operation named by its `summary`, URLs rooted at `{{baseUrl}}`, `{{riderBaseUrl}}` or `{{paymentBaseUrl}}` by service, each request body example as the raw JSON body. An invalid OpenAPI document SHALL make it exit non-zero without writing the collection.

#### Scenario: Folders follow the contract tags
- **WHEN** `make postman` runs against the Phase 1 contract
- **THEN** the collection has one folder `platform` holding `GET {{baseUrl}}/healthz` named `Liveness` and `GET {{baseUrl}}/readyz` named `Readiness`

#### Scenario: Request carries its example body
- **WHEN** the contract has `POST /auth/sign-in` with request body example `{"email":"customer@example.com","password":"password123"}`
- **THEN** that request's raw body parses to the same object

#### Scenario: Invalid contract is refused
- **WHEN** the generator is given a document without an `openapi` version
- **THEN** it fails with an error and no collection is written

#### Scenario: Rider URLs read the rider base URL
- **WHEN** the generator converts a rider contract with `servers` `/api/rider/v1` and `GET /healthz`
- **THEN** every request's URL host is `{{riderBaseUrl}}` and the collection text contains no `{{baseUrl}}`

#### Scenario: Payment URLs read the payment base URL
- **WHEN** the generator converts a payment contract with `servers` `/api/payment/v1`, `GET /healthz` and `POST /me/payments`
- **THEN** every request's URL host is `{{paymentBaseUrl}}` and the collection text contains no `{{baseUrl}}`

### Requirement: Postman skips a service without a contract

A service whose `services/<service>/openapi.json` is absent SHALL be skipped by `make postman` with the line `postman: services/<service>/openapi.json absent, skipping` and no collection written for it; once the contract exists, its committed collection SHALL match the generator's output.

#### Scenario: Rider skipped while its contract is absent
- **WHEN** `make postman` runs on a tree without `services/rider/openapi.json`
- **THEN** it prints `postman: services/rider/openapi.json absent, skipping`, writes no `docs/postman/shopperstop-rider.postman_collection.json`, and the core collection is byte-identical to the one committed before this change

#### Scenario: Committed rider collection matches the rider contract
- **WHEN** `services/rider/openapi.json` exists and `node --test scripts/postman.test.mjs` runs
- **THEN** it fails unless `docs/postman/shopperstop-rider.postman_collection.json` equals the generator's output for that contract

#### Scenario: Payment skipped while its contract is absent
- **WHEN** `make postman` runs on a tree without `services/payment/openapi.json`
- **THEN** it prints `postman: services/payment/openapi.json absent, skipping`, writes no `docs/postman/shopperstop-payment.postman_collection.json`, and the core collection is byte-identical to the committed one

#### Scenario: Committed payment collection matches the payment contract
- **WHEN** `services/payment/openapi.json` exists and `node --test scripts/postman.test.mjs` runs
- **THEN** it fails unless `docs/postman/shopperstop-payment.postman_collection.json` equals the generator's output for that contract

### Requirement: Postman requests authenticate from environment tokens

Every operation the contract marks with a bearer `security` requirement SHALL carry bearer auth reading `{{serviceToken}}` when the operation has `x-service-token: true`; otherwise `{{staffToken}}` when its path starts with `/admin/`; otherwise, in the rider collection, `{{riderToken}}` when its path starts with `/auth/` or is or starts with `/me`, and `{{customerToken}}` for every other path of any collection. Operations without `security` SHALL carry no auth.

#### Scenario: Customer route
- **WHEN** the contract marks `GET /orders/{id}` with bearer security
- **THEN** its request carries bearer auth `{{customerToken}}`

#### Scenario: Staff route
- **WHEN** the contract marks `GET /admin/me` with bearer security
- **THEN** its request carries bearer auth `{{staffToken}}`

#### Scenario: Public route
- **WHEN** the collection is generated from the Phase 1 contract
- **THEN** `Liveness` and `Readiness` carry no auth

#### Scenario: Rider routes
- **WHEN** a rider contract marks `GET /me`, `GET /me/deliveries/{id}`, `GET /admin/riders/{id}` and `GET /orders/{orderId}/delivery` with bearer security
- **THEN** their requests carry `{{riderToken}}`, `{{riderToken}}`, `{{staffToken}}` and `{{customerToken}}` in that order

#### Scenario: Payment routes
- **WHEN** a payment contract marks `POST /me/payments`, `GET /me/payments/{id}` and `GET /orders/{orderId}/payment` with bearer security and leaves `GET /healthz`, `POST /webhooks/razorpay` and `GET /fake/{id}` without security
- **THEN** the first three carry `{{customerToken}}`, and the last three carry no auth and no test script

#### Scenario: Service route
- **WHEN** the contract marks `GET /admin/stores` with bearer security and `x-service-token: true`, and `GET /admin/me` with bearer security only
- **THEN** `GET /admin/stores` carries bearer auth `{{serviceToken}}` and `GET /admin/me` carries `{{staffToken}}`

#### Scenario: Core service routes
- **WHEN** the collection is generated from `services/core/openapi.json`
- **THEN** the requests carrying `{{serviceToken}}` are exactly the operations that contract marks `x-service-token: true` (today `GET /admin/stores`, `GET /admin/stores/{id}`, `GET /admin/stores/{id}/orders`, `GET /admin/orders/{id}` and `POST /admin/orders/{id}/status`)

### Requirement: Path ids read environment variables

A path parameter named `id` directly after the segment `stores`, `products`, `addresses`, `orders`, `riders`, `deliveries` or `payments`, or named exactly like that segment's variable (`{orderId}` after `orders`), SHALL take `{{storeId}}`, `{{productId}}`, `{{addressId}}`, `{{orderId}}`, `{{riderId}}`, `{{deliveryId}}` or `{{paymentId}}` in the request and in every saved response's `originalRequest`; other path parameters SHALL keep the contract's example.

#### Scenario: Order id
- **WHEN** the contract has `GET /orders/{id}`
- **THEN** the request's `id` path variable is `{{orderId}}`

#### Scenario: Rider and delivery ids
- **WHEN** a rider contract has `GET /admin/riders/{id}`, `GET /me/deliveries/{id}` and `GET /orders/{orderId}/delivery`
- **THEN** their path variables are `id` = `{{riderId}}`, `id` = `{{deliveryId}}` and `orderId` = `{{orderId}}`

#### Scenario: Payment ids
- **WHEN** a payment contract has `GET /me/payments/{id}`, `GET /orders/{orderId}/payment` and `GET /fake/{id}` with `id` example `p1`
- **THEN** their path variables are `id` = `{{paymentId}}`, `orderId` = `{{orderId}}` and `id` = `p1`

#### Scenario: Slug keeps its example
- **WHEN** the contract has `GET /stores/{id}/products/{slug}` with `slug` example `banana-robusta`
- **THEN** the path variables are `id` = `{{storeId}}` and `slug` = `banana-robusta`

#### Scenario: Saved responses read the same ids
- **WHEN** the contract has `GET /orders/{id}` with `id` example `o1` and a documented 200 example response
- **THEN** every saved response's `originalRequest` has the `id` path variable `{{orderId}}`, not `o1`

### Requirement: Local Postman environment

`docs/postman/local.postman_environment.json` SHALL be a Postman environment holding exactly, in this order, `baseUrl` = `http://localhost:8080/api/core/v1`, empty `customerToken` and `staffToken`, `storeId`, `productId`, `addressId`, `orderId` set to the fixed ids that `core-admin seed-demo` loads and prints for a demo store, product, address and order, then the four rider variables, then the two payment variables, then `serviceToken`. Token variables SHALL have type `secret`.

#### Scenario: Environment variables
- **WHEN** the environment file is read
- **THEN** its variable keys are exactly `baseUrl`, `customerToken`, `staffToken`, `storeId`, `productId`, `addressId`, `orderId`, `riderBaseUrl`, `riderToken`, `riderId`, `deliveryId`, `paymentBaseUrl`, `paymentId`, `serviceToken` in that order, `baseUrl` is `http://localhost:8080/api/core/v1`, `riderBaseUrl` is `http://localhost:8081/api/rider/v1`, `paymentBaseUrl` is `http://localhost:8082/api/payment/v1`, `customerToken`, `staffToken` and `riderToken` are empty, and all four token variables have type `secret`

#### Scenario: Ids are the seeded rows
- **WHEN** `seed-demo --reset` has run and the environment file is read
- **THEN** `storeId` is `00000000-0000-4000-8000-000000000401`, `productId` `00000000-0000-4000-8000-000000000601`, `addressId` `00000000-0000-4000-8000-000000000301` and `orderId` `00000000-0000-4000-8000-000000000703`, each the id the `seed-demo` output marks with that variable name and one row of `stores`, `products`, `addresses` and `orders`

### Requirement: Repository documentation matches the tree

The repository SHALL have a `README.md` whose quick start runs the stack with `make dev`, whose sign-in table lists the Spec 2 §11 demo accounts and the Phase 3 demo riders, whose "Mobile app" section says how to run the customer mobile app with Expo, and which names the payment service and its local fake gateway. Every `make` target the README or `CLAUDE.md` names SHALL exist in the `Makefile`, and every relative link in either file SHALL resolve to a path in the tree.

#### Scenario: README has the quick start
- **WHEN** `README.md` is read
- **THEN** it has a `## Quick start` section with a code block containing `make dev`, names the prerequisites Docker (running), Go 1.27 and Node 22.12 or newer, names core on `:8080`, web on `:5173`, admin on `:5174/admin/`, the rider service on `:8081`, the rider app on `:5175/rider/` and the payment service on `:8082` with `SHOPPERSTOP_PAYMENT_GATEWAY=fake`, and does not contain `` not on `main` yet ``

#### Scenario: README has the step-by-step fold and the screenshots table
- **WHEN** `README.md` is read
- **THEN** it has a `<details>` block with numbered steps that start Postgres, apply migrations and the seed, and run core without `make dev`, and a `## Screenshots` section with a Markdown table

#### Scenario: README lists the demo sign-ins
- **WHEN** `README.md` is read
- **THEN** it contains `admin@shopperstop.local` with `admin12345`, `koramangala@shopperstop.local` and `indiranagar@shopperstop.local` with `staff12345`, and `demo@shopperstop.local` with `demo12345`, says the accounts are loaded by `seed-demo --reset` from Phase 2, and contains `rider1-koramangala@shopperstop.local` with `rider12345` as loaded by `rider-admin seed-demo --reset` from Phase 3

#### Scenario: README tells an existing clone how to add the rider databases
- **WHEN** `README.md` is read
- **THEN** it says that `deploy/initdb.sql` runs only when the Postgres volume is created and gives one command that applies the file's `shopperstop_rider` lines to the running `shopperstop-postgres-1` as `postgres` without `psql` on the host

#### Scenario: README tells an existing clone how to add the payment databases
- **WHEN** `README.md` is read
- **THEN** it has a paragraph starting `**Cloned before Phase 5?**` with the command `grep shopperstop_payment deploy/initdb.sql | docker exec -i shopperstop-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres`

#### Scenario: README names the payment targets and contract
- **WHEN** `README.md` is read on a tree without `services/payment`
- **THEN** its commands table has rows for `make test-payment` and `make payment`, names `shopperstop_payment_e2e` and `packages/ui/src/api/payment.d.ts`, its `## API` section names `paymentBaseUrl` and `paymentId`, it says `` `payment` from Phase 5 ``, and no Markdown link points into `services/payment`

#### Scenario: README says how to run the mobile app
- **WHEN** `README.md` is read on a tree with `apps/mobile`
- **THEN** its `## Status` section names `v0.3.0` and says Phase 4 is in progress on `main`, and it has a `## Mobile app` section containing `cd apps/mobile && npx expo start --port 5176`, `Expo Go`, `EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080`, `localhost:5176` and the link `[apps/mobile/README.md](apps/mobile/README.md)`

#### Scenario: Relative links resolve
- **WHEN** every Markdown link target in `README.md` and `CLAUDE.md` that does not start with `http` or `#` is resolved from the repository root, with any `#fragment` removed
- **THEN** each one exists in the tree

### Requirement: CLAUDE.md and docs/figma.md describe the tree

`CLAUDE.md` SHALL name every developer `make` target, the `apps/mobile/` workspace and how it is run, the `services/payment/` service and its area, and state the CI, end-to-end and Figma rules as PLAN.md D11, D14, D15, D17, D29, D36, D39 and D48 decided; `docs/figma.md` SHALL name the design canvas holding the mobile screens.

#### Scenario: CLAUDE.md names every developer make target
- **WHEN** `CLAUDE.md` is read
- **THEN** it contains `make db`, `make dev`, `make test`, `make test-core`, `make test-rider`, `make test-payment`, `make test-web`, `make e2e`, `make gen`, `make postman` and `make prod-local`, and `make -n <target>` exits 0 for each of them and for every other `make <target>` named in `README.md` or `CLAUDE.md`

#### Scenario: CLAUDE.md states the current CI, e2e and Figma rules
- **WHEN** `CLAUDE.md` is read
- **THEN** it does not contain `sqlc diff` or "No product code yet", and it contains `make gen postman`, `shopperstop_core_e2e`, `shopperstop_rider_e2e`, `shopperstop_payment_e2e`, `18080`, `18081`, `18082`, `15173`, `15174`, `15175`, `22.12`, the CI job names `rider` and `payment`, and the three Figma page names `Tokens & Components`, `Customer web` and `Admin web`

#### Scenario: CLAUDE.md names the payment service
- **WHEN** `CLAUDE.md` is read
- **THEN** its layout block has a line starting `services/payment/`, its area list contains `` `payment` (`services/payment/` ``, and it names `Phase 5`, `shopperstop-payment.postman_collection.json`, `packages/ui/src/api/payment.d.ts` and `paymentBaseUrl`

#### Scenario: CLAUDE.md names the mobile workspace
- **WHEN** `CLAUDE.md` is read
- **THEN** its layout block has a line starting `apps/mobile/`, it names Phase 4, `15176`, `5176` and `npx expo start`, and it says the mobile workspace rides on `make test-web` and `make e2e`, and it does not contain `` once `apps/mobile` lands ``

#### Scenario: docs/figma.md links the mobile design canvas
- **WHEN** `docs/figma.md` is read
- **THEN** it contains `ShopperStop App Design`, `https://claude.ai/artifact/75BFgGxUe3viRFjgvn8Ywy`, `19 artboards`, `390×844` and `tokens.css`, says the Figma file has no `Mobile` page, and does not contain `add it when the mobile app spec lands`

### Requirement: make dev runs the rider service and app

`make dev` SHALL run `make db`, then `make seed` (core, then rider, then payment: `migrate` and `seed-demo --reset`), then `core`, `rider`, `payment`, `web`, `admin` and `rider-app` side by side until interrupted. Rider commands SHALL receive the `SHOPPERSTOP_RIDER_*` dev defaults, each overridable from the shell or the make command line, and core SHALL accept the rider's dev service token and the rider app's origin.

#### Scenario: Dry run shows five servers
- **WHEN** `make -n dev` runs with `services/core`, `services/rider`, `services/payment`, `apps/web`, `apps/admin`, `apps/rider` and `packages/ui` present
- **THEN** it prints, in order, the compose `up -d --wait postgres` command, core `migrate`, rider `rider-admin migrate`, `payment-admin migrate` and `payment-admin seed-demo --reset`, `-j6 core rider payment web admin rider-app`, then `go run ./cmd/core`, `go run ./cmd/rider`, `go run ./cmd/payment` and `npm run dev` for `apps/web`

#### Scenario: Core accepts the rider's dev token
- **WHEN** `make -n core` and `make -n rider` run with no rider, payment or core token variable in the environment
- **THEN** the core command's `SHOPPERSTOP_CORE_SERVICE_TOKENS` value starts with `rider:` followed by exactly the value the rider command carries as `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN` and a comma, and both carry `http://localhost:5175` in their web origins

#### Scenario: Rider dev defaults
- **WHEN** `make -n rider` runs with `services/rider` present and no rider variable in the environment
- **THEN** the command carries `SHOPPERSTOP_RIDER_DATABASE_URL` for `shopperstop_rider` as `shopperstop_rider`, `SHOPPERSTOP_RIDER_ADDR=':8081'`, a `SHOPPERSTOP_RIDER_SESSION_PEPPER` of at least 32 bytes, `SHOPPERSTOP_RIDER_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176'`, `SHOPPERSTOP_RIDER_CORE_URL='http://localhost:8080'` and a non-empty `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN`

#### Scenario: A rider variable is overridden
- **WHEN** `make -n rider SHOPPERSTOP_RIDER_ADDR=:9091` runs with `services/rider` present
- **THEN** the printed rider command carries `SHOPPERSTOP_RIDER_ADDR=':9091'`

### Requirement: Dev origins include the mobile web export

Core's, the rider service's and the payment service's dev web origins SHALL include the mobile app's web export origin `http://localhost:5176` (D39). The mobile app has no make target: it runs from `apps/mobile` with Expo.

#### Scenario: Core accepts the mobile web export's dev origin
- **WHEN** `make -n core` runs with `SHOPPERSTOP_CORE_WEB_ORIGINS` unset in the environment
- **THEN** the core command carries `SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176'`, the `Makefile` names `localhost:5176` exactly three times (core's, the rider's and payment's dev defaults), and no `Makefile` line names `apps/mobile` or `expo`

### Requirement: make e2e gives the rider an isolated environment

`make e2e` SHALL, when `services/rider` exists, migrate and reseed `shopperstop_rider_e2e` after core's e2e database and before building the workspaces, and SHALL run every core, rider, payment and `npm run e2e` command with one fixed environment holding every service's e2e values. Values from the developer's shell or the dev defaults SHALL NOT reach it. Every service's e2e web origins SHALL include the mobile app's web export preview, `http://localhost:15176` (D39).

#### Scenario: Dev rider variables do not leak into e2e
- **WHEN** the shell exports `SHOPPERSTOP_RIDER_DATABASE_URL=leak` and `SHOPPERSTOP_CORE_DATABASE_URL=leak` and `make -n e2e` runs with `services/core`, `services/rider` and `apps/web` present
- **THEN** no printed line contains `leak`, and the printed `rider-admin migrate`, `rider-admin seed-demo --reset` and `npm run e2e` commands carry `shopperstop_rider_e2e`, `SHOPPERSTOP_RIDER_ADDR=':18081'` and `SHOPPERSTOP_RIDER_CORE_URL='http://localhost:18080'`

#### Scenario: e2e core accepts the e2e rider token
- **WHEN** `make -n e2e` runs with `services/core`, `services/rider`, `services/payment` and `apps/web` present
- **THEN** the `npm run e2e` command carries `SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:<r>,payment:<p>'` where `<r>` and `<p>` are exactly its `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN` and `SHOPPERSTOP_PAYMENT_CORE_SERVICE_TOKEN` values, each differing from its dev default and from the other

#### Scenario: e2e services accept the mobile web export preview
- **WHEN** the shell exports `SHOPPERSTOP_CORE_WEB_ORIGINS=leak` and `SHOPPERSTOP_RIDER_WEB_ORIGINS=leak` and `make -n e2e` runs
- **THEN** the printed `npm run e2e` command carries `SHOPPERSTOP_CORE_WEB_ORIGINS`, `SHOPPERSTOP_RIDER_WEB_ORIGINS` and `SHOPPERSTOP_PAYMENT_WEB_ORIGINS` each `'http://localhost:15173,http://localhost:15174,http://localhost:15175,http://localhost:15176'`, no printed line contains `leak`, and the `Makefile` names `localhost:15176` exactly three times

### Requirement: make gen runs the rider sqlc

`make gen` SHALL run `sqlc generate` in `services/core`, then `services/rider`, then `services/payment`, each when that service's `sqlc.yaml` exists, then the `gen:api` and `gen:tokens` scripts of `packages/ui`; each step skips on its own, and a second run on an unchanged tree SHALL change no file.

#### Scenario: Rider sqlc between core sqlc and the API types
- **WHEN** `make -n gen` runs with the three `sqlc.yaml` files and `packages/ui` present
- **THEN** it prints `cd services/core && sqlc generate`, then `cd services/rider && sqlc generate`, then `cd services/payment && sqlc generate`, then `npm run gen:api --workspace packages/ui --if-present`, then `npm run gen:tokens --workspace packages/ui --if-present`

#### Scenario: make gen leaves the tree clean
- **WHEN** `make gen` runs on a clean checkout of the branch
- **THEN** it exits 0 and `git status --porcelain` is empty, `packages/ui/src/tokens.ts` included

### Requirement: CI runs a rider job

`.github/workflows/ci.yml` SHALL have exactly the jobs `core`, `rider`, `payment`, `web`, `e2e` and `spec`. The `rider` job SHALL print `rider: services/rider absent, skipping` and succeed without a toolchain while `services/rider/go.mod` is absent, and otherwise run `make test-rider` against a `postgres:16` service loaded from `deploy/initdb.sql`. The `core` job's `make gen postman` clean-tree check SHALL cover every service's generated files.

#### Scenario: Workflow shape with the rider job
- **WHEN** `.github/workflows/ci.yml` is parsed as YAML
- **THEN** its jobs are exactly `core`, `rider`, `payment`, `web`, `e2e` and `spec`, and every `rider` step after checkout carries an `if:` on `hashFiles('services/rider/go.mod')`

#### Scenario: Rider tests reach the CI database
- **WHEN** the `rider` job runs `make test-rider` on a tree with `services/rider/go.mod`
- **THEN** the job's env sets `SHOPPERSTOP_RIDER_TEST_DATABASE_URL` to `shopperstop_rider` on `shopperstop_rider_test` at `localhost:5432`, and `deploy/initdb.sql` was applied to the job's Postgres before it

## ADDED Requirements

### Requirement: Payment make targets skip while the payment service is absent

The Makefile targets `payment` and `test-payment`, and the payment steps of `seed`, `e2e`, `gen` and `prod-local`, SHALL each print one line `<target>: <path> absent, skipping`, exit 0 and run no payment command while `services/payment` (for `gen`, `services/payment/sqlc.yaml`) is absent; every core, rider, web and admin command those targets ran before SHALL still run.

#### Scenario: Payment targets skip on a tree without the service
- **WHEN** `make payment` and `make test-payment` run on a tree without `services/payment`
- **THEN** each exits 0 and prints exactly `payment: services/payment absent, skipping` and `test-payment: services/payment absent, skipping` respectively

#### Scenario: Payment steps of shared targets skip
- **WHEN** `make -n seed`, `make -n e2e`, `make -n gen` and `make -n prod-local` run on a tree without `services/payment`
- **THEN** each prints `else echo "<target>: services/payment absent, skipping"; fi` (for `gen`: `else echo "gen: services/payment/sqlc.yaml absent, skipping"; fi`)

### Requirement: make dev runs the payment service

`make payment` SHALL run `go run ./cmd/payment` in `services/payment` with the `SHOPPERSTOP_PAYMENT_*` dev defaults (database `shopperstop_payment`, `:8082`, the four app origins, core at `http://localhost:8080`, a service token, gateway `fake`, public URL `http://localhost:8082`), each overridable, and core SHALL accept the payment's dev service token.

#### Scenario: Payment dev defaults
- **WHEN** `make -n payment` runs with `services/payment` present and no payment variable in the environment
- **THEN** the command carries `SHOPPERSTOP_PAYMENT_DATABASE_URL` for `shopperstop_payment` as `shopperstop_payment`, `SHOPPERSTOP_PAYMENT_ADDR=':8082'`, a `SHOPPERSTOP_PAYMENT_SESSION_PEPPER` of at least 32 bytes, `SHOPPERSTOP_PAYMENT_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176'`, `SHOPPERSTOP_PAYMENT_CORE_URL='http://localhost:8080'`, `SHOPPERSTOP_PAYMENT_GATEWAY='fake'` and `SHOPPERSTOP_PAYMENT_PUBLIC_URL='http://localhost:8082'`

#### Scenario: Core accepts the payment's dev token
- **WHEN** `make -n core`, `make -n rider` and `make -n payment` run with no token variable in the environment
- **THEN** the core command carries `SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:<r>,payment:<p>'` with `<r>` and `<p>` exactly the rider's and the payment's `_CORE_SERVICE_TOKEN` values, and `<p>` is at least 32 bytes and differs from `<r>`

#### Scenario: A payment variable is overridden
- **WHEN** `make -n payment SHOPPERSTOP_PAYMENT_ADDR=:9092` runs with `services/payment` present
- **THEN** the printed payment command carries `SHOPPERSTOP_PAYMENT_ADDR=':9092'`

### Requirement: make test runs the payment gates

`make test` SHALL run `test-core`, `test-rider`, `test-payment`, then `test-web`. `test-payment` SHALL run from `services/payment` `gofmt -l .` (failing when it prints anything), `go vet ./...` and `go test -race ./...` with `SHOPPERSTOP_PAYMENT_TEST_DATABASE_URL`, default the local `shopperstop_payment_test` database as `shopperstop_payment`.

#### Scenario: Payment gates in order
- **WHEN** `make -n test` runs with `services/core`, `services/rider`, `services/payment` and `packages/ui` present
- **THEN** the `services/payment` recipe with `gofmt -l .`, `go vet ./...` and `go test -race ./...` carrying `shopperstop_payment_test` appears after the `services/rider` recipe and before `npm run lint`

#### Scenario: Unformatted payment Go fails the gate
- **WHEN** a `.go` file under `services/payment` is not gofmt-formatted and `make test-payment` runs
- **THEN** it prints the file's path and exits non-zero before running `go test`

### Requirement: make e2e gives the payment service an isolated environment

`make e2e` SHALL, when `services/payment` exists, migrate and reseed `shopperstop_payment_e2e` after the rider's e2e database and before building the workspaces, with fixed payment values: `:18082`, core at `http://localhost:18080`, gateway `fake`, public URL `http://localhost:18082`, the four preview origins and an e2e service token that core's e2e value accepts.

#### Scenario: Dev payment variables do not leak into e2e
- **WHEN** the shell exports `SHOPPERSTOP_PAYMENT_DATABASE_URL`, `SHOPPERSTOP_PAYMENT_GATEWAY`, `SHOPPERSTOP_PAYMENT_PUBLIC_URL` and `SHOPPERSTOP_CORE_SERVICE_TOKENS` as `leak` and `make -n e2e` runs with every service and app present
- **THEN** no printed line contains `leak`; `payment-admin migrate` and `seed-demo --reset` follow `rider-admin migrate` and precede the build; and `npm run e2e` carries `shopperstop_payment_e2e`, `SHOPPERSTOP_PAYMENT_ADDR=':18082'`, `SHOPPERSTOP_PAYMENT_CORE_URL='http://localhost:18080'`, `SHOPPERSTOP_PAYMENT_GATEWAY='fake'` and `SHOPPERSTOP_PAYMENT_PUBLIC_URL='http://localhost:18082'`

### Requirement: make prod-local runs the payment service behind Caddy

`make prod-local` SHALL, after the core and rider migrations, migrate the payment database when `services/payment` exists, then run core, rider and payment side by side with the dev environment, so `http://localhost/api/payment/` reaches the payment service.

#### Scenario: Dry run shows three servers
- **WHEN** `make -n prod-local` runs with `services/core`, `services/rider`, `services/payment`, `apps/web` and `apps/admin` present
- **THEN** it prints, in order, `npm run build --workspaces --if-present`, the compose `--profile prod up -d --wait` command, `go run ./cmd/core-admin migrate`, `go run ./cmd/rider-admin migrate`, `go run ./cmd/payment-admin migrate`, then `go run ./cmd/core`, `go run ./cmd/rider` and `go run ./cmd/payment`

### Requirement: CI runs a payment job

The `payment` job of `.github/workflows/ci.yml` SHALL print `payment: services/payment absent, skipping` and succeed without a toolchain while `services/payment/go.mod` is absent, and otherwise run `make test-payment` against a `postgres:16` service loaded from `deploy/initdb.sql`.

#### Scenario: Workflow shape with the payment job
- **WHEN** `.github/workflows/ci.yml` is parsed as YAML
- **THEN** the `payment` job follows `rider`, its first step is checkout, its second step's `if:` is `hashFiles('services/payment/go.mod') == ''` with the skip line, and every later step carries an `if:` on `hashFiles('services/payment/go.mod')`

#### Scenario: Payment tests reach the CI database
- **WHEN** the `payment` job runs `make test-payment` on a tree with `services/payment/go.mod`
- **THEN** the job's env sets `SHOPPERSTOP_PAYMENT_TEST_DATABASE_URL` to `shopperstop_payment` on `shopperstop_payment_test` at `localhost:5432`, Go comes from `services/payment/go.mod`, and `deploy/initdb.sql` was applied before it

### Requirement: Postman environment carries the payment variables

After the rider variables and before `serviceToken`, `docs/postman/local.postman_environment.json` SHALL hold `paymentBaseUrl` = `http://localhost:8082/api/payment/v1` and `paymentId` = `00000000-0000-4000-8000-000000000a01`, the fixed id the payment seed loads for the paid payment of core's demo online order (`.claude/areas/payment.md`).

#### Scenario: Payment id is fixed
- **WHEN** the environment file is read
- **THEN** `paymentBaseUrl` is `http://localhost:8082/api/payment/v1`, `paymentId` is `00000000-0000-4000-8000-000000000a01`, both of type `default`, and `serviceToken` is still the last variable

### Requirement: Area lists name the payment area

`.claude/commands/orchestrate.md`, `.claude/commands/manage.md` and `openspec/config.yaml` SHALL name the area `payment` with scope `services/payment/`, and `openspec/config.yaml` SHALL list the Phase 5 capabilities `payment-service` and `payment-gateway-razorpay`.

#### Scenario: Area lists
- **WHEN** the three files are read
- **THEN** `orchestrate.md` contains `` `payment` (`services/payment/` ``, `manage.md` contains `` `payment` = `services/payment/` ``, and `config.yaml` contains `payment (services/payment/)`, `payment-service` and `payment-gateway-razorpay`
