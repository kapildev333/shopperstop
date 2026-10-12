# ShopperStop - orchestration plan

Spec 1: `docs/specs/2026-10-12-foundation-and-design-system.md` · plan `docs/plans/2026-10-12-foundation-and-design-system.md` (Phase 1)
Spec 2: `docs/specs/2026-10-12-core-service-and-apps.md` · planned as OpenSpec changes per area, no docs/plans file (D6) (Phase 2 onward)
From Phase 3 on, specification and planning happen only in `openspec/` (D6).

## Decisions
| # | Decision | Status |
|---|----------|--------|
| D1 | Stack and constraints as Spec 1 §4; OpenSpec and TDD as §5.1, §5.2 | Agreed (owner, 2026-10-12) |
| D2 | Repo `kapildev333/shopperstop`, private until the owner opens it; commits as `kapildev333` noreply, no attribution lines | Agreed (owner, 2026-10-12) |
| D3 | `sqlc.yaml` arrives with the first queries in Phase 2, not in Phase 1 (there is no table to query yet); the CI `sqlc diff` step is skipped while the file is absent | Orchestrator 2026-10-12 |
| D4 | Phase 1 seeds `openspec/specs/platform` and `design-system`; Phase 2's first change seeds the remaining capabilities as ADDED requirements, so each lands with its feature | Orchestrator 2026-10-12 |
| D5 | Organisation by area: one Fable session per area as manager (`/manage <area>`), a Fable program orchestrator (`/orchestrate`) owning PLAN.md and integration; inside an area `team-lead` (Opus 5.5) owns a feature, `worker` (Haiku 5.5) builds one task test-first, `reviewer` (Sonnet 5.5) reviews each landing. Sub-agents cannot launch sub-agents, so managers are sessions, not agents. Supersedes Spec 1 §5's single manager lane | Agreed (owner, 2026-10-12) |
| D6 | OpenSpec is the only spec tool: `openspec/specs/` is normative, every feature is a change under `openspec/changes/<area>-<slug>/`, project rules in `openspec/config.yaml`; `docs/specs/` and `docs/plans/` are frozen after the two founding briefs and the Phase 1 plan. CLI is `openspec` via a `~/.local/bin` shim over `npx -y @fission-ai/openspec@latest` (global install needs root); initialised 2026-10-12 with the full workflow profile | Agreed (owner, 2026-10-12) |
| D7 | PRD approved by the owner with every default: repo `kapildev333/shopperstop` private, module path `github.com/kapildev333/shopperstop/`; INR and Bengaluru demo pincodes; Figma file in the owner's Drafts; customers cancel only while placed or accepted; customer-facing stock capped at 10 as "10+ left"; store staff see the customer's phone; organisation by area (D5); OpenSpec only (D6). PRD: https://claude.ai/code/artifact/732c8ed8-6aa6-41d7-b4f6-df411135a0ea | Agreed (owner, 2026-10-12) |
| D8 | Guardrails are hooks, not prose: `.claude/settings.json` denies docker compose and container commands in every session; the three lane agents carry hooks that deny push, pull, merge, fetch and `gh pr`, and edits to PLAN.md or an area plan (`.claude/hooks/guard.sh`). Marketplace plugins (code-review, commit-commands, feature-dev, frontend-design, output styles) are not adopted: they overlap or conflict with the lanes, OpenSpec and the PR rules | Orchestrator 2026-10-12 |
| D9 | The owner runs the orchestrator and the platform manager in one Fable session (`/loop 10min /manage Platform /orchestrate`); orchestrator work (root checkout, PLAN.md, `make db`, repo) and platform-manager work (worktrees, lanes, PRs) keep their own rules inside it | Agreed (owner, 2026-10-12) |
| D10 | Dev tooling implied by the Spec 1 §4 stack is allowed without a per-package decision: `typescript-eslint`, `@types/*`, `jsdom`, `@testing-library/dom` and `@testing-library/jest-dom`, `@axe-core/playwright`, Vite and Vitest peers. Runtime dependencies still need a decision here | Orchestrator 2026-10-12 |
| D11 | Node floor is >=22.12.0 (Vite 8, Vitest 5, jsdom 27 require it; Spec 1 §4 said 22.11+). Root `package.json` engines and CI use it; lanes on this machine use a user-space Node 22.23.3 under `~/.local`, nothing global changed | Orchestrator 2026-10-12 |
| D12 | Palette: `line-strong` #C9CDD2 measures 1.60:1 on surface, below §8.1's 3:1 rule for borders; decided #868C94 (3.39:1), the spec's own rule wins over the drawn value; Figma token updated in Task 14 | Orchestrator 2026-10-12 under D13 |
| D13 | The owner delegated every decision to the orchestrator ("Decide everything by yourself", 2026-10-12): the orchestrator decides what the specs leave open and records it here; managers no longer wait for the owner's go before launching workers once the orchestrator has seen the change; the owner can override any row | Agreed (owner, 2026-10-12) |
| D14 | CI's `sqlc diff` step is replaced by `make gen postman` leaving `git status` clean (covers sqlc output, generated API types and the Postman collection); sqlc is installed only while `services/core/sqlc.yaml` exists. Spec 1 §6 and CLAUDE.md wording updated in Task 15 | Orchestrator 2026-10-12 |
| D15 | End-to-end runs use `shopperstop_core_e2e` (plan, `initdb.sql`, Spec 2 §13), not `_test` as Spec 1 §6 says: core on :18080, web preview 15173, admin preview 15174, e2e-only pepper, set by `make e2e`; each app's Playwright config starts core and `vite preview`; Chromium only. core adds a Phase 1 `seed-demo --reset` stub so `make dev` reaches the three servers | Orchestrator 2026-10-12 |

## Method
- Areas: `platform`, `core`, `ui`, `web`, `admin` (later `rider`, `payment`, `receipt`). Scopes in `.claude/areas/<area>.md`; an area's lanes never edit outside it; cross-area needs go through the area plan's `## Requests` and the orchestrator.
- One task of the plan is one lane, `LANE-ID = <area>-P<phase>-L<n>`; the lane's directory scope is the task's **Files** list.
- Contracts between areas are files: `services/core/openapi.json`, `packages/ui/src/tokens.css` and `@shopperstop/ui` exports, `openspec/specs/`.
- Gates per PR: `make test`, `make e2e` where the task touches an app, `openspec validate --all --strict`, `make postman` clean. One `make e2e` runs at a time across all managers.
- Root `package-lock.json` changes from workspace installs are expected in ui, web and admin PRs (npm workspaces).
- `psql` is not installed on the owner's machine; ad-hoc checks use a Go pgx client.
- Each manager verifies its own landings (suites, then real database / HTTP / browser) before the PR; the orchestrator verifies integration at phase close.
- Only the orchestrator touches the root checkout and PLAN.md.

## Areas
| Area | Scope | Depends on | Manager status |
|------|-------|------------|----------------|
| platform | root files, `deploy/`, `.github/`, `openspec/`, `docs/`, `Makefile`, `README.md`, `CLAUDE.md` | none | running (orchestrator session, D9) |
| core | `services/core/` | platform (`deploy/initdb.sql`, `make db`) | running (session shopperstop-ed); core-P1-L1 team lead on change core-service-foundation (tasks 5-8); unblocked by #4 |
| ui | `packages/ui/` | platform (`package.json` workspaces) | running (session shopperstop-5c); ui-P1-L1 team lead on change ui-packages-ui |
| web | `apps/web/` | ui (`@shopperstop/ui`), core (`openapi.json`) | no manager yet; start `/manage web` when packages/ui lands |
| admin | `apps/admin/` | ui (`@shopperstop/ui`), core (`openapi.json`) | running (session shopperstop-75); waits on ui task 9 and core task 8 |

## Phase 1 - Foundation and design system
| Area | Plan tasks | Status |
|------|-----------|--------|
| platform | 1 repo root, 2 orchestration files, 3 OpenSpec, 4 deploy and `make db`, 12 Postman, 13 CI and Makefile, 15 README, CLAUDE.md, docs/figma.md | 1, 2 done (orchestrator); 3 done #3 (platform-P1-L3, archived #5); 4 done #4 (platform-P1-L4, archived #6, `make db` verified); 13 running (platform-P1-L9); 12 waits on core task 8; 15 waits on 13 and 14 |
| core | 5 config, 6 httpx, 7 migrations, 8 server, app, contract test | waits on platform task 4 |
| ui | 9 packages/ui | waits on platform task 1 |
| web | 10 apps/web | waits on ui task 9 |
| admin | 11 apps/admin | waits on ui task 9 |
| orchestrator | 14 Figma (Figma tools live in the main session) | |

## Backlog
-

## Journal
- 2026-10-12: specs 1 and 2 approved by the owner; plan 1 written.
- 2026-10-12: orchestration files written in the main session; owner changed the organisation to areas with Fable managers (D5).
- 2026-10-12: PRD written and approved (D7); guardrail hooks added (D8). Phase 1 may start.
- 2026-10-12: OpenSpec initialised (`openspec/`, `/opsx:*` commands and skills); owner made it the only spec tool (D6). Plan Task 3 shrinks to seeding `openspec/specs/platform` and `design-system`.
- 2026-10-12: repo `kapildev333/shopperstop` created private, Task 1 pushed as origin/main. Docker Desktop started by the orchestrator. The core and ui manager sessions ended before starting any lane; both restart once their dependencies are on main. Orchestrator and platform manager share one session (D9).
- 2026-10-12: platform tasks 3 and 4 landed (#3, #4) and archived (#5, #6); `make db` verified against the real container. core, ui and admin managers running; CI and Makefile lane (platform-P1-L9) started so every later PR gets a `ci` check.
- 2026-10-12: ui raised typescript-eslint (D10), the Node 22.12 floor (D11) and the line-strong contrast (D12, pending owner). CI and Makefile (platform-P1-L9) told to build packages/ui before app gates and to use Node >= 22.12.
- 2026-10-12: owner delegated decisions (D13); D12 decided for #868C94.
- 2026-10-12: platform-P1-L9 (CI and Makefile) change seen and workers launched under D13; D14, D15 recorded; root build script chore (#13).
