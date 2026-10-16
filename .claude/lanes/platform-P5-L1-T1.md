# platform-P5-L1-T1 - payment databases, Caddy route and Makefile targets (worker brief)
Status: not started
## Brief
- LANE-ID: platform-P5-L1-T1 (team lead platform-P5-L1). Area: platform.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/platform-P5-L1. Branch: lane/platform-P5-L1-payment-wiring. Commit there as kapildev333 <47056817+kapildev333@users.noreply.github.com>, no attribution trailers; never push.
- Change and task: OpenSpec `platform-payment-wiring`, task 1 (`openspec/changes/platform-payment-wiring/tasks.md`). Read its `design.md` "Facts", "Decisions" 1 to 4, 8, 9 and "The files" sections `deploy/initdb.sql`, `deploy/Caddyfile`, `Makefile`. The file texts there are the design; copy them, do not redesign.
- Scope: `deploy/initdb.sql`, `deploy/Caddyfile`, `Makefile`, ticking 1.x in `tasks.md`, this file. Not `deploy/docker-compose.yml`. Nothing else.
- Scenarios (spec delta `specs/platform/spec.md`): as listed under task 1 in `tasks.md`.
- Failing test to start from: `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh deploy make` from the worktree root; on the unchanged tree it ends `payment wiring check: 37 failures` or close to it (the `ci` section is task 3's).
- Commit: one `feat: payment databases, caddy route and make targets` with the three files, `tasks.md` (1.x ticked) and this file. The check script is the test (committed by the team lead), so there is no `test:` commit; paste the red output here first.
- Gates (paste results here): tasks 1.3 to 1.6. `make test-core`, `make test-rider`; `sh openspec/changes/archive/2026-10-16-platform-postman-tooling/check-tooling.sh make` (needs `node_modules` and `sqlc`; `npm ci` first if absent); `openspec validate --all --strict`.
- Never run: `make db`, `make dev`, `make seed`, `make prod-local`, `make rider`, `make e2e`, or the archived `platform-rider-wiring/check-wiring.sh` (it starts the rider server). The Makefile contains the compose command: write it with the Write tool, and stage with `git add -A`; the guard hook denies Bash text containing that command.
- Database (1.4): the payment role may not exist yet on `shopperstop-postgres-1` (D33, the orchestrator applies it). Run the pgx checks; if they fail, paste the error and move on. Never create the role or start, stop or touch containers.
- Stop and write here, without guessing, if: the check script fails on a line design.md's Makefile does produce; `make test-core` or `make test-rider` fails; anything needs a file outside scope.
## Doing
## Found
## Requests
## Blockers
