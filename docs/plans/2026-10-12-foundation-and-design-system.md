# Foundation and Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repository the plan is executed through `/orchestrate` (PLAN.md, manager / worker / reviewer lanes, one task per lane); the sub-skill rules still apply inside each lane.

**Goal:** A fresh clone runs `make dev` and gets Postgres, the core service on :8080 answering `/api/core/v1/healthz`, and two themed React shells on :5173 and :5174; `make test`, `make e2e` and CI are green; OpenSpec, Postman generation, the orchestration files and the Figma file exist, so Spec 2's feature work starts with nothing left to set up.

**Architecture:** One repository, `services/core` (Go, chi, pgx, own Postgres database and migration runner), `packages/ui` (tokens as CSS variables mapped into Tailwind 4, React components, generated API types), `apps/web` and `apps/admin` (Vite + TanStack Router shells consuming `@shopperstop/ui`), `deploy/` (compose, Caddy), `openspec/` (living specs), `.claude/` (lanes). Every piece is scaffolded with its real gates (tests, lint, typecheck, contract test) so Spec 2 only adds features.

**Tech Stack:** Go 1.27, `github.com/go-chi/chi/v5`, `github.com/jackc/pgx/v5`, `golang.org/x/crypto`; PostgreSQL 16 (Docker); Node 22.11+, npm workspaces, React 19, Vite 8, TypeScript strict, TanStack Router + Query, Tailwind 4, lucide-react, `@fontsource-variable/inter`, Vitest, Testing Library, ESLint (`jsx-a11y`, `react-hooks`), Playwright + `@axe-core/playwright`, `openapi-typescript`, `openapi-to-postmanv2`; OpenSpec CLI (`@fission-ai/openspec`); Figma via the Figma MCP tools.

**Spec:** `docs/specs/2026-10-12-foundation-and-design-system.md` (Spec 1). Spec 2 (`docs/specs/2026-10-12-core-service-and-apps.md`) names the screens the Figma task draws.

## Global Constraints

- Go 1.27; allowed modules `github.com/go-chi/chi/v5`, `github.com/jackc/pgx/v5`, `golang.org/x/crypto` and sqlc output only; `log/slog` for logs; no ORM, no DI, no logging library (Spec 1 §4).
- One database per service, one owner role per service, a `_test` database per service; no cross-database access (§4).
- Web: React 19, Vite 8, TS strict, TanStack Router (file-based) + Query, Tailwind 4 via `@tailwindcss/vite`, `lucide-react`, `openapi-fetch` + `openapi-typescript`, Vitest + Testing Library, ESLint with `jsx-a11y` and `react-hooks`, Playwright; fonts bundled through `@fontsource-variable/inter`, never a font CDN; Node 22.11+, npm workspaces; no other runtime dependency without a PLAN.md decision (§4).
- Naming table in §3: kebab-case dirs and TS files, PascalCase component exports, one-word Go packages, `SHOPPERSTOP_CORE_` env prefix, routes `/api/core/v1/<plural-kebab-noun>`, camelCase JSON, never `null` (optional = omitted, arrays always present).
- Colours only through the semantic tokens of §8.1 (`brand`, `brand-strong`, `on-brand`, `accent`, `accent-hover`, `accent-soft`, `on-accent`, `canvas`, `surface`, `line`, `line-strong`, `ink`, `ink-muted`, `focus`, `danger`, `danger-soft`, `warning`, `warning-soft`, `success`, `success-soft`); `no-literal-colors.test.ts` fails on hex colours, Tailwind palette utilities, `bg-white`/`text-white`, colour functions (§8.1).
- Type scale §8.2: `display` 28/34 700, `h1` 24/30 700, `h2` 20/26 700, `h3` 16/22 600, `body` 14/20 400, `small` 12/16 400, `button` 14/20 600; Inter only; weights 400, 600, 700; tabular numerals on prices and order ids.
- Radius 8 px controls, 12 px cards and sheets, pill chips and stepper; 4 px spacing grid; only `shadow-card` and `shadow-sheet`; default Tailwind colours and shadows switched off (§8.3).
- Icons Lucide, 20 px default, 16 px in buttons, `aria-hidden` next to text; icon-only controls carry `aria-label` (§8.4). Tap targets 44 px on phone; visible focus ring; `prefers-reduced-motion` honoured; axe on every e2e page (§8.5).
- Commit identity `kapildev333 <47056817+kapildev333@users.noreply.github.com>`; no AI attribution or co-author lines; no personal details anywhere (§6). Repo private (§6).
- TDD: failing test committed first (`test: <scenario>`), then the code (`feat:`/`fix:`), then refactor with the suite green; no mocks of the database or HTTP layer (§5.2).
- Agents never run `docker compose` or touch containers; Postgres is `shopperstop-postgres-1`, started by the orchestrator with `make db` (§5).

## Review Focus

1. `SHOPPERSTOP_CORE_WEB_ORIGINS` containing spaces or a trailing comma (`http://a, http://b,`): CORS must still match `http://b` and never allow the empty origin. Pinned in Task 5 (`TestLoadTrimsOrigins`) and Task 6 (`TestCORSRejectsUnknownOrigin`).
2. A request body with a NUL byte or over the limit: `ReadJSON` must answer 400 `validation`, not 500 or a hang. Pinned in Task 6 (`TestReadJSONRejectsNUL`, `TestReadJSONTooLarge`).
3. A migration file that fails halfway: the version must not be recorded and the next run must retry it. Pinned in Task 7 (`TestApplyRollsBackFailedMigration`).
4. `formatInr` on 0, on amounts with paise, and on lakh-scale totals: `₹0`, `₹1,234.50`, `₹1,23,456`. Pinned in Task 9 (`price.test.tsx`).
5. The Stepper at `max = 0` and at `value = max`: ADD disabled with "Out of stock", `+` disabled, `−` always enabled above 0. Pinned in Task 9 (`stepper.test.tsx`).

---

## File structure

```
.gitignore, package.json (workspaces), Makefile, README.md, CLAUDE.md, PLAN.md
.github/workflows/ci.yml, .github/pull_request_template.md, .github/dependabot.yml
.claude/agents/{manager,worker,reviewer}.md, .claude/commands/orchestrate.md, .claude/lanes/README.md
openspec/                              created by `openspec init`; specs/{platform,design-system}/spec.md seeded here
deploy/docker-compose.yml, deploy/initdb.sql, deploy/Caddyfile
services/core/go.mod, go.sum
services/core/openapi.json
services/core/migrations/migrations.go (embed), 0001_init.sql
services/core/cmd/core/main.go
services/core/cmd/core-admin/main.go
services/core/internal/config/{config.go,config_test.go}
services/core/internal/httpx/{json.go,errors.go,router.go,cors.go,json_test.go,router_test.go}
services/core/internal/pg/{pg.go}
services/core/internal/migrate/{migrate.go,migrate_test.go}
services/core/internal/testdb/testdb.go
services/core/internal/app/{app.go,app_test.go,contract_test.go}
packages/ui/package.json, tsconfig.json, vitest.config.ts, src/index.ts, src/tokens.css, src/test-setup.ts
packages/ui/src/{cn,button,price,stepper,badge,chip,card,dialog,sheet,input,form-field,select,table,empty-state,error-banner,status-message,skeleton,page-header,tab-nav,icon-button}.tsx (+ .test.tsx each)
packages/ui/src/testing/literal-colors.ts, src/api/core.d.ts (generated)
packages/ui/scripts/check-figma-tokens.mjs
apps/web/{package.json,vite.config.ts,tsconfig.json,index.html,eslint.config.js,playwright.config.ts}
apps/web/src/{main.tsx,index.css,test-setup.ts,no-literal-colors.test.ts,routes/__root.tsx,routes/index.tsx,routeTree.gen.ts}
apps/web/e2e/smoke.spec.ts
apps/admin/  same files as apps/web with the admin shell
scripts/postman.mjs, docs/postman/{shopperstop-core.postman_collection.json,local.postman_environment.json}
docs/figma.md
```

Task order: 1 repo root and GitHub → 2 orchestration files → 3 OpenSpec → 4 deploy and Makefile db → 5 core config → 6 httpx → 7 migrations → 8 core server, app and contract test → 9 packages/ui → 10 apps/web → 11 apps/admin → 12 Postman → 13 CI and Makefile → 14 Figma → 15 README, CLAUDE.md, docs/figma.md. Tasks 5 to 8 are sequential (same module); 9 → 10 → 11 sequential; 3, 4, 12 can run beside the core tasks; 14 runs beside 9 to 13 in the main session.

---

### Task 1: Repository root and private GitHub repo

**Files:**
- Create: `.gitignore` (replace), `package.json`, `.github/pull_request_template.md`, `.github/dependabot.yml`
- Owner's call already given (Spec 1 §14 Q1): repo `kapildev333/shopperstop`, private.

**Interfaces:**
- Produces: npm workspaces `apps/*`, `packages/*`; the remote `origin`; PR template every later PR uses.

- [ ] **Step 1: Write the root files**

`.gitignore`:
```
.DS_Store
node_modules/
.env
.env.*
.worktrees/
services/*/data/
apps/*/dist/
apps/*/test-results/
apps/*/playwright-report/
apps/*/e2e/.tmp/
packages/*/dist/
```

`package.json`:
```json
{
  "name": "shopperstop",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=22.11.0" },
  "scripts": {
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present -- --run",
    "build": "npm run build --workspace packages/ui && npm run build --workspace apps/web && npm run build --workspace apps/admin",
    "postman": "node scripts/postman.mjs"
  },
  "devDependencies": {
    "openapi-to-postmanv2": "6.4.0"
  }
}
```

`.github/pull_request_template.md`:
```markdown
## Lane
<LANE-ID> · spec section · OpenSpec change `<name>`

## What landed
-

## Gates (pasted output)
```
make test
```

## Reviewer verdict
approve / changes needed, findings addressed:

## Deferred
-
```

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: gomod
    directories: ["/services/*"]
    schedule: { interval: weekly }
  - package-ecosystem: npm
    directory: "/"
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: "/"
    schedule: { interval: weekly }
```

- [ ] **Step 2: Verify npm accepts the workspace file**

Run: `npm install --package-lock-only` from the repo root.
Expected: a `package-lock.json` is written, no error (workspace dirs may not exist yet; npm tolerates that).

- [ ] **Step 3: Commit**

```bash
git add .gitignore package.json package-lock.json .github
git commit -m "chore: repo root, npm workspaces, PR template, dependabot"
```

- [ ] **Step 4: Create the private repo and push (orchestrator, needs the owner's confirmed name)**

```bash
gh repo create kapildev333/shopperstop --private --source=. --remote=origin --push
gh repo view kapildev333/shopperstop --json visibility --jq .visibility
```
Expected: `PRIVATE`.

---

### Task 2: Orchestration files

> Done 2026-10-12 in the main session, under PLAN.md D5 (areas with Fable managers; `team-lead` replaces `manager`, plus `/manage` and `.claude/areas/`). The file contents below are the pre-D5 draft; the landed files in `.claude/` are authoritative.

**Files:**
- Create: `.claude/agents/manager.md`, `.claude/agents/worker.md`, `.claude/agents/reviewer.md`, `.claude/commands/orchestrate.md`, `.claude/lanes/README.md`, `PLAN.md`

**Interfaces:**
- Produces: the three lane definitions `/orchestrate` launches; `PLAN.md` the orchestrator fills from this plan.

- [ ] **Step 1: Write the agents**

`.claude/agents/manager.md`:
```markdown
---
name: manager
description: Feature lane. Owns one feature end to end: the OpenSpec change (proposal, spec deltas, design, tasks), the design document when needed, one brief per worker task, and the final acceptance against the spec deltas. Writes no product code.
model: claude-opus-5-5
tools: Read, Write, Bash, Glob, Grep, TodoWrite
---

You own a feature; you do not implement it.

- Read the brainstorm spec section and the existing code the brief points at before proposing anything.
- Run the OpenSpec change for the feature in `openspec/changes/<name>/`: `proposal.md`, `specs/<capability>/spec.md` deltas (`## ADDED|MODIFIED|REMOVED|RENAMED Requirements`, every requirement with at least one `#### Scenario:` of **WHEN** / **THEN** bullets), `design.md`, `tasks.md` with checkboxes. `openspec validate <name> --strict` must pass before you report.
- Write `docs/design/<LANE-ID>.md` only when `design.md` is not enough for a worker to build without design decisions: data model, interfaces, module boundaries, error handling, test strategy.
- Cut `tasks.md` into worker briefs, one task each: scope paths, the scenario it implements, the failing test it starts from (file and test name), the commit sequence (`test:` then `feat:`), the gates to run. Put the briefs in your report; the orchestrator launches the workers.
- Prefer the smallest design that meets the spec. Name every simplification and its ceiling.
- Stay reachable: answer worker questions relayed by the orchestrator in your lane log.
- Acceptance: when all tasks are ticked, run `/opsx:verify` logic by hand: every scenario in the deltas has a passing test, every task is done, nothing extra landed. Report pass or the exact gaps.
- Work in the worktree and branch the brief names; commit there; never push or touch the main checkout.
- Do not edit product code or PLAN.md. Decisions that need the owner's call go in your report.
- Keep `.claude/lanes/<LANE-ID>.md` current (format in `.claude/lanes/README.md`). Read the other lane files when you start and before you finish.

Report: the change name and where the artifacts are, the worker briefs, decisions made, decisions escalated, open risks.

- Never run `docker compose`, and never start, stop or remove containers or volumes: the local Postgres is `shopperstop-postgres-1`; if a port is taken, report it.
```

`.claude/agents/worker.md`:
```markdown
---
name: worker
description: Implementation lane. Builds exactly one task from its brief, test first, inside its own scope. Use for all feature and routine work once the manager has cut the tasks.
model: claude-haiku-5-5
tools: Read, Edit, Write, Bash, Glob, Grep, TodoWrite
---

You implement the one task in your brief and nothing else.

- Work only inside the paths the brief lists. Anything needed outside them: list it in your report, do not edit it.
- Test first, always: write the failing test the brief names, run it and see it fail, commit it (`test: <scenario>`); then the smallest code that passes, run it, commit (`feat: ...` or `fix: ...`); then clean up with the suite green. A behaviour commit without a preceding failing test is a review failure.
- No mocks of the database or the HTTP layer; tests run against the real test database and the real router.
- Follow the design the brief references. If the brief leaves a design choice open, stop and report it instead of picking.
- Run the full gates for what you touched (`make test` for the repo, or the service or app gates the brief names) before you finish. If a gate fails on code you did not touch, report it; do not scope it away.
- A new failure path must say what happened (log, audit or UI).
- Tick your task in `openspec/changes/<name>/tasks.md` when it is done.
- Do not edit PLAN.md.
- Work in the worktree and branch the brief names; never touch the main checkout. Commit with short imperative messages; never push, never merge, never open a PR.
- Keep `.claude/lanes/<LANE-ID>.md` current (format in `.claude/lanes/README.md`). Read the other lane files when you start and before you finish.

Report: what you built, gates run with results, what you deferred and why, choices you had to escalate.

- Never run `docker compose`, and never start, stop or remove containers or volumes: the local Postgres is `shopperstop-postgres-1`; if a port is taken, report it.
```

`.claude/agents/reviewer.md`:
```markdown
---
name: reviewer
description: Detailed code review lane. Reviews a landing against its brief, spec deltas and design for correctness, test-first order, scope and simplicity. Read-only; use after a worker lane finishes and before the orchestrator verifies.
model: claude-sonnet-5-5
tools: Read, Write, Bash, Glob, Grep
---

You review in detail; you do not fix.

- Review in the lane's worktree: `git diff main...HEAD` is the landing; `git log --format='%h %s' main..HEAD` is the commit order.
- Check against the brief, the OpenSpec deltas and the design: every scenario has a test, built what was asked, nothing more, nothing missing.
- Check test-first: each `feat:`/`fix:` commit is preceded by a `test:` commit whose test fails without it (check out the test commit and run it if in doubt).
- Hunt correctness bugs first (wrong behaviour, missing error path, data loss, race), then security at trust boundaries (auth gates, input limits, leaks between stores), then scope creep, then needless complexity (reinvented stdlib, speculative abstraction, dead flexibility).
- Run the gates yourself; do not trust the worker's report.
- Each finding: file:line, what is wrong, the concrete failing input or scenario, the smallest fix.
- Do not edit any file except your own lane log.
- Keep `.claude/lanes/<LANE-ID>.md` current (format in `.claude/lanes/README.md`). Read the other lane files when you start and before you finish.

Report: verdict (approve / changes needed), findings most-severe first, gates you ran with results.

- Never run `docker compose`, and never start, stop or remove containers or volumes: the local Postgres is `shopperstop-postgres-1`; if a port is taken, report it.
```

- [ ] **Step 2: Write the orchestrate command and lane README**

`.claude/commands/orchestrate.md`:
```markdown
---
description: Start or resume an orchestration session over PLAN.md
---

You are the orchestrator for this work. Source documents: $ARGUMENTS

1. Read PLAN.md at the repo root if it exists; otherwise read the source documents and propose PLAN.md: numbered decisions that need my call, method rules, and a first phase cut into lanes with disjoint directory scopes and a model per lane. Stop there and discuss it with me.
2. Once I agree, per feature: `git worktree add -b lane/<LANE-ID>-<slug> .worktrees/<LANE-ID> main`, launch `manager` with the worktree path, branch, scope paths and spec section; when it reports, show me its OpenSpec change (`openspec show <name>`) and briefs; on my go, launch `worker` lanes from its briefs (parallel where scopes are disjoint, same branch when sequential), then `reviewer` on each landing, then re-run `manager` for acceptance. Every brief states its LANE-ID, worktree path, branch, scope paths, the OpenSpec change and task, and the failing test to start from.
3. Read every `.claude/lanes/*.md` whenever a lane reports or you check in; relay urgent cross-lane requests (SendMessage if the lane is running, otherwise in its next brief).
4. Verify every landing yourself before opening a PR: in the lane's worktree, re-run the suites, then exercise the real thing (real database, real HTTP, real browser). Never trust a lane's report or the reviewer's verdict as verification.
5. Land through GitHub only: `git push -u origin lane/<...>`, `gh pr create --fill --body-file` from the PR template (lane, spec section, OpenSpec change, gates pasted, reviewer verdict, deferred), wait for `ci`, `gh pr merge --squash --delete-branch`, `openspec archive <name> -y` on main in its own chore PR, `git worktree remove .worktrees/<LANE-ID>`. Put the PR URL in the lane's status cell in PLAN.md.
6. Keep PLAN.md current on main: statuses with PR links and evidence, notes per lane, backlog, journal. PLAN.md changes go in their own small PRs (`chore/plan-<date>`).
7. Commits are authored as `kapildev333 <47056817+kapildev333@users.noreply.github.com>` with no attribution trailers; the repo stays private until the owner opens it.
8. Escalate to me only decisions that belong in the decisions table.
```

`.claude/lanes/README.md`:
```markdown
# Lane logs

One file per lane, named by its LANE-ID from the brief: `lanes/<LANE-ID>.md`. The lane that owns the file is the only one that writes it.

```markdown
# <LANE-ID> - <deliverable>
Status: started | blocked | done
## Doing
<current step, one line, keep it current>
## Found
<things other lanes or the orchestrator need to know: changed interfaces, gotchas>
## Requests
- to <LANE-ID>: <what you need from them>
## Blockers
```

- Read every other lane's file when you start and before you finish; answer requests addressed to you in your own `Found` section.
- The orchestrator reads all lane files, relays urgent requests, and folds anything durable into PLAN.md. PLAN.md is still orchestrator-only.
```

- [ ] **Step 3: Write the PLAN.md template**

`PLAN.md`:
```markdown
# ShopperStop - orchestration plan

Spec 1: `docs/specs/2026-10-12-foundation-and-design-system.md` · plan `docs/plans/2026-10-12-foundation-and-design-system.md` (Phase 1)
Spec 2: `docs/specs/2026-10-12-core-service-and-apps.md` · plan `docs/plans/2026-10-12-core-service-and-apps.md` (Phase 2 onward)

## Decisions
| # | Decision | Status |
|---|----------|--------|
| D1 | Stack and constraints as Spec 1 §4; lanes manager (Opus 5.5) / worker (Haiku 5.5) / reviewer (Sonnet 5.5) as §5; OpenSpec and TDD as §5.1, §5.2 | Agreed (owner, 2026-10-12) |
| D2 | Repo `kapildev333/shopperstop`, private until the owner opens it; commits as `kapildev333` noreply, no attribution lines | Agreed (owner, 2026-10-12) |
| D3 | `sqlc.yaml` arrives with the first queries in Phase 2, not in Phase 1 (there is no table to query yet); the CI `sqlc diff` step is skipped while the file is absent | Orchestrator 2026-10-12 |
| D4 | Phase 1 seeds `openspec/specs/platform` and `design-system`; Phase 2's first change seeds the remaining capabilities as ADDED requirements, so each lands with its feature | Orchestrator 2026-10-12 |

## Method
- One task of the plan is one lane; the lane's directory scope is the task's **Files** list.
- Gates per PR: `make test`, `make e2e` where the task touches an app, `openspec validate --all --strict`, `make postman` clean.
- The orchestrator verifies every landing (suites, then real database / HTTP / browser) before the PR.

## Phase 1 - Foundation and design system
| Lane | Task | Scope | Model | Status |
|------|------|-------|-------|--------|
| P1-L1 | Task 1 repo root | `/.gitignore`, `/package.json`, `/.github/` | orchestrator | |
| P1-L2 | Task 2 orchestration files | `/.claude/`, `/PLAN.md` | orchestrator | |
| P1-L3 | Task 3 OpenSpec | `/openspec/` | worker | |
| P1-L4 | Task 4 deploy | `/deploy/`, `/Makefile` (db target) | worker | |
| P1-L5 | Tasks 5-8 core service | `/services/core/` | manager → workers → reviewer | |
| P1-L6 | Task 9 packages/ui | `/packages/ui/` | manager → workers → reviewer | |
| P1-L7 | Tasks 10-11 apps | `/apps/web/`, `/apps/admin/` | manager → workers → reviewer | |
| P1-L8 | Task 12 Postman | `/scripts/`, `/docs/postman/` | worker | |
| P1-L9 | Task 13 CI and Makefile | `/.github/workflows/`, `/Makefile` | worker | |
| P1-L10 | Task 14 Figma | Figma file, `/docs/figma.md` | orchestrator | |
| P1-L11 | Task 15 README, CLAUDE.md | `/README.md`, `/CLAUDE.md` | worker | |

## Backlog
-

## Journal
- 2026-10-12: specs 1 and 2 approved by the owner; plan 1 written.
```

- [ ] **Step 4: Commit**

```bash
git add .claude PLAN.md
git commit -m "chore: orchestration lanes, orchestrate command, PLAN.md"
```

---

### Task 3: OpenSpec

> Amended 2026-10-12 (PLAN.md D6): `openspec init` already ran in the main session with the full workflow profile; the CLI is `npx -y @fission-ai/openspec@latest`. This task is now only the seeding of `openspec/specs/platform` and `design-system`, done as an OpenSpec change by the platform team lead.

**Files:**
- Create: `openspec/` (by `openspec init`), `openspec/specs/platform/spec.md`, `openspec/specs/design-system/spec.md`
- The `.claude/` files `openspec init` installs (`opsx` commands, `openspec-*` skills) are committed as generated.

**Interfaces:**
- Produces: `openspec validate --all --strict` green; the two seed capability specs later changes write deltas against.

- [ ] **Step 1: Install and init**

```bash
npm install -g @fission-ai/openspec@latest
openspec --version
cd /path/to/shopperstop && openspec init --tools claude-code
```
If `--tools claude-code` is not an accepted id, run `openspec init` and pick Claude Code in the prompt; `openspec init --help` lists the ids. Expected: `openspec/` exists with `specs/` and `changes/archive/`; `.claude/commands/opsx/` (or equivalent) exists.

- [ ] **Step 2: Write the platform spec**

`openspec/specs/platform/spec.md`:
```markdown
# platform

## Purpose
Cross-cutting behaviour of the core service that every capability relies on: configuration, health, the error envelope, request limits, CORS and logging.

## Requirements

### Requirement: Configuration fails fast
The core service SHALL read its configuration from `SHOPPERSTOP_CORE_*` environment variables and refuse to start while naming every missing variable.

#### Scenario: Missing variables are all named
- **WHEN** the service starts with `SHOPPERSTOP_CORE_DATABASE_URL` and `SHOPPERSTOP_CORE_SESSION_PEPPER` unset
- **THEN** it exits non-zero with a message that names both variables

#### Scenario: Short pepper is refused
- **WHEN** `SHOPPERSTOP_CORE_SESSION_PEPPER` is shorter than 32 bytes
- **THEN** the service refuses to start and says the pepper must be at least 32 bytes

### Requirement: Health endpoints
The core service SHALL answer `GET /api/core/v1/healthz` with 200 always and `GET /api/core/v1/readyz` with 200 only when the database answers a ping.

#### Scenario: Ready when the database answers
- **WHEN** the database is reachable
- **THEN** `readyz` answers 200 `{"status":"ok"}`

#### Scenario: Not ready when the database is down
- **WHEN** the database does not answer within 2 seconds
- **THEN** `readyz` answers 503 with the error envelope code `internal`

### Requirement: Error envelope
Every error response SHALL be JSON `{"error":{"code","message","field"?}}` with `code` one of `validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `out_of_stock`, `not_serviceable`, `rate_limited`, `internal`.

#### Scenario: Unknown route
- **WHEN** a client requests a path the router does not serve
- **THEN** the response is 404 with code `not_found`

#### Scenario: Panic in a handler
- **WHEN** a handler panics
- **THEN** the response is 500 with code `internal` and the panic is logged with the request id

### Requirement: Request body limits
The core service SHALL reject JSON bodies over 1 MiB (16 MiB on image upload), bodies containing a NUL byte, and malformed JSON, with 400 `validation`.

#### Scenario: NUL byte in a field
- **WHEN** a JSON body contains `\u0000` in any string
- **THEN** the response is 400 with code `validation`

#### Scenario: Body too large
- **WHEN** a JSON body exceeds 1 MiB
- **THEN** the response is 400 with code `validation` and message `body too large`

### Requirement: CORS
The core service SHALL allow cross-origin requests only from the origins in `SHOPPERSTOP_CORE_WEB_ORIGINS`, with `Authorization` and `Content-Type` headers and the methods GET, POST, PUT, PATCH, DELETE.

#### Scenario: Allowed origin
- **WHEN** a request carries `Origin: http://localhost:5173` and that origin is configured
- **THEN** the response carries `Access-Control-Allow-Origin: http://localhost:5173`

#### Scenario: Unknown origin
- **WHEN** a request carries an origin that is not configured
- **THEN** the response carries no `Access-Control-Allow-Origin` header

### Requirement: Request logging
The core service SHALL log one JSON line per request with method, route pattern (never the raw path), status, duration and request id, and accept or generate `X-Request-Id`.

#### Scenario: Route pattern, not path
- **WHEN** a client requests `/api/core/v1/stores/123e4567-e89b-12d3-a456-426614174000`
- **THEN** the log line's `route` is `/api/core/v1/stores/{id}`

#### Scenario: Request id echoed
- **WHEN** a request carries `X-Request-Id: abc`
- **THEN** the response carries `X-Request-Id: abc` and the log line has `requestId` `abc`
```

- [ ] **Step 3: Write the design-system spec**

`openspec/specs/design-system/spec.md`:
```markdown
# design-system

## Purpose
The visual system both web apps share: semantic colour tokens, type scale, shape, icons, motion and accessibility, delivered by `packages/ui` and mirrored in the Figma file.

## Requirements

### Requirement: Semantic colour tokens only
Feature code in `apps/web`, `apps/admin` and `packages/ui` SHALL use colours only through the semantic tokens `brand`, `brand-strong`, `on-brand`, `accent`, `accent-hover`, `accent-soft`, `on-accent`, `canvas`, `surface`, `line`, `line-strong`, `ink`, `ink-muted`, `focus`, `danger`, `danger-soft`, `warning`, `warning-soft`, `success`, `success-soft`, defined once in `packages/ui/src/tokens.css`.

#### Scenario: Literal colour fails the gate
- **WHEN** a source file under `src/` (other than `tokens.css`) contains a hex colour, a Tailwind palette utility such as `bg-gray-100`, `bg-white`, `text-white`, or a colour function such as `rgb(`
- **THEN** `no-literal-colors.test.ts` fails and names the file and the match

### Requirement: Type scale
Text SHALL use Inter (bundled, no CDN) at the scale display 28/34 700, h1 24/30 700, h2 20/26 700, h3 16/22 600, body 14/20 400, small 12/16 400, button 14/20 600, and prices and order numbers SHALL use tabular numerals.

#### Scenario: Price uses tabular numerals
- **WHEN** a `Price` renders
- **THEN** its element has the `tabular-nums` class

### Requirement: Shared components
`packages/ui` SHALL export Button, ButtonLink, IconButton, Input, FormField, Select, Stepper, Badge, Chip, Card, Dialog, Sheet, Table, EmptyState, ErrorBanner, StatusMessage, Skeleton, PageHeader, TabNav, Price, `formatInr` and `cn`, each with a test, and the apps SHALL compose pages from them rather than define one-off recipes.

#### Scenario: Stepper at zero stock
- **WHEN** a Stepper renders with `max` 0
- **THEN** it shows a disabled control labelled "Out of stock" and never calls `onChange`

#### Scenario: Stepper at the maximum
- **WHEN** a Stepper renders with `value` equal to `max`
- **THEN** the increment control is disabled and the decrement control is enabled

#### Scenario: Price formatting
- **WHEN** `formatInr` receives 123400, 123450 and 12345600
- **THEN** it returns `₹1,234`, `₹1,234.50` and `₹1,23,456`

### Requirement: Accessibility baseline
Every interactive element SHALL be keyboard reachable with a visible focus ring, tap targets on phone SHALL be at least 44 px, dialogs SHALL trap focus and close on Escape, icon-only controls SHALL carry `aria-label`, and `prefers-reduced-motion` SHALL disable transitions.

#### Scenario: Dialog closes on Escape
- **WHEN** a Dialog is open and the user presses Escape
- **THEN** `onClose` is called

#### Scenario: Axe on every e2e page
- **WHEN** the Playwright suite visits a page
- **THEN** `@axe-core/playwright` reports no violations
```

- [ ] **Step 4: Validate**

Run: `openspec validate --all --strict`
Expected: both specs valid, no changes listed.

- [ ] **Step 5: Commit**

```bash
git add openspec .claude
git commit -m "chore: openspec init, seed platform and design-system specs"
```

---

### Task 4: Deploy files and `make db`

**Files:**
- Create: `deploy/docker-compose.yml`, `deploy/initdb.sql`, `deploy/Caddyfile`, `Makefile` (first version; Task 13 completes it)

**Interfaces:**
- Produces: Postgres on 5432 with databases `shopperstop_core`, `shopperstop_core_test`, `shopperstop_core_e2e`, role `shopperstop_core` / `shopperstop_core`; container `shopperstop-postgres-1`.

- [ ] **Step 1: Write the files**

`deploy/docker-compose.yml`:
```yaml
name: shopperstop
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./initdb.sql:/docker-entrypoint-initdb.d/initdb.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      timeout: 2s
      retries: 30
  caddy:
    image: caddy:2
    profiles: ["prod"]
    ports: ["80:80"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ../apps/web/dist:/srv/web:ro
      - ../apps/admin/dist:/srv/admin:ro
volumes:
  pgdata:
```

`deploy/initdb.sql` (also run by CI against its Postgres service):
```sql
create role shopperstop_core login password 'shopperstop_core';
create database shopperstop_core owner shopperstop_core;
create database shopperstop_core_test owner shopperstop_core;
create database shopperstop_core_e2e owner shopperstop_core;
```

`deploy/Caddyfile`:
```
:80 {
	handle /api/core/* {
		reverse_proxy host.docker.internal:8080
	}
	handle /admin/* {
		uri strip_prefix /admin
		root * /srv/admin
		try_files {path} /index.html
		file_server
	}
	handle {
		root * /srv/web
		try_files {path} /index.html
		file_server
	}
}
```

`Makefile` (first version):
```make
# Local development. Needs Docker, Go and Node (see README.md). GNU make 3.81 or newer.
SHELL = /bin/sh
.PHONY: db

db:
	docker compose -f $(CURDIR)/deploy/docker-compose.yml up -d --wait postgres
```

- [ ] **Step 2: Verify (orchestrator only; lanes never run compose)**

```bash
make db
docker ps --format '{{.Names}}' | grep shopperstop-postgres-1
PGPASSWORD=shopperstop_core psql -h localhost -U shopperstop_core -d shopperstop_core_test -c 'select 1'
```
Expected: container listed, `select 1` returns `1`.

- [ ] **Step 3: Commit**

```bash
git add deploy Makefile
git commit -m "chore: postgres compose, initdb roles and databases, caddyfile"
```

---
