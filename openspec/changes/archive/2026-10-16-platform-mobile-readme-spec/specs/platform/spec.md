## MODIFIED Requirements

### Requirement: Repository documentation matches the tree

The repository SHALL have a `README.md` whose quick start runs the stack with `make dev`, whose sign-in table lists the Spec 2 §11 demo accounts and the Phase 3 demo riders, and whose "Mobile app" section says how to run the customer mobile app with Expo. Every `make` target the README or `CLAUDE.md` names SHALL exist in the `Makefile`, and every relative link in either file SHALL resolve to a path in the tree.

#### Scenario: README has the quick start
- **WHEN** `README.md` is read
- **THEN** it has a `## Quick start` section with a code block containing `make dev`, names the prerequisites Docker (running), Go 1.27 and Node 22.12 or newer, names core on `:8080`, web on `:5173`, admin on `:5174/admin/`, the rider service on `:8081` and the rider app on `:5175/rider/`, and does not contain `` not on `main` yet ``

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
- **WHEN** `README.md` is read on a tree with `apps/mobile`
- **THEN** its `## Status` section names `v0.3.0` and says Phase 4 is in progress on `main`, and it has a `## Mobile app` section containing `cd apps/mobile && npx expo start --port 5176`, `Expo Go`, `EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080`, `localhost:5176` and the link `[apps/mobile/README.md](apps/mobile/README.md)`

#### Scenario: Relative links resolve
- **WHEN** every Markdown link target in `README.md` and `CLAUDE.md` that does not start with `http` or `#` is resolved from the repository root, with any `#fragment` removed
- **THEN** each one exists in the tree

### Requirement: CLAUDE.md and docs/figma.md describe the tree

`CLAUDE.md` SHALL name every developer `make` target, the `apps/mobile/` workspace and how it is run, and state the CI, end-to-end and Figma rules as PLAN.md D11, D14, D15, D17, D29, D36 and D39 decided; `docs/figma.md` SHALL name the design canvas holding the mobile screens.

#### Scenario: CLAUDE.md names every developer make target
- **WHEN** `CLAUDE.md` is read
- **THEN** it contains `make db`, `make dev`, `make test`, `make test-core`, `make test-rider`, `make test-web`, `make e2e`, `make gen`, `make postman` and `make prod-local`, and `make -n <target>` exits 0 for each of them and for every other `make <target>` named in `README.md` or `CLAUDE.md`

#### Scenario: CLAUDE.md states the current CI, e2e and Figma rules
- **WHEN** `CLAUDE.md` is read
- **THEN** it does not contain `sqlc diff` or "No product code yet", and it contains `make gen postman`, `shopperstop_core_e2e`, `shopperstop_rider_e2e`, `18080`, `18081`, `15173`, `15174`, `15175`, `22.12`, the CI job name `rider`, and the three Figma page names `Tokens & Components`, `Customer web` and `Admin web`

#### Scenario: CLAUDE.md names the mobile workspace
- **WHEN** `CLAUDE.md` is read
- **THEN** its layout block has a line starting `apps/mobile/`, it names Phase 4, `15176`, `5176` and `npx expo start`, and it says the mobile workspace rides on `make test-web` and `make e2e`, and it does not contain `` once `apps/mobile` lands ``

#### Scenario: docs/figma.md links the mobile design canvas
- **WHEN** `docs/figma.md` is read
- **THEN** it contains `ShopperStop App Design`, `https://claude.ai/artifact/75BFgGxUe3viRFjgvn8Ywy`, `19 artboards`, `390×844` and `tokens.css`, says the Figma file has no `Mobile` page, and does not contain `add it when the mobile app spec lands`
