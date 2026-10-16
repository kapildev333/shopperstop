# ShopperStop

ShopperStop is a quick-commerce product in the shape of Blinkit. A customer orders groceries from the nearest dark store; the store packs the order and a delivery follows in minutes. The backend is Go microservices with one PostgreSQL database each, the customer site and the admin and store-staff panel are React apps, and the repository is built as a portfolio product: real flows, tests, documented design and multi-agent orchestration.

## Status

Phase 1 (foundation) is tagged `v0.1.0` and Phase 2 (core service and apps) `v0.2.0`. On `main`:

- `services/core`: accounts and bearer sessions for customers and staff, stores and pincode serviceability, categories and products with images, per-store stock, carts, orders with a status machine and events, the staff dashboard; `cmd/core-admin` with `migrate`, `seed-demo --reset` and `create-admin`; `openapi.json` with an example on every route.
- `apps/web` (customer site at `/`): pincode and store, home, categories, search and product pages, guest and server cart, sign-in and register, addresses, checkout with cash on delivery, order tracking and history.
- `apps/admin` (admin and store-staff panel under `/admin/`): sign-in and role-based navigation, dashboard, orders board with history and order sheet, stock, stores and service areas, categories and products with image upload, staff.
- `packages/ui`: design tokens, the shared components and the generated API types.
- `deploy/`: Docker Compose with Postgres 16 and a production-profile Caddy, `initdb.sql`, `Caddyfile`; the `Makefile`, the CI workflow, the Postman collection and environment under `docs/postman/`, and the living specs under [openspec/specs/](openspec/specs/).

Phase 3 (the rider service and rider app) is being planned in `PLAN.md`. `core-admin seed-demo --reset` loads the demo data and prints the demo sign-ins.

## Quick start

Prerequisites:

- Docker Desktop, running (`make db` starts Postgres in it). Port 5432 must be free; a local Postgres on that port makes compose fail with "port is already allocated".
- Go 1.27
- Node 22.12 or newer
- GNU make 3.81 or newer

```sh
npm ci      # once, after cloning
make dev
```

`make dev` starts Postgres 16 as `shopperstop-postgres-1` with the roles and databases from `deploy/initdb.sql`, applies the migrations, runs `seed-demo --reset`, and then runs core on <http://localhost:8080>, the customer web on <http://localhost:5173> and the admin panel on <http://localhost:5174/admin/>, until Ctrl-C. Check core with `curl http://localhost:8080/api/core/v1/healthz`. Each target prints a skip line while its directory is absent. Postgres keeps running after Ctrl-C; stop it with `docker compose -f deploy/docker-compose.yml stop`.

<details>
<summary><b>Step by step, without make dev</b></summary>

1. Start Postgres: `make db`, or `docker compose -f deploy/docker-compose.yml up -d --wait postgres`.
2. From the repository root, set the core environment. These are the defaults from the Makefile header:

   ```sh
   export SHOPPERSTOP_CORE_DATABASE_URL='postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core?sslmode=disable'
   export SHOPPERSTOP_CORE_ADDR=':8080'
   export SHOPPERSTOP_CORE_SESSION_PEPPER='dev-pepper-dev-pepper-dev-pepper-00'
   export SHOPPERSTOP_CORE_FILES_DIR="$PWD/services/core/data/files"
   export SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:5173,http://localhost:5174'
   ```

3. Migrate and seed: `cd services/core && go run ./cmd/core-admin migrate && go run ./cmd/core-admin seed-demo --reset`. The seed prints the four demo sign-ins and the twelve fixed ids it loads.
4. Run core: `go run ./cmd/core`, then check `curl http://localhost:8080/api/core/v1/healthz` from another terminal.
5. From the repository root, build the shared UI and start the apps in two more terminals: `npm run build --workspace packages/ui`, then `npm run dev --workspace apps/web` and `npm run dev --workspace apps/admin`.
6. Sign in with an account from [Demo sign-ins](#demo-sign-ins).
7. To look at the data, use the client inside the container, `docker exec -it shopperstop-postgres-1 psql -U shopperstop_core shopperstop_core`, or any GUI client on `localhost:5432` with user and password `shopperstop_core`.

</details>

## Demo sign-ins

Local databases only. `core-admin seed-demo --reset` loads these accounts and prints them with the twelve fixed ids of the demo data (stores, addresses, products, orders); the list is defined in `services/core/internal/seed/summary.go`.

| App | Role | Email | Password |
|---|---|---|---|
| Admin panel (`localhost:5174/admin/`) | Admin | `admin@shopperstop.local` | `admin12345` |
| Admin panel (`localhost:5174/admin/`) | Store staff, Koramangala | `koramangala@shopperstop.local` | `staff12345` |
| Admin panel (`localhost:5174/admin/`) | Store staff, Indiranagar | `indiranagar@shopperstop.local` | `staff12345` |
| Customer web (`localhost:5173/`) | Customer | `demo@shopperstop.local` | `demo12345` |

The two stores are Koramangala (pincodes 560034 and 560095) and Indiranagar (pincodes 560038 and 560008).

## Commands

| Command | What it does |
|---|---|
| `make db` | Starts the Postgres container and waits until it is healthy. |
| `make dev` | `db`, then the seed, then core, web and admin together. |
| `make test` | `test-core`, then `test-web`. |
| `make test-core` | gofmt, `go vet`, and `go test -race` on `shopperstop_core_test`. |
| `make test-web` | Builds `packages/ui`, then lint, typecheck, test and build for every workspace. |
| `make e2e` | Playwright against built apps, on `shopperstop_core_e2e`, core on :18080, web and admin previews on :15173 and :15174 (admin under /admin/). |
| `make gen` | Generates the sqlc code (once `services/core/sqlc.yaml` exists) and `packages/ui/src/api/core.d.ts` from `openapi.json`. |
| `make postman` | Regenerates the Postman collection and environment under `docs/postman/`. |
| `make prod-local` | Builds the apps and serves them through Caddy on <http://localhost>. |

Each target prints `<target>: <path> absent, skipping` while its part of the tree is not there yet.

## API

The contract and the documentation are [services/core/openapi.json](services/core/openapi.json): every served route, with its summary, schemas, error codes and examples. The Postman collection and environment generated from it live under `docs/postman/`; `make postman` regenerates them and also runs the generator tests in `scripts/postman.test.mjs`.

## Design

The look is a yellow brand surface with green for actions and prices, dense product grids and a sticky cart bar. The tokens are in [packages/ui/src/tokens.css](packages/ui/src/tokens.css). The Figma file, with its three pages, is linked from [docs/figma.md](docs/figma.md).

## Screenshots

Filled by the first phase that has screens.

| Screen | Customer web | Admin panel |
|---|---|---|
| Home | pending | not applicable |
| Cart | pending | not applicable |
| Order tracking | pending | not applicable |
| Orders board | not applicable | pending |
| Stock | not applicable | pending |

## How it is built

The repository is split into areas with disjoint scopes (`platform`, `core`, `ui`, `web`, `admin`). Each area has a manager session that runs team-lead, worker and reviewer lanes for one OpenSpec change at a time: the change is specified, the test is written first, and the work lands through a pull request. [CLAUDE.md](CLAUDE.md) holds the conventions and the rules the agents follow, [openspec/](openspec/) the specs and changes, and [PLAN.md](PLAN.md) the plan and its decisions.
