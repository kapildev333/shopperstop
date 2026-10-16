# platform-P5-L1-T3 - CI payment job, docs and area lists (worker brief)
Status: done, committed on lane/platform-P5-L1-payment-wiring (feat: payment ci job, docs and area lists)
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
- Done, in order: red check, ci.yml payment job, 31 find-and-replace edits (README 11, CLAUDE.md 16, orchestrate.md 1, manage.md 1, config.yaml 2, one Edit per find string, each found exactly once), green checks, gates, tasks 3.1 to 3.4 ticked, this log, one feat commit.
- Red (unchanged tree after T1, `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh ci docs`): last line `payment wiring check: 28 failures`. FAIL lines:
  - `FAIL: ci.yml: payment job shape`
  - `FAIL: README.md lacks: :8082`
  - `FAIL: README.md lacks: SHOPPERSTOP_PAYMENT_GATEWAY=fake`
  - `FAIL: README.md lacks: Cloned before Phase 5?`
  - `FAIL: README.md lacks: grep shopperstop_payment deploy/initdb.sql | docker exec -i shopperstop-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres`
  - `FAIL: README.md lacks: \`make test-payment\``, `README.md lacks: \`make payment\``, `README.md lacks: shopperstop_payment_e2e`, `README.md lacks: packages/ui/src/api/payment.d.ts`, `README.md lacks: paymentBaseUrl`, `README.md lacks: paymentId`, `README.md lacks: \`payment\` from Phase 5`
  - `FAIL: CLAUDE.md lacks: ...` for `make test-payment`, `make payment`, `shopperstop_payment_e2e`, `18082`, `shopperstop-payment.postman_collection.json`, `packages/ui/src/api/payment.d.ts`, `paymentBaseUrl`, `Phase 5`; `CLAUDE.md layout has no line starting services/payment/`
  - `FAIL:` orchestrate.md, manage.md, config.yaml lines (`payment-service`, `payment-gateway-razorpay`, `payment (services/payment/)`)
- Green: `sh .../check-payment-wiring.sh ci docs` prints `payment wiring check: ok`; the full `sh .../check-payment-wiring.sh` (all sections) prints `payment wiring check: ok`, exit 0.
- Gates:
  - `sh openspec/changes/archive/2026-10-12-platform-readme-claude/check-docs.sh`: `docs check: ok`, exit 0.
  - `sh openspec/changes/archive/2026-10-16-platform-mobile-readme-spec/check-readme-mobile.sh`: `readme mobile check: ok`, exit 0.
  - `sh openspec/changes/archive/2026-10-16-platform-postman-tooling/check-tooling.sh` (all sections) and with `docs`: `tooling check: ok`, exit 0 both.
  - Relative Markdown links in README.md: every target resolves (`apps/mobile/README.md`, `docs/figma.md`, `openspec/`, `openspec/specs/`, `packages/ui/src/tokens.css`, `PLAN.md`, `services/core/openapi.json`, `services/rider/openapi.json`). CLAUDE.md has no Markdown links.
  - `ci.yml` parses (Ruby YAML): jobs `core, rider, payment, web, e2e, spec`.
  - `openspec validate --all --strict`: `Totals: 20 passed, 0 failed (20 items)`, exit 0.
- The archived `check-wiring.sh` and `check-mobile-wiring.sh` were not run. No make target, container or compose command was run.
- The CLAUDE.md diff was reviewed against design.md; it is the find-and-replace text only.
## Found
- `make test-payment`, `make payment`, `services/payment/` and the payment CI job reference targets and paths that land with tasks 1 and later Phase 5 lanes; the CI job skips while `services/payment` is absent.
- The CLAUDE.md `make gen` row names `payment.d.ts` before ui-P5-L1 generates it (design Risks; intended).
## Requests
- none
## Blockers
- none
