## MODIFIED Requirements

### Requirement: make dev runs the rider service and app

`make dev` SHALL run `make db`, then `make seed` (core, then rider: `migrate` and `seed-demo --reset`), then `core`, `rider`, `web`, `admin` and `rider-app` side by side until interrupted. Rider commands SHALL receive the `SHOPPERSTOP_RIDER_*` dev defaults, each overridable from the shell or the make command line, core SHALL accept the rider's dev service token, the rider app's origin and the mobile app's web export origin (`http://localhost:5176`, D39), and the rider's dev origins SHALL include the same mobile origin. The mobile app has no make target: it runs from `apps/mobile` with Expo (D39).

#### Scenario: Dry run shows five servers
- **WHEN** `make -n dev` runs with `services/core`, `services/rider`, `apps/web`, `apps/admin`, `apps/rider` and `packages/ui` present
- **THEN** it prints, in order, the compose `up -d --wait postgres` command, core `migrate` and `seed-demo --reset`, rider `rider-admin migrate` and `rider-admin seed-demo --reset`, `-j5 core rider web admin rider-app`, then `go run ./cmd/core`, `go run ./cmd/rider` and `npm run dev` for `apps/web`, `apps/admin` and `apps/rider`

#### Scenario: Core accepts the rider's dev token
- **WHEN** `make -n core` and `make -n rider` run with no rider variable in the environment
- **THEN** the core command carries `SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:` followed by exactly the value the rider command carries as `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN`, and both carry `http://localhost:5175` in their web origins

#### Scenario: Core accepts the mobile web export's dev origin
- **WHEN** `make -n core` runs with `SHOPPERSTOP_CORE_WEB_ORIGINS` unset in the environment
- **THEN** the core command carries `SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176'`, the `Makefile` names `localhost:5176` exactly twice (core's and the rider's dev defaults), and no `Makefile` line names `apps/mobile` or `expo`

#### Scenario: Rider dev defaults
- **WHEN** `make -n rider` runs with `services/rider` present and no rider variable in the environment
- **THEN** the command carries `SHOPPERSTOP_RIDER_DATABASE_URL` for `shopperstop_rider` as `shopperstop_rider`, `SHOPPERSTOP_RIDER_ADDR=':8081'`, a `SHOPPERSTOP_RIDER_SESSION_PEPPER` of at least 32 bytes, `SHOPPERSTOP_RIDER_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176'`, `SHOPPERSTOP_RIDER_CORE_URL='http://localhost:8080'` and a non-empty `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN`

#### Scenario: A rider variable is overridden
- **WHEN** `make -n rider SHOPPERSTOP_RIDER_ADDR=:9091` runs with `services/rider` present
- **THEN** the printed rider command carries `SHOPPERSTOP_RIDER_ADDR=':9091'`

### Requirement: make e2e gives the rider an isolated environment

`make e2e` SHALL, when `services/rider` exists, migrate and reseed `shopperstop_rider_e2e` after core's e2e database and before building the workspaces, and SHALL run every core, rider and `npm run e2e` command with one fixed environment holding both services' e2e values. Values from the developer's shell or the dev defaults SHALL NOT reach it. Both services' e2e web origins SHALL include the mobile app's web export preview, `http://localhost:15176` (D39).

#### Scenario: Dev rider variables do not leak into e2e
- **WHEN** the shell exports `SHOPPERSTOP_RIDER_DATABASE_URL=leak` and `SHOPPERSTOP_CORE_DATABASE_URL=leak` and `make -n e2e` runs with `services/core`, `services/rider` and `apps/web` present
- **THEN** no printed line contains `leak`, and the printed `rider-admin migrate`, `rider-admin seed-demo --reset` and `npm run e2e` commands carry `shopperstop_rider_e2e`, `SHOPPERSTOP_RIDER_ADDR=':18081'` and `SHOPPERSTOP_RIDER_CORE_URL='http://localhost:18080'`

#### Scenario: e2e core accepts the e2e rider token
- **WHEN** `make -n e2e` runs with `services/core`, `services/rider` and `apps/web` present
- **THEN** the `npm run e2e` command carries `SHOPPERSTOP_CORE_SERVICE_TOKENS='rider:` followed by exactly its `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN` value, that value differs from the dev default, both services' web origins are `http://localhost:15173,http://localhost:15174,http://localhost:15175,http://localhost:15176`

#### Scenario: e2e services accept the mobile web export preview
- **WHEN** the shell exports `SHOPPERSTOP_CORE_WEB_ORIGINS=leak` and `SHOPPERSTOP_RIDER_WEB_ORIGINS=leak` and `make -n e2e` runs
- **THEN** the printed `npm run e2e` command carries `SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175,http://localhost:15176'` and `SHOPPERSTOP_RIDER_WEB_ORIGINS` with the same value, no printed line contains `leak`, and the `Makefile` names `localhost:15176` exactly twice

### Requirement: Repository documentation matches the tree

The repository SHALL have a `README.md` whose quick start runs the stack with `make dev`, whose sign-in table lists the Spec 2 §11 demo accounts and the Phase 3 demo riders, and whose "Mobile app" section says how to run the customer mobile app with Expo; a `CLAUDE.md` that names every developer `make` target, the `apps/mobile/` workspace and how it is run, and states the CI, end-to-end and Figma rules as PLAN.md D11, D14, D15, D17, D29, D36 and D39 decided; and a `docs/figma.md` that names the design canvas holding the mobile screens. Every `make` target either file names SHALL exist in the `Makefile`, and every relative link in either file SHALL resolve to a path in the tree.

#### Scenario: README has the quick start
- **WHEN** `README.md` is read
- **THEN** it has a `## Quick start` section with a code block containing `make dev`, names the prerequisites Docker (running), Go 1.27 and Node 22.12 or newer, names core on `:8080`, web on `:5173`, admin on `:5174/admin/`, the rider service on `:8081` and the rider app on `:5175/rider/`, and says which of those are not on `main` yet

#### Scenario: README has the step-by-step fold and the screenshots table
- **WHEN** `README.md` is read
- **THEN** it has a `<details>` block with numbered steps that start Postgres, apply migrations and the seed, and run core without `make dev`, and a `## Screenshots` section with a Markdown table

#### Scenario: README lists the demo sign-ins
- **WHEN** `README.md` is read
- **THEN** it contains `admin@shopperstop.local` with `admin12345`, `koramangala@shopperstop.local` and `indiranagar@shopperstop.local` with `staff12345`, and `demo@shopperstop.local` with `demo12345`, says the accounts are loaded by `seed-demo --reset` from Phase 2, and contains `rider1-koramangala@shopperstop.local` with `rider12345` as loaded by `rider-admin seed-demo --reset` from Phase 3

#### Scenario: README tells an existing clone how to add the rider databases
- **WHEN** `README.md` is read
- **THEN** it says that `deploy/initdb.sql` runs only when the Postgres volume is created and gives one command that applies the file's `shopperstop_rider` lines to the running `shopperstop-postgres-1` as `postgres` without `psql` on the host

#### Scenario: README says how to run the mobile app
- **WHEN** `README.md` is read on a tree without `apps/mobile`
- **THEN** its `## Status` section names Phase 4, and it has a `## Mobile app` section containing `cd apps/mobile && npx expo start --port 5176`, `Expo Go`, `EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080`, `localhost:5176` and the words `` `apps/mobile` is not on `main` yet ``, with no Markdown link to `apps/mobile`

#### Scenario: CLAUDE.md names every developer make target
- **WHEN** `CLAUDE.md` is read
- **THEN** it contains `make db`, `make dev`, `make test`, `make test-core`, `make test-rider`, `make test-web`, `make e2e`, `make gen`, `make postman` and `make prod-local`, and `make -n <target>` exits 0 for each of them and for every other `make <target>` named in `README.md` or `CLAUDE.md`

#### Scenario: CLAUDE.md states the current CI, e2e and Figma rules
- **WHEN** `CLAUDE.md` is read
- **THEN** it does not contain `sqlc diff` or "No product code yet", and it contains `make gen postman`, `shopperstop_core_e2e`, `shopperstop_rider_e2e`, `18080`, `18081`, `15173`, `15174`, `15175`, `22.12`, the CI job name `rider`, and the three Figma page names `Tokens & Components`, `Customer web` and `Admin web`

#### Scenario: CLAUDE.md names the mobile workspace
- **WHEN** `CLAUDE.md` is read
- **THEN** its layout block has a line starting `apps/mobile/`, it names Phase 4, `15176`, `5176` and `npx expo start`, and it says the mobile workspace rides on `make test-web` and `make e2e`

#### Scenario: docs/figma.md links the mobile design canvas
- **WHEN** `docs/figma.md` is read
- **THEN** it contains `ShopperStop App Design`, `https://claude.ai/artifact/75BFgGxUe3viRFjgvn8Ywy`, `19 artboards`, `390×844` and `tokens.css`, says the Figma file has no `Mobile` page, and does not contain `add it when the mobile app spec lands`

#### Scenario: Relative links resolve
- **WHEN** every Markdown link target in `README.md` and `CLAUDE.md` that does not start with `http` or `#` is resolved from the repository root, with any `#fragment` removed
- **THEN** each one exists in the tree
