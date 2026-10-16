# platform-P5-L1-T1 - payment databases, Caddy route and Makefile targets (worker brief)
Status: done, committed on lane/platform-P5-L1-payment-wiring (feat: payment databases, caddy route and make targets)
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
- Done, in order: red check, three files per design.md, green check, pgx checks, gates (1.5), tasks 1.1 to 1.6 ticked, this log, one feat commit.
- Red (unchanged tree, `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh deploy make`): last line `payment wiring check: 36 failures`. First five FAIL lines:
  - `FAIL: deploy/initdb.sql is not the twelve statements`
  - `FAIL: Caddyfile: 'handle /api/payment/* {' missing or out of order`
  - `FAIL: make payment: exit 2, output: make: *** No rule to make target \`payment'.  Stop.`
  - `FAIL: make test-payment: exit 2, output: make: *** No rule to make target \`test-payment'.  Stop.`
  - `FAIL: make -n seed lacks: else echo "seed: services/payment absent, skipping"; fi`
- Green (after the three files): `payment wiring check: ok`, exit 0. The `db` target is byte-identical (no compose line changed in `git diff origin/main -- Makefile`); `deploy/docker-compose.yml` untouched; `make -n dev` and `make -n prod-local` run `$(MAKE) db` only as a dry run, never the compose command.
- Database (1.4), throwaway pgx program in the scratchpad, run from `services/core`:
  - `select 1` as `shopperstop_payment` on `shopperstop_payment_test`: `1`, exit 0. The role is already present on `shopperstop-postgres-1`, so D33 has been applied; nothing was created by this lane.
  - `select datname ... where pg_get_userbyid(datdba) = 'shopperstop_payment'` as `shopperstop_core` on `shopperstop_core_test`: `shopperstop_payment`, `shopperstop_payment_e2e`, `shopperstop_payment_test`, exit 0.
- Gates (1.5):
  - `make test-core`: exit 0, no FAIL lines. Log in the scratchpad.
  - `make test-rider`: exit 0, no FAIL lines.
  - `make -n e2e`, `make -n dev`: exit 0, every core, rider, payment, web and admin command printed; e2e prints `e2e: services/payment absent, skipping`; `make -n e2e` with `SHOPPERSTOP_PAYMENT_GATEWAY=leak` has no `leak` in its output.
  - `make -n test`, `make -n seed`, `make -n prod-local`, `make -n payment`, `make -n test-payment`, `make -n gen`: exit 0.
  - `npm ci` (no `node_modules` in the worktree) exit 0. Then `make gen` (real run) exit 0: prints `gen: services/payment/sqlc.yaml absent, skipping`, regenerates `packages/ui/src/api/core.d.ts` and `rider.d.ts` with no diff. `git status --short` after it: only the three files.
  - `sh openspec/changes/archive/2026-10-16-platform-postman-tooling/check-tooling.sh make`: `tooling check: ok`, exit 0.
  - `openspec validate --all --strict`: `Totals: 20 passed, 0 failed (20 items)`, exit 0.
- Hard rules kept: no `make db`, `make dev` (real), `make prod-local`, `make payment`, `make rider`, `make core`, `make e2e`, no docker, no archived `check-wiring.sh` or `check-mobile-wiring.sh`. Every `make` run was a test target or `make -n`, or `make gen`, which the brief asks for.
## Found
- `tasks.md` 1.x ticked; sections 2 and 3 untouched. 1.6 status before the commit: `M Makefile`, `M deploy/Caddyfile`, `M deploy/initdb.sql`, plus `tasks.md` and this log.
- The check script's `make -n dev` in its scratch copy runs `$(MAKE) db` only as a dry run (sub-make inherits `-n`), so no container is touched.
- No design choice was left open; the three file texts are copied from design.md.
## Requests
- none
## Blockers
- none
