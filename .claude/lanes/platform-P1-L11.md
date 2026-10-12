# platform-P1-L11 - README.md and CLAUDE.md (OpenSpec change platform-readme-claude)
Status: done (t1 README eb4080e, t2 CLAUDE.md a3b364a, review fixes committed on lane branch; base c5dd7fa)
## Doing
Review fixes (tasks 4.1 to 4.4) done: admin under /admin/, Postman present, prod-local wording. Waiting for acceptance (/opsx:verify) by the team lead.
## Found
- Worktree was created on origin/main 6ae9c6b (one commit past the brief's 0daca74: core area plan chore #26); nothing in it touches README.md or CLAUDE.md.
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
- Base: the brief said the lane branch is rebased on origin/main 8863c3c. It is not: the branch sits on c5dd7fa. 8863c3c adds only the platform-postman openspec archive and `openspec/specs/platform/spec.md`, outside this lane's scope and no overlap with its files. Not rebased, so the commit hashes above stay valid; the area manager can rebase at landing.
- Screenshot table cells still read `pending` (apps not on main); the grep for `pending` therefore also lists them, as intended.

## Requests
- to platform manager (backlog, Makefile owner): `make dev` runs `npm ci` when `node_modules` is absent, so the quick start is one command; README drops its `npm ci` line then.
- to orchestrator: D14 says "Spec 1 §6 ... wording updated in Task 15", but Spec 1 is frozen (D6) and outside this lane's scope; recommend D14 plus the platform-ci-makefile requirements (living spec once archived) stand as the record, or an "Amended" note like the plan's, by the orchestrator.
## Blockers
