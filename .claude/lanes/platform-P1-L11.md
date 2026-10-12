# platform-P1-L11 - README.md and CLAUDE.md (OpenSpec change platform-readme-claude)
Status: t1 README written (committed on lane branch), t2 CLAUDE.md next
## Doing
Change platform-readme-claude written and valid; waiting for the platform manager to launch workers t1 (README) then t2 (CLAUDE.md) on this branch. Acceptance (/opsx:verify) after both land.
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

## Requests
- to platform manager (backlog, Makefile owner): `make dev` runs `npm ci` when `node_modules` is absent, so the quick start is one command; README drops its `npm ci` line then.
- to orchestrator: D14 says "Spec 1 §6 ... wording updated in Task 15", but Spec 1 is frozen (D6) and outside this lane's scope; recommend D14 plus the platform-ci-makefile requirements (living spec once archived) stand as the record, or an "Amended" note like the plan's, by the orchestrator.
## Blockers
