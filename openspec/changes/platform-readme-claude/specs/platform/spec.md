## ADDED Requirements

### Requirement: Repository documentation matches the tree

The repository SHALL have a `README.md` whose quick start runs the stack with `make dev` and whose sign-in table lists the Spec 2 §11 demo accounts, and a `CLAUDE.md` that names every developer `make` target and states the CI, end-to-end and Figma rules as PLAN.md D11, D14, D15 and D17 decided. Every `make` target either file names SHALL exist in the `Makefile`, and every relative link in either file SHALL resolve to a path in the tree.

#### Scenario: README has the quick start
- **WHEN** `README.md` is read
- **THEN** it has a `## Quick start` section with a code block containing `make dev`, names the prerequisites Docker (running), Go 1.27 and Node 22.12 or newer, names core on `:8080`, web on `:5173` and admin on `:5174/admin/`, and says which of those are not on `main` yet

#### Scenario: README has the step-by-step fold and the screenshots table
- **WHEN** `README.md` is read
- **THEN** it has a `<details>` block with numbered steps that start Postgres, apply migrations and the seed, and run core without `make dev`, and a `## Screenshots` section with a Markdown table

#### Scenario: README lists the demo sign-ins
- **WHEN** `README.md` is read
- **THEN** it contains `admin@shopperstop.local` with `admin12345`, `koramangala@shopperstop.local` and `indiranagar@shopperstop.local` with `staff12345`, and `demo@shopperstop.local` with `demo12345`, and says the accounts are loaded by `seed-demo --reset` from Phase 2

#### Scenario: CLAUDE.md names every developer make target
- **WHEN** `CLAUDE.md` is read
- **THEN** it contains `make db`, `make dev`, `make test`, `make test-core`, `make test-web`, `make e2e`, `make gen`, `make postman` and `make prod-local`, and `make -n <target>` exits 0 for each of them and for every other `make <target>` named in `README.md` or `CLAUDE.md`

#### Scenario: CLAUDE.md states the current CI, e2e and Figma rules
- **WHEN** `CLAUDE.md` is read
- **THEN** it does not contain `sqlc diff` or "No product code yet", and it contains `make gen postman`, `shopperstop_core_e2e`, `18080`, `15173`, `15174`, `22.12` and the three Figma page names `Tokens & Components`, `Customer web` and `Admin web`

#### Scenario: Relative links resolve
- **WHEN** every Markdown link target in `README.md` and `CLAUDE.md` that does not start with `http` or `#` is resolved from the repository root, with any `#fragment` removed
- **THEN** each one exists in the tree
