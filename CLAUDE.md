# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

ShopperStop: a quick-commerce product in the shape of Blinkit. A customer orders groceries from the nearest dark store; the store packs and delivers in minutes. Portfolio product built to the UniCourse standard (`../UniCourse`): real flows, tests, documented design, multi-agent orchestration. Microservices in one repository: `services/core` first, then rider, payment and receipt services, each its own Go module and Postgres database, talking over HTTP.

Phases 1 to 3 are on `main` (`v0.1.0`, `v0.2.0`, `v0.3.0`; Phase 3 is the rider service and app, D29); Phase 4, the customer mobile app (D36), is in progress on `main`. The two founding briefs are `docs/specs/2026-10-12-foundation-and-design-system.md` (Spec 1) and `docs/specs/2026-10-12-core-service-and-apps.md` (Spec 2); they are frozen. Phase 1 seeded `openspec/specs/platform` and `design-system` from them; later capabilities are seeded by their Phase 2 changes (D4). `PLAN.md` tracks state.

## Commands

Prerequisites: Docker Desktop running (`make db` uses it), Go 1.27, Node >= 22.12.0 (root `package.json` engines, D11), GNU make 3.81 or newer. sqlc only once `services/core/sqlc.yaml` exists (Phase 2, D3). `psql` is not on the owner's machine.

| Target | What it does |
|---|---|
| `make db` | starts the local Postgres 16 container (`shopperstop-postgres-1`) and waits until it is healthy |
| `make dev` | `db`, then `seed` (migrate and `seed-demo --reset`), then core, rider, web, admin and the rider app together; Ctrl-C stops them |
| `make test` | `test-core`, `test-rider`, then `test-web` |
| `make test-core` | gofmt, `go vet`, `go test -race` on `shopperstop_core_test` |
| `make test-rider` | gofmt, `go vet`, `go test -race` on `shopperstop_rider_test` |
| `make test-web` | builds `packages/ui`, then lint, typecheck, test and build for every workspace |
| `make rider` | the rider service alone, on :8081 |
| `make rider-app` | the rider app's dev server alone, on :5175 under /rider/ |
| `make e2e` | Playwright on `shopperstop_core_e2e` and `shopperstop_rider_e2e`: core :18080, rider :18081, web and admin previews 15173 and 15174 (admin under /admin/), rider preview 15175 (under /rider/), mobile web export preview 15176, fixed env |
| `make gen` | sqlc generate per service (only while its `sqlc.yaml` exists), then `openapi-typescript` into `packages/ui/src/api/core.d.ts` and `packages/ui/src/api/rider.d.ts` |
| `make postman` | regenerates one collection per service under `docs/postman/` (`shopperstop-core.postman_collection.json`, `shopperstop-rider.postman_collection.json` once `services/rider/openapi.json` exists), then runs `node --test scripts/postman.test.mjs` |
| `make prod-local` | builds the apps and serves them through Caddy on http://localhost, starting containers |

Every target prints one skip line (`<target>: <path> absent, skipping`) while its part is absent. `seed`, `core`, `rider`, `ui`, `web`, `admin` and `rider-app` are the pieces `dev` composes. The mobile app (`apps/mobile`, Phase 4, D39) has no make target: its workspace rides on `make test-web` and `make e2e` through its `lint`, `typecheck`, `test`, `build` and `e2e` scripts, and runs with `cd apps/mobile && npx expo start --port 5176` (Expo Go on a phone with `EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080`; the web export on :5176, which core's dev origins accept).

Single tests: `cd services/core && SHOPPERSTOP_CORE_TEST_DATABASE_URL=... go test -race -run TestName ./internal/<pkg>` (URL from the Makefile), `cd services/rider && SHOPPERSTOP_RIDER_TEST_DATABASE_URL=... go test -race -run TestName ./internal/<pkg>` for the rider, and `npm run test --workspace packages/ui -- <file>`.

Agents: `make db`, `make dev` and `make prod-local` start containers and belong to the owner or the orchestrator. Lanes run `make test-core`, `make test-rider`, `make test-web`, `make e2e` (one at a time), `make gen`, `make postman`, and `make -n` on anything. Ad-hoc database checks use a Go pgx client.

## Layout and naming

```
services/core/      Go module github.com/kapildev333/shopperstop/services/core: cmd/core, cmd/core-admin, migrations/, queries/ (sqlc), internal/, openapi.json
services/rider/     Phase 3: the rider service, same shape, module .../services/rider, routes /api/rider/v1, port 8081
services/<name>/    every later service, same shape, own module and database
apps/web/           customer site, React + Vite + TypeScript
apps/admin/         admin and store-staff panel, same stack
apps/rider/         Phase 3: the rider app, phone-first, same stack, served under /rider/
apps/mobile/        Phase 4: the customer mobile app, Expo + React Native + TypeScript, web export on 5176 (D36, D37)
packages/ui/        shared tokens, components and generated API types, consumed as @shopperstop/ui
deploy/             docker-compose.yml (postgres, caddy), Caddyfile, initdb.sql (creates the `_test` and `_e2e` databases per service)
docs/specs/         frozen: the two 2026-10-12 briefs that seed openspec/specs/; no new files
docs/plans/         frozen: the Phase 1 plan; later work is planned as OpenSpec changes, not here
docs/design/        team-lead design documents, <LANE-ID>.md
docs/figma.md       link to the Figma file and its page map
docs/postman/       Postman collections (one per service) and the shared environment
openspec/           OpenSpec root: specs/ (living spec per capability), changes/ (one per feature), changes/archive/
.claude/            agents (team-lead, worker, reviewer), commands (orchestrate, manage), areas/, lanes/
Makefile            developer targets (see Commands)
package.json        npm workspaces `packages/*` and `apps/*`
.github/workflows/ci.yml  CI jobs (see Git and GitHub)
scripts/            `postman.mjs`, generates `docs/postman/`
PLAN.md             orchestration plan, orchestrator-only
```

Stack (Spec 1 §4): Node >= 22.12 (D11). Go 1.27 with `go-chi/chi/v5`, `jackc/pgx/v5`, `golang.org/x/crypto` and sqlc output only (sqlc arrives with the first queries in Phase 2, D3); `log/slog`; no ORM, DI or logging library. PostgreSQL 16, one database and one owner role per service, a `_test` database per service. Web: React 19, Vite 8, TypeScript strict, TanStack Router (file-based) + Query, Tailwind 4, `lucide-react`, `openapi-fetch` + `openapi-typescript`, Vitest + Testing Library, ESLint (`jsx-a11y`, `react-hooks`), Playwright + axe; fonts bundled (`@fontsource-variable/inter`), never a CDN. Any other dependency is a decision in PLAN.md; dev tooling implied by the stack (typescript-eslint, `@types/*`, jsdom, Testing Library DOM and jest-dom, `@axe-core/playwright`, Vite and Vitest peers) is allowed (D10). Mobile (`apps/mobile`): Expo, React Native, Expo Router, TanStack Query, `openapi-fetch`, `StyleSheet` with values from `@shopperstop/ui/tokens`, `jest-expo` + React Native Testing Library, Playwright + axe on the web export; the full list is D37.

One convention per layer, no exceptions:

| Layer | Convention | Example |
|---|---|---|
| Directories, non-Go files | lowercase kebab-case | `apps/web/src/features/order-tracking/` |
| Go packages | one lowercase word, named for what they hold | `internal/order`, `internal/httpx` |
| Go identifiers | Go standard (MixedCaps); exported only when another package needs it | `order.Place`, `pg.WithTx` |
| TS files | kebab-case; React components PascalCase export in kebab-case file | `product-card.tsx` exports `ProductCard` |
| Database | snake_case, plural tables, `<table>_id` foreign keys, `created_at`/`updated_at` on every table, money columns `_cents` | `store_stock.product_id`, `price_cents` |
| HTTP routes | `/api/<service>/v1/<plural-kebab-noun>`, ids as path params, no verbs except `/auth/*` and `/orders/{id}/cancel` | `GET /api/core/v1/stores/{id}/products` |
| JSON fields | camelCase, matching the Go struct tag and the TS type exactly; never `null`: optional = omitted, arrays always present | `storeId`, `priceCents` |
| Env vars | `SHOPPERSTOP_<SERVICE>_` prefix, UPPER_SNAKE | `SHOPPERSTOP_CORE_DATABASE_URL` |
| Domain terms | one word per concept everywhere: store (dark store), service area (pincode a store delivers to), category, product, stock, customer, address, cart, order, staff (admin or store staff), rider (later) | never "shop", "warehouse", "item" for product, "user" for customer |

Currency is INR, shown as `₹`, stored in cents (paise) as integers.

## Orchestration workflow

Plan-driven multi-agent workflow under `.claude/`, organised by area, spec-driven with OpenSpec, test-driven code:

- Areas are sub-projects with disjoint scopes: `platform` (root files, `deploy/`, `.github/`, `openspec/`, `docs/`, `Makefile`, `README.md`, `CLAUDE.md`), `core` (`services/core/`), `ui` (`packages/ui/`), `web` (`apps/web/`), `admin` (`apps/admin/`), `rider` (`services/rider/` and `apps/rider/`, Phase 3, D29), `mobile` (`apps/mobile/`, Phase 4, D36); later services become areas. Each area has a plan in `.claude/areas/<area>.md` (format in `.claude/areas/README.md`).
- `/orchestrate <source documents>` (`.claude/commands/orchestrate.md`): the program orchestrator, a Fable 5.1 session. Owns `PLAN.md` and the root checkout, writes each area's work package, relays cross-area requests, verifies integration and tags releases at phase close. Launches no lanes for an area that has a manager. The owner runs it together with the platform manager in one session (D9).
- `/manage <area>` (`.claude/commands/manage.md`): the area manager, one Fable 5.1 session per area in its own terminal (`claude --model claude-fable-5-1`). Runs the area's lanes as sub-agents, verifies every landing itself, lands PRs, keeps the area plan current. Sub-agents cannot launch sub-agents, which is why managers are sessions.
- Lanes inside an area, per feature, in order:
  - `team-lead` (Opus 5.5) owns the feature: the OpenSpec change (`proposal.md`, spec deltas, `design.md`, `tasks.md`), `docs/design/<LANE-ID>.md` when `design.md` is not enough, one brief per worker task (scope, scenario, the failing test to start from), and the acceptance against the spec deltas. Writes no product code.
  - `worker` (Haiku 5.5) builds one task from its brief, test first, inside its scope; stops and reports on any open design choice.
  - `reviewer` (Sonnet 5.5) reviews each landing read-only and in detail: brief and spec-delta coverage, correctness, test-first commit order, scope creep, needless complexity; re-runs the gates itself.
- `LANE-ID = <area>-P<phase>-L<n>`. Lane logs live in `.claude/lanes/<LANE-ID>.md` (format in `.claude/lanes/README.md`): each lane writes only its own file, reads the others at start and finish, addresses requests to other lanes there.
- Contracts between areas are files, never conversations: `services/core/openapi.json` (core to apps), `packages/ui/src/tokens.css` and the `@shopperstop/ui` exports (ui to apps), `openspec/specs/` (behaviour). A core lane that changes `openapi.json` also commits the regenerated `packages/ui/src/api/core.d.ts` (`make gen`) in the same PR as a mechanical change, the one cross-area file a core lane may touch (D19). A lane or manager that needs a change in another area writes it under `## Requests` in the area plan; the orchestrator relays it.
- Lanes work only inside the paths their brief lists. One directory has one owner at a time; one `make e2e` runs at a time across all managers (announced in the area plan's `## Doing`).
- Each manager verifies its landings itself (re-run suites, then exercise the real database, HTTP and browser) and records the evidence in the lane's status cell. A lane's report is never verification. Nobody writes features while a lane could.
- Only the orchestrator edits `PLAN.md` or touches the root checkout; managers base worktrees on `origin/main` and land everything through `gh`.
- Agents never run `docker compose` or start, stop or remove containers; the local Postgres is `shopperstop-postgres-1`, started by the owner or the orchestrator with `make db`.

### OpenSpec (Spec 1 §5.1)

OpenSpec is the only spec tool. New behaviour is never written as a Markdown spec in `docs/` or anywhere else; a brainstorm ends in `/opsx:propose` (or `/opsx:new`) and produces `proposal.md`, spec deltas, `design.md` and `tasks.md`. `openspec/specs/` is the living, normative spec, one folder per capability, requirements in `SHALL` wording with at least one `#### Scenario:` of **WHEN** / **THEN** bullets each. Every feature is one change under `openspec/changes/<area>-<slug>/`, seen by the orchestrator before any worker starts (the owner delegated decisions, D13; the owner can override any); project rules for the artifacts are in `openspec/config.yaml`. The CLI is `openspec`; on this machine it is a shim in `~/.local/bin/openspec` that runs `npx -y @fission-ai/openspec@latest`, because a global npm install needs root. CI installs it with `npm i -g`. Workers tick `tasks.md` as they land; the team lead's acceptance is `/opsx:verify`; the area manager archives by PR after the feature merges. `openspec validate --all --strict` runs in CI.

### TDD (Spec 1 §5.2)

Red, green, refactor per task: the failing test from the spec scenario is committed first (`test: <scenario>`), then the smallest code that passes (`feat:`/`fix:`), then cleanup with the suite green. A behaviour commit without a preceding failing test is a reviewer finding. Go tests run against the real database; web tests use Testing Library; e2e scenarios are written before the pages they cover. No mocks of the database or HTTP layer; fakes only at the process boundary (clock, files, later SMS).

## Git and GitHub

- Repository `kapildev333/shopperstop`, private until the owner says to open it. `main` is the only long-lived branch.
- Commit identity `kapildev333 <47056817+kapildev333@users.noreply.github.com>` (repo git config). No AI attribution or co-author lines in commits or PRs. No personal email, name, address or payment detail anywhere in the repository, seed data included.
- One branch per lane, `lane/<LANE-ID>-<slug>`, in its own worktree under `.worktrees/<LANE-ID>` (gitignored). Non-lane changes use `chore/<slug>`.
- Lanes commit on their branch and never push. The area manager pushes, opens the PR from `.github/pull_request_template.md` (lane, spec section, OpenSpec change, gates pasted, reviewer verdict, deferred), waits for `ci`, squash-merges with branch deletion, removes the worktree, records the PR URL in the area plan.
- `ci.yml` jobs: `core` (gofmt, `go vet`, `go test -race` against a Postgres service from `deploy/initdb.sql`, then `make gen postman` must leave `git status` clean, D14; sqlc is installed only while `services/core/sqlc.yaml` exists), `rider` (`make test-rider` against `shopperstop_rider_test` on a Postgres service from `deploy/initdb.sql`; skipped while `services/rider` is absent), `web` (`npm ci`, `make test-web`), `e2e` (`make e2e`: Playwright, Chromium only, `shopperstop_core_e2e` and `shopperstop_rider_e2e`, core :18080, rider :18081, web and admin previews 15173 and 15174 (admin under /admin/), rider preview 15175 (under /rider/), mobile web export preview 15176, D15), `spec` (`openspec validate --all --strict`); Node 22 in CI. Each job no-ops with a message while its directory does not exist. Branch protection waits until the repo is public; the PR-only rule is process-enforced until then.
- Releases: one tag per completed phase, `v0.<phase>.<patch>`, by the program orchestrator at phase close; chore PRs carry the `chore` label.
- Not used: GitHub Projects, Issues, Wiki, Discussions. `PLAN.md` is the single plan.

## API documentation (Spec 1 §11)

Every service's `openapi.json` is the contract and the documentation: `summary`, `description`, capability tag, typed schemas, every error code, at least one example per route. A test fails when a served route is missing from the file or the file names an unserved route. `make postman` regenerates `docs/postman/shopperstop-core.postman_collection.json` (and `shopperstop-rider.postman_collection.json` once `services/rider/openapi.json` exists) and CI fails on a diff; `docs/postman/local.postman_environment.json` holds `baseUrl`, `riderBaseUrl` and the token and id variables. `healthz` and `readyz` are listed in `openapi.json` like every served route (D16); `make gen` turns each file into `packages/ui/src/api/<service>.d.ts`.

## UI conventions (Spec 1 §8 and §10, binding for every web change)

Blinkit-like: yellow brand surface, green for actions and prices, dense product grids, sticky cart bar, large tap targets. Light theme only for now; tokens are structured so dark mode is a second value block later. Read Spec 1 §8 and the Figma file linked in `docs/figma.md` before touching `apps/*` or `packages/ui`. The file in `docs/figma.md` has three pages, `Tokens & Components`, `Customer web` and `Admin web`, instead of Spec 1 §9's five (Starter plan, D17); `packages/ui/scripts/check-figma-tokens.mjs` diffs a variables export against `tokens.css`, by hand. The mobile screens are in the design canvas linked from `docs/figma.md` (D36).

- Colours come only from the semantic tokens in `packages/ui/src/tokens.css` (`brand`, `brand-strong`, `on-brand`, `accent`, `accent-hover`, `accent-soft`, `on-accent`, `canvas`, `surface`, `line`, `line-strong`, `ink`, `ink-muted`, `focus`, `danger`/`danger-soft`, `warning`/`warning-soft`, `success`/`success-soft`), mapped into Tailwind 4 `@theme`. `no-literal-colors.test.ts` in each app fails on hex colours, Tailwind palette utilities, `bg-white`/`text-white` and colour functions.
- Yellow is only a surface, never text on canvas. Green is the single action colour: actions, prices, links, the current nav item. Status colours mean error, caution and success and nothing else. Text pairs at or above 4.5:1, borders at 3:1.
- Type is Inter alone, bundled. Scale: `display` 28/34 700, `h1` 24/30 700, `h2` 20/26 700, `h3` 16/22 600, `body` 14/20, `small` 12/16, `button` 14/20 600. Weights 400, 600, 700 only. Prices and order ids use `tabular-nums`.
- Radius 8 px controls and inputs, 12 px cards and sheets, pill for chips and the Stepper. 4 px spacing grid; gutters 16 px phone, 24 px desktop. Only `shadow-card` and `shadow-sheet`; default Tailwind colours and shadows are switched off.
- Icons are Lucide, 20 px default, 16 px in buttons, `aria-hidden` next to visible text; icon-only controls carry `aria-label`. Product and category images are 1:1 tiles.
- Pages compose the `packages/ui` components (`Button`, `ButtonLink`, `IconButton`, `Input`, `FormField`, `Select`, `Stepper`, `Badge`, `Chip`, `Card`, `Dialog` + `DialogFooter` with Cancel first, `Sheet`, `Table` with `stack`, `EmptyState`, `ErrorBanner`, `StatusMessage`, `Skeleton`, `PageHeader`, `TabNav`, `Price`) and never define a one-off recipe. A new pattern goes into `packages/ui` with a test and a Figma component.
- Motion 150 ms ease-out on hover, 200 ms on sheets, off under `prefers-reduced-motion`. Tap targets at least 44 px on phone; visible `focus` ring everywhere; dialogs trap focus and close on Escape; the Orders board uses `aria-live`. Playwright runs axe on every page it visits.
