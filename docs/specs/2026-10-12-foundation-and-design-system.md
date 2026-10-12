# Spec 1: Foundation and design system

Status: draft for the owner's review, 2026-10-12. Decided in brainstorming on 2026-10-12; companion to Spec 2 (`2026-10-12-core-service-and-apps.md`), which depends on it.

## 1. Intent

ShopperStop is a quick-commerce product in the shape of Blinkit: a customer orders groceries from the nearest dark store and a store packs and delivers them in minutes. It is a portfolio product built to the same standard as UniCourse (`../../../UniCourse`): real flows, tests, documented design, multi-agent orchestration. It is built as microservices in one repository: a core service first, then rider, payment and receipt services, each its own Go module and database, talking over HTTP.

This spec sets up everything the first feature work needs and that every later service and app will share: repository layout, stack and versions, the orchestration workflow, Git and CI rules, local development, the visual design system, the Figma file, and the shared UI package. It produces no product feature; Spec 2 does.

Success: a fresh clone runs `make dev` and gets Postgres, the core service answering `/api/core/v1/healthz`, and both web apps serving a themed empty shell; `make test` and CI are green on that tree; the Figma file holds the tokens, the component set and every screen Spec 2 names; the orchestration files let `/orchestrate` start Phase 1 of Spec 2 without further setup.

## 2. Out of scope

Any product feature (Spec 2). Rider, payment, receipt and mobile (their own specs). Deployment beyond `docker compose` on one machine. Dark mode (deferred to after the mobile app). A design system beyond what Spec 2's screens use.

## 3. Repository layout

```
shopperstop/
  services/core/          Go module github.com/kapildev333/shopperstop/services/core
    cmd/core/             the HTTP server
    cmd/core-admin/       migrate, seed-demo, create-admin
    migrations/           NNNN_<name>.sql, applied in order by core-admin (own runner, no library)
    queries/              sqlc input, one file per package (catalog.sql, store.sql, ...)
    internal/             Go packages, see Spec 2 §9
    openapi.json          OpenAPI 3.1 contract for /api/core/v1, checked by a test
    sqlc.yaml
  services/<name>/        every later service, same shape, own module and database
  apps/web/               customer site, React + Vite + TypeScript
  apps/admin/             admin and store-staff panel, same stack
  packages/ui/            shared tokens and components, consumed by both apps as a workspace package
  deploy/
    docker-compose.yml    postgres, caddy
    Caddyfile             /api/core/* -> core:8080; / -> web; /admin/* -> admin (prod); dev uses Vite proxies instead
    initdb.sql            roles and databases: shopperstop_core, shopperstop_core_test, one owner role per service
  docs/specs/             frozen: the two 2026-10-12 founding briefs; all later specification is OpenSpec
  docs/plans/             frozen: the Phase 1 plan; later work is planned as OpenSpec changes
  docs/design/            designer-lane output, <LANE-ID>.md
  docs/figma.md           link to the Figma file and the page map (§9)
  docs/postman/           Postman collection and environment generated from openapi.json (§11)
  openspec/               OpenSpec root: specs/ (the living spec per capability), changes/ (one per feature), changes/archive/ (§5.1)
  .claude/                agents (team-lead, worker, reviewer), commands (orchestrate, manage), areas/, lanes/, opsx commands installed by openspec init
  .github/                workflows/ci.yml, pull_request_template.md, dependabot.yml
  PLAN.md                 orchestration plan, orchestrator-only
  Makefile                dev, db, seed, core, web, admin, test, e2e, gen, prod-local
  package.json            npm workspaces: apps/*, packages/*
  CLAUDE.md, README.md, .gitignore
```

Naming, one convention per layer:

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
| Domain terms | one word per concept everywhere: store (dark store), service area (pincode a store delivers to), category, product, stock (quantity of a product at a store), customer, address, cart, order, staff (admin or store staff), rider (later) | never "shop", "warehouse", "item" for product, "user" for customer |

## 4. Stack and constraints

- Go 1.27. Allowed modules in every service: `github.com/go-chi/chi/v5`, `github.com/jackc/pgx/v5`, `golang.org/x/crypto`, and what `sqlc` generates (it emits plain pgx code, no runtime dependency). Anything else is a decision in PLAN.md. No ORM, no DI framework, no logging library (`log/slog`).
- sqlc 1.x generates `internal/<pkg>/db/` from `queries/<pkg>.sql` against the migrations; generated code is committed and `make gen` must leave the tree clean in CI.
- PostgreSQL 16 in Docker. One database per service, one owner role per service, a `_test` database per service. No cross-database access.
- Web: React 19, Vite 8, TypeScript strict, TanStack Router (file-based, `@tanstack/router-plugin`) and TanStack Query, Tailwind 4 via `@tailwindcss/vite`, `lucide-react`, `openapi-fetch` + `openapi-typescript` for a typed client. Vitest + Testing Library, ESLint with `jsx-a11y` and `react-hooks`, Playwright for e2e. Fonts bundled through `@fontsource-variable/inter`; no runtime request to a font CDN. Node 22.11 or newer, npm workspaces.
- `packages/ui` is TypeScript + Tailwind, built by `tsc` to `dist/` and consumed as `@shopperstop/ui`; its `tokens.css` is the single source of colour, radius and spacing values for both apps.
- No other runtime dependency in the web apps without a PLAN.md decision.

## 5. Orchestration workflow

Amended 2026-10-12 (PLAN.md D5): the workflow is organised by area. The owner replaced the single manager lane with one Fable manager session per sub-project.

- Areas are sub-projects with disjoint scopes: `platform` (root files, `deploy/`, `.github/`, `openspec/`, `docs/`, `Makefile`, `README.md`, `CLAUDE.md`), `core` (`services/core/`), `ui` (`packages/ui/`), `web` (`apps/web/`), `admin` (`apps/admin/`); each later service is an area. Each has a plan in `.claude/areas/<area>.md`.
- `/orchestrate <source documents>` (`.claude/commands/orchestrate.md`): the program orchestrator, a Fable 5.1 session. Owns `PLAN.md` and the root checkout, writes each area's work package, relays cross-area requests, verifies integration and tags releases at phase close.
- `/manage <area>` (`.claude/commands/manage.md`): the area manager, a Fable 5.1 session per area in its own terminal. Sub-agents cannot launch sub-agents, so a manager that commands lanes must be a session. It launches the lanes below, verifies every landing itself (suites, then the real database, HTTP and browser), lands PRs, and keeps the area plan current.
- Lanes inside an area, per feature, in order:
  - `team-lead` (Opus 5.5) owns the feature end to end: the OpenSpec change (§5.1), `docs/design/<LANE-ID>.md` when the change's `design.md` is not enough, one brief per worker task (one task, one scope, the failing test it must start from), and the feature-level acceptance against the spec deltas. It writes no product code.
  - `worker` (Haiku 5.5) implements one task from its brief, test first (§5.2), inside its scope, and stops on any open design choice.
  - `reviewer` (Sonnet 5.5) reviews every landing read-only and in detail: brief and spec delta coverage, correctness, the test-first commit order, scope creep, needless complexity; re-runs the gates itself. Findings are file:line with the failing scenario and the smallest fix.
- `LANE-ID = <area>-P<phase>-L<n>`. Lane logs in `.claude/lanes/<LANE-ID>.md` (format in `.claude/lanes/README.md`); each lane writes only its own file.
- Contracts between areas are files: `services/core/openapi.json`, `packages/ui/src/tokens.css` and the `@shopperstop/ui` exports, `openspec/specs/`. A change needed in another area is a request in the area plan, relayed by the orchestrator; no lane edits outside its area.
- Only the orchestrator edits `PLAN.md` or touches the root checkout. One directory has one owner at a time; one integration suite runs at a time across all managers.
- Agents never run `docker compose` or touch containers; the local Postgres is `shopperstop-postgres-1`, started by the owner or the orchestrator through `make db`.

### 5.1 Spec-driven with OpenSpec

Development is spec-driven with OpenSpec, run as `npx -y @fission-ai/openspec@latest` (initialised 2026-10-12 with the Claude Code integration and the full workflow profile, so the `/opsx:*` commands live under `.claude/commands/opsx/`). Amended 2026-10-12 (PLAN.md D6): OpenSpec is the only spec tool. The two documents in `docs/specs/` are frozen founding briefs that the first platform change seeds into `openspec/specs/`; no new spec or plan file is written under `docs/`. The living, normative specification is `openspec/specs/`, one folder per capability (`serviceability`, `catalog`, `stock`, `accounts`, `cart`, `orders`, `admin-stores`, `admin-catalog`, `admin-staff`, `design-system`), written as requirements with `SHALL` wording and at least one `#### Scenario:` block of **WHEN** / **THEN** bullets per requirement.

Every feature is one OpenSpec change (`openspec new change <name>`, or `/opsx:propose`) with `proposal.md`, `design.md`, `specs/<capability>/spec.md` deltas under `## ADDED|MODIFIED|REMOVED|RENAMED Requirements`, and `tasks.md` with checkboxes. The team lead drafts them from the brainstorm spec; the area manager shows them to the owner before any worker starts. Workers tick `tasks.md` as they land (`/opsx:apply`); the team lead's acceptance is `/opsx:verify`; the area manager archives with `openspec archive <name>` by PR after the feature merges, which merges the deltas into `openspec/specs/`. `openspec validate --all --strict` runs in CI and must pass. The first change of Phase 1 seeds `openspec/specs/` from the two brainstorm specs so later changes are deltas, not rewrites.

### 5.2 Test-driven development

Every task is built red, green, refactor: the worker writes the failing test from the scenario in the spec delta first and commits it (`test: <scenario>`), then the smallest code that passes (`feat:` or `fix:`), then cleans up with the suite green. A commit that adds behaviour without a preceding failing test is a reviewer finding, and the reviewer checks commit order on every landing. Go tests run against the real database; web tests use Testing Library; the end-to-end scenarios in Spec 2 §13 are written before the pages they cover and fail until the pages exist. No mocks of the database or the HTTP layer; fakes only at the process boundary (clock, files, later the SMS sender).

## 6. Git and GitHub

- Repository `kapildev333/shopperstop`, **private** until the owner has verified everything and says to open it, created by the orchestrator with `gh repo create --private` once the owner confirms the name (§13 Q1). `main` is the only long-lived branch.
- Commit identity is the owner's GitHub username and GitHub noreply address (`kapildev333 <47056817+kapildev333@users.noreply.github.com>`, set in the repo's `git config`); no personal email, name, address or payment detail appears anywhere in the repository, including seed data and docs. Commits and PR descriptions carry no AI attribution or co-author lines.
- One branch per lane, `lane/<LANE-ID>-<slug>`, in its own worktree under `.worktrees/<LANE-ID>` (gitignored). Non-lane changes use `chore/<slug>`. Lanes commit and never push; the orchestrator pushes, opens the PR from `.github/pull_request_template.md` (lane, spec section, gates pasted, reviewer verdict, deferred), waits for `ci`, squash-merges with branch deletion, removes the worktree, records the PR URL in PLAN.md.
- `ci.yml` jobs: `core` (gofmt, `go vet`, `sqlc diff`, `go test -race` against a Postgres service created from `deploy/initdb.sql`, then `make postman` leaves the tree clean), `web` (`npm ci`, lint, typecheck, test, build for `packages/ui`, `apps/web`, `apps/admin`), `e2e` (Playwright against a built core and both apps on scratch ports and the `_test` database), `spec` (`openspec validate --all --strict`). Every job no-ops with a clear message while its directory does not exist, so the required checks stay green on an empty tree. A private repo on a free plan has no branch protection, so the PR-only rule is enforced by the orchestrator until the repo is public; required checks `core`, `web` and `spec` with linear history are enabled then.
- Dependabot weekly for Go modules (every `services/*`), npm (root workspace) and Actions.
- Releases: one tag per completed phase, `v0.<phase>.<patch>`, by the orchestrator at phase close; chore PRs carry the `chore` label.
- Not used: GitHub Projects, Issues, Wiki, Discussions. `PLAN.md` is the single plan.

## 7. Local development

- `make db`: `docker compose -f deploy/docker-compose.yml up -d --wait` (Postgres 16 on 5432 with `initdb.sql`; Caddy is only started by `make prod-local`, dev uses Vite proxies).
- `make dev`: `db`, migrate, `seed-demo --reset`, then core on :8080, web on :5173 and admin on :5174 until Ctrl-C. Both Vite configs proxy `/api` to :8080, so the apps use relative URLs and never know the API origin.
- `make test`: core gates then web gates. `make e2e`: Playwright with its own database and ports; dev variables must not leak into it. `make gen`: sqlc, then `openapi-typescript` into `packages/ui/src/api/core.d.ts` (one generated client type shared by both apps).
- Default env (overridable): `SHOPPERSTOP_CORE_DATABASE_URL=postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core?sslmode=disable`, `SHOPPERSTOP_CORE_ADDR=:8080`, `SHOPPERSTOP_CORE_SESSION_PEPPER=dev-pepper-dev-pepper-dev-pepper-00`, `SHOPPERSTOP_CORE_FILES_DIR=$(CURDIR)/services/core/data/files`, `SHOPPERSTOP_CORE_WEB_ORIGINS=http://localhost:5173,http://localhost:5174`.
- `README.md` has the one-command quick start, the step-by-step fold, the demo sign-ins from Spec 2 §11, and a screenshots table filled by the first phase that has screens.

## 8. Visual design system

Blinkit-like, chosen by the owner on 2026-10-12: a yellow brand surface, green for actions and prices, dense product grids, a sticky cart bar, large tap targets. Light theme only in this phase; the tokens are structured so dark mode is a second block of values later.

### 8.1 Palette, semantic tokens

Defined once in `packages/ui/src/tokens.css` as CSS variables on `:root`, mapped into Tailwind 4 `@theme` so utilities are `bg-brand`, `text-ink` and so on. Feature code uses only these names; `no-literal-colors.test.ts` in each app fails on hex colours, Tailwind palette utilities, `bg-white`/`text-white` and colour functions.

| Token | Value | Use |
|---|---|---|
| `brand` | `#F8CB46` | header band, pincode bar, hero, promo tiles |
| `brand-strong` | `#E5B51F` | hovered brand surfaces |
| `on-brand` | `#1F1F1F` | text and icons on brand |
| `accent` | `#0C831F` | primary buttons, ADD, prices, in-stock, links |
| `accent-hover` | `#0A6B19` | |
| `accent-soft` | `#E8F5EA` | ADD stepper background, selected chips |
| `on-accent` | `#FFFFFF` | |
| `canvas` | `#F5F6F8` | page background |
| `surface` | `#FFFFFF` | cards, sheets, tables |
| `line` | `#E6E8EB` | dividers, card borders |
| `line-strong` | `#C9CDD2` | input borders, secondary button border |
| `ink` | `#1F1F1F` | body text |
| `ink-muted` | `#6B7280` | secondary text, MRP strike-through |
| `focus` | `#2563EB` | focus ring only |
| `danger` / `danger-soft` | `#D92D20` / `#FEE4E2` | errors, out of stock, cancel |
| `warning` / `warning-soft` | `#B54708` / `#FEF0C7` | low stock, delayed |
| `success` / `success-soft` | `#0C831F` / `#E8F5EA` | delivered, saved |

Yellow is only a surface, never text on canvas. Green is the single action colour and sits only on actions, prices, links and the current nav item. Status colours mean error, caution and success and nothing else. Every text pair stays at or above 4.5:1 and borders at 3:1; the design document carries the measurement script.

### 8.2 Typography

Inter variable, bundled. Scale: `display` 28/34 bold (home greeting, order total), `h1` 24/30 bold, `h2` 20/26 bold, `h3` 16/22 semibold (product names, section labels), `body` 14/20, `small` 12/16 (unit label, MRP, timestamps), `button` 14/20 semibold. Weights used: 400, 600, 700. Numbers in prices and order ids use `font-variant-numeric: tabular-nums`.

### 8.3 Shape, depth, spacing

Radius: 8 px controls and inputs, 12 px cards and sheets, full pill for chips and the ADD stepper. Spacing on a 4 px grid; page gutter 16 px on phone, 24 px on desktop; product grid gap 12 px. Shadows: `shadow-card` (0 1 3 rgba(0,0,0,.08)) at rest on product cards and `shadow-sheet` (0 -4 16 rgba(0,0,0,.12)) on the cart bar and bottom sheets; nothing else casts a shadow. Default Tailwind colours and shadows are switched off.

### 8.4 Icons and imagery

Lucide, 20 px by default, 16 px inside buttons, always `aria-hidden` next to visible text; icon-only controls carry `aria-label`. Product images are 1:1, `object-fit: contain` on a `surface` tile; categories are 1:1 tiles with the name below. Placeholder imagery for the demo seed is generated once into `services/core/data/seed-images/` (free, attribution-free) and committed.

### 8.5 Motion and accessibility

Transitions 150 ms ease-out on hover and 200 ms on sheets; `prefers-reduced-motion` turns them off. Tap targets at least 44 px on phone. Every interactive element reachable by keyboard with a visible `focus` ring; dialogs trap focus and close on Escape; the Orders board announces status changes with `aria-live`. The Playwright suite runs `@axe-core/playwright` on every page it visits.

## 9. Figma

One Figma file, "ShopperStop", created with the Figma tools from this session and linked in `docs/figma.md`. Pages:

1. **Tokens**: colour, type and spacing variables with the names in §8, so they can be exported and compared against `tokens.css` (a script in `packages/ui/scripts/check-figma-tokens.mjs` diffs a JSON export against the CSS; run by hand before a design PR, not in CI).
2. **Components**: every `packages/ui` component (§10) with its variants and states.
3. **Customer web**: one frame per page in Spec 2 §7 at desktop (1280) and phone (390), plus the cart drawer, pincode sheet, and empty, loading and error states for Home, Cart and Order tracking.
4. **Admin web**: one frame per page in Spec 2 §8 at desktop 1280, plus the status dialog, stock inline edit, and empty states.
5. **Mobile**: reserved, empty, for the mobile app spec.

Order of work: tokens and components first, built from §8 and §10; then screens. Code Connect maps each `packages/ui` component to its Figma component once both exist, so `get_design_context` on a screen returns the real import paths. The screens are the reference the designer lane for each Spec 2 phase adapts; a screen changed in code is pushed back to Figma in the same PR's lane.

## 10. Shared UI package

`packages/ui` exports, each with a Vitest test and a Figma component:

`Button` (`primary`, `secondary`, `ghost`, `ghost-danger`; sizes `md` 40 px, `lg` 48 px; `loading`), `ButtonLink`, `IconButton`, `Input` and `inputClass`, `FormField` (label, hint, error), `Select`, `Stepper` (the ADD / − 1 + control, the one piece of custom interaction), `Badge` (`neutral`, `success`, `warning`, `danger`, `accent`), `Chip` (selectable), `Card`, `Dialog` + `DialogFooter` (Cancel first), `Sheet` (bottom sheet on phone, side drawer on desktop), `Table` with a `stack` mode for phone rows, `EmptyState`, `ErrorBanner`, `StatusMessage`, `Skeleton` with `grid`, `list` and `table` variants, `PageHeader`, `TabNav`, `Price` (formats cents as `₹1,234`, optional MRP strike-through), `Money` helpers, `cn`. Plus `tokens.css`, the Tailwind preset, and `api/core.d.ts` generated from the contract.

A new pattern goes into `packages/ui` with a test and a Figma component, never as a one-off in an app.

## 11. API documentation: OpenAPI and Postman

Every service's `openapi.json` is the contract and the documentation: every route has `summary`, `description`, tagged by capability, typed request and response schemas, every error code it can return with the envelope, and at least one request and response example. A test in the service fails when a registered route is missing from the file or the file names a route the router does not serve.

`make postman` (`openapi-to-postmanv2`, a dev dependency of the root workspace) generates `docs/postman/shopperstop-core.postman_collection.json` from `openapi.json`, folders by tag, every request with its example body, and an auth header that reads `{{customerToken}}` or `{{staffToken}}`. `docs/postman/local.postman_environment.json` holds `baseUrl` (`http://localhost:8080/api/core/v1`), `customerToken`, `staffToken`, `storeId`, `productId`, `addressId`, `orderId`; the sign-in requests carry a test script that stores the returned token into the matching variable, so the collection runs top to bottom against `make dev` with the demo accounts. Both files are committed; CI regenerates the collection and fails on a diff. Later services add their own collection and reuse the environment.

## 12. Gates

A PR under this spec is done when: `make test` passes on the tree; CI is green with every job either run or no-op'd with its message; `openspec validate --all --strict` passes and `openspec/specs/` holds the seeded capability specs; `make postman` is clean; `make dev` on a fresh clone reaches the three servers; the Figma file has the five pages with tokens and components complete and the Spec 2 screens drawn; `docs/figma.md` links them; `CLAUDE.md` describes the layout, conventions, orchestration and UI rules in the shape of UniCourse's.

## 13. Deferred, with triggers

- Dark mode: after the mobile app spec; tokens already allow a second value block.
- Caddy TLS and a real deploy target: first deploy off a laptop.
- Storybook or a docs site for `packages/ui`: when a third app consumes it.
- Figma token sync in CI: when the design changes more often than the code.
- Service-to-service auth and a gateway with its own code: when the rider service lands (Caddy prefix routing covers it until then).
- Branch protection with required checks: when the repo goes public (free private repos cannot enforce it).

## 14. Decisions needing the owner's call

1. Repository name: `kapildev333/shopperstop`, private until the owner verifies and opens it. The orchestrator does not create it until confirmed.
2. Go module path prefix `github.com/kapildev333/shopperstop/`: follows from Q1.
3. Currency: INR and `₹` throughout the UI (Blinkit is India-only). Change here if the demo should be CAD.
4. The Figma file is created in the owner's connected Figma account, in Drafts unless a team or project is named.
