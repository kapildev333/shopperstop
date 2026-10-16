# platform-P5-L1-T3 - CI payment job, docs and area lists (worker brief)
Status: not started (after T1)
## Brief
- LANE-ID: platform-P5-L1-T3 (team lead platform-P5-L1). Area: platform.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/platform-P5-L1. Branch: lane/platform-P5-L1-payment-wiring. Commit there as kapildev333 <47056817+kapildev333@users.noreply.github.com>, no attribution trailers; never push.
- Change and task: OpenSpec `platform-payment-wiring`, task 3 (`openspec/changes/platform-payment-wiring/tasks.md`). Read its `design.md` Decision 10 and "The files" sections `.github/workflows/ci.yml` and "README.md, CLAUDE.md, .claude/commands/*.md, openspec/config.yaml (find and replace)". The texts there are the design; apply them, do not reword.
- Scope: `.github/workflows/ci.yml`, `README.md`, `CLAUDE.md`, `.claude/commands/orchestrate.md`, `.claude/commands/manage.md`, `openspec/config.yaml`, ticking 3.x in `tasks.md`, this file. Nothing else.
- Scenarios (spec delta `specs/platform/spec.md`): "Workflow shape with the rider job", "Workflow shape with the payment job", "Payment tests reach the CI database", every scenario of "Repository documentation matches the tree" and "CLAUDE.md and docs/figma.md describe the tree", "Area lists".
- Failing test to start from: `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh ci docs` from the worktree root, failing on the tree after T1.
- Commit: one `feat: payment ci job, docs and area lists` with the six files, `tasks.md` (3.x ticked) and this file. The check script is the test, so there is no `test:` commit; paste the red output here first.
- Gates (paste results here): `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh` (all sections) prints `payment wiring check: ok`; `openspec validate --all --strict`.
- Tools: README and CLAUDE.md contain text the guard hook denies in Bash (the compose command, `docker exec`). Use the Edit tool for every replacement, one find string at a time (each occurs exactly once), and stage with `git add -A`. Never run `make db`, `make dev`, `make seed`, `make prod-local`, `make rider`, `make e2e`.
- Stop and write here, without guessing, if: a find string does not occur exactly once (the file changed on main since the design); the docs section fails on an archived check (`check-docs.sh`, `check-readme-mobile.sh`, `check-tooling.sh docs`); anything needs a file outside scope.
## Doing
## Found
## Requests
## Blockers
