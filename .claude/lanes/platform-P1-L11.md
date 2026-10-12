# platform-P1-L11 - README.md and CLAUDE.md (OpenSpec change platform-readme-claude)
Status: done (README 1681463, CLAUDE.md cb0aaf4, review fixes 98a8169; base origin/main 6425f67; acceptance passed)
## Doing

## Found
- The red step for both tasks is `sh openspec/changes/platform-readme-claude/check-docs.sh` (37 failures on the unchanged tree); it ends `docs check: ok` when both tasks are done.
- `make dev` does not run `npm ci`; the README quick start says `npm ci` once first (design.md Decision 2).
- t1 red (README.md absent, before writing it), `sh openspec/changes/platform-readme-claude/check-docs.sh`, README lines verbatim:
  ```
  FAIL: README.md missing
  FAIL: README.md lacks: ## Quick start
  FAIL: README.md lacks: make dev
  FAIL: README.md lacks: Docker
  FAIL: README.md lacks: Go 1.27
  FAIL: README.md lacks: 22.12
  FAIL: README.md lacks: :8080
  FAIL: README.md lacks: :5173
  FAIL: README.md lacks: :5174
  FAIL: README.md lacks: <details>
  FAIL: README.md lacks: ## Screenshots
  FAIL: README.md lacks: seed-demo --reset
  FAIL: README.md lacks: admin@shopperstop.local
  FAIL: README.md lacks: admin12345
  FAIL: README.md lacks: koramangala@shopperstop.local
  FAIL: README.md lacks: indiranagar@shopperstop.local
  FAIL: README.md lacks: staff12345
  FAIL: README.md lacks: demo@shopperstop.local
  FAIL: README.md lacks: demo12345
  FAIL: README.md has no table
  ```
  Total then 37 failures: these 20 README lines plus 17 CLAUDE.md lines (left for t2).
- t1 tree check before writing: `ls apps scripts docs/postman` reports all three "No such file or directory"; README says those are pending.
- t1 green: after writing README.md, `check-docs.sh` prints 17 failures, none for README.md, none for `make -n` or a broken link. The 17 are all CLAUDE.md (t2). `make -n` exits 0 for db, dev, test, test-core, test-web, e2e, gen, postman, prod-local.
- t1 `openspec validate --all --strict`: 4 passed, 0 failed (spec/design-system, spec/platform, change/platform-ci-makefile, change/platform-readme-claude).
- Local tooling note: `node --version` on this machine is v22.11.0, below the 22.12 the README and D11 require. Not changed here; the README states 22.12.
- README decisions taken as written in design.md: the demo table and Phase 2 note; web and admin ports described as planned (their apps are not on main); `FILES_DIR` in the fold is `$PWD/services/core/data/files` (the Makefile's `$(CURDIR)` expanded from the repo root).

- t2 red (before editing CLAUDE.md), `sh openspec/changes/platform-readme-claude/check-docs.sh`, CLAUDE.md lines verbatim:
  ```
  FAIL: CLAUDE.md lacks: `make dev
  FAIL: CLAUDE.md lacks: `make test
  FAIL: CLAUDE.md lacks: `make test-core
  FAIL: CLAUDE.md lacks: `make test-web
  FAIL: CLAUDE.md lacks: `make gen
  FAIL: CLAUDE.md lacks: `make prod-local
  FAIL: CLAUDE.md lacks: make gen postman
  FAIL: CLAUDE.md lacks: shopperstop_core_e2e
  FAIL: CLAUDE.md lacks: 18080
  FAIL: CLAUDE.md lacks: 15173
  FAIL: CLAUDE.md lacks: 15174
  FAIL: CLAUDE.md lacks: 22.12
  FAIL: CLAUDE.md lacks: Tokens & Components
  FAIL: CLAUDE.md lacks: Customer web
  FAIL: CLAUDE.md lacks: Admin web
  FAIL: CLAUDE.md still contains: sqlc diff
  FAIL: CLAUDE.md still contains: No product code yet
  docs check: 17 failures
  ```
- t2 edits: opening paragraph (1), new `## Commands` section with prerequisites, the target table, skip behaviour, single tests and agent rules (2), layout lines (3), stack line with Node 22.12 and D10 and D3 (4), `/orchestrate` D9 and OpenSpec D13 wording (5), `ci.yml` line with D14 and D15 (6), API docs D16 and `make gen` (7), Figma three-page sentence (8). D19 added to the contracts bullet as the brief asked. D18 (TypeScript and openapi-typescript pins) not added: the design's edit list does not name it.
- t2 green: `sh openspec/changes/platform-readme-claude/check-docs.sh` ends `docs check: ok`, exit 0.
- t2 `openspec validate --all --strict`: 4 passed, 0 failed (spec/design-system, spec/platform, change/platform-ci-makefile, change/platform-readme-claude).
- Review fixes (tasks 4.x): admin URLs carry `/admin/` (README quick start, demo table, e2e row; CLAUDE.md e2e and ci rows; spec scenario "README has the quick start" and the check in `check-docs.sh` now match `localhost:5174/admin/`). README says `docs/postman/` is present and `make postman` also runs `scripts/postman.test.mjs`; CLAUDE.md `make postman` row says so too. README `make prod-local` row drops "(macOS)".
- Screenshot table cells still read `pending` (apps not on main); the grep for `pending` therefore also lists them, as intended.

- Acceptance (team lead, /opsx:verify platform-readme-claude) on 98a8169, base 6425f67: PASS.
  - `sh openspec/changes/platform-readme-claude/check-docs.sh` -> `docs check: ok`, exit 0.
  - `openspec validate --all --strict` -> 4 passed, 0 failed (spec/design-system, spec/platform, change/platform-ci-makefile, change/platform-readme-claude).
  - `make -n` exits 0 for db, dev, test, test-core, test-web, e2e, gen, postman, prod-local (every `make` target either file names).
  - Six scenarios: quick start, step-by-step fold and screenshots table, demo sign-ins, make targets, CI/e2e/Figma rules, relative links: each covered by check-docs.sh and read by hand.
  - Tasks 1.x, 2.x, 4.x ticked. 3.1 left unticked in tasks.md: the brief limited this pass to the lane log; the manager ticks it (or tells the team lead to) before archive.
  - Nothing extra: `git diff --stat 6425f67..HEAD` touches only README.md, CLAUDE.md, openspec/changes/platform-readme-claude/ and this log.
  - Tree claims hold: `ls` shows no `apps/`; `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/` (collection, environment), `services/core` (cmd, internal, migrations, openapi.json), `packages/ui` present. README env exports equal the Makefile defaults; `make -n postman` runs `node --test scripts/postman.test.mjs` as both files say.
  - CLAUDE.md carries D3, D9, D10, D11, D13, D14, D15, D16, D17, D19. D12 (line-strong hex) and D18 (TypeScript and openapi-typescript pins) are not in it: CLAUDE.md states no token hex or TypeScript version, so neither changes a rule it states (design.md Context lists only the decisions that do).
  - No personal data: emails are the `.local` demo accounts, the DB URL user and the existing noreply commit identity.
  - Process note: workers logged t1/t2 here instead of `.claude/lanes/platform-P1-L11-t1.md`/`-t2.md` as tasks.md named; red-step evidence is complete above, no effect on acceptance.

## Requests
- to platform manager (backlog, Makefile owner): `make dev` runs `npm ci` when `node_modules` is absent, so the quick start is one command; README drops its `npm ci` line then.
- to orchestrator: D14 says "Spec 1 §6 ... wording updated in Task 15", but Spec 1 is frozen (D6) and outside this lane's scope; recommend D14 plus the platform-ci-makefile requirements (living spec once archived) stand as the record, or an "Amended" note like the plan's, by the orchestrator. Answered: Spec 1 stays frozen; PLAN.md D14 plus the archived `platform-ci-makefile` requirements are the record.
## Blockers
