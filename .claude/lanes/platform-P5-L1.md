# platform-P5-L1 - platform-payment-wiring (team lead)
Status: done (the orchestrator session finished the lane: acceptance passed 2026-10-16; 4.1 and 4.3 are the manager's gate, 4.4 open until phase close by design)
## Doing
Acceptance done (acting team lead in the orchestrator session). Nothing left for the team lead.
## Found
- Change: `openspec/changes/platform-payment-wiring/` (proposal, design, tasks, delta `specs/platform/spec.md`, `check-payment-wiring.sh`). `openspec validate platform-payment-wiring --strict` valid; `openspec validate --all --strict` Totals 20 passed, 0 failed.
- Delta: 14 MODIFIED, 8 ADDED requirements in `platform`; bodies 222 to 482 characters. Scenario names of MODIFIED blocks are kept (validate refuses dropping one), so "Dry run shows five servers" now describes six.
- Prototyped in a scratch copy: `check-payment-wiring.sh` ok on the design files, 37 failures on origin/main (`deploy make ci`); `node --test scripts/postman.test.mjs` 27/0 with the design, 21/6 without; core and rider collections byte-identical.
- The running `shopperstop-postgres-1` has no `shopperstop_payment` role yet (pgx: password authentication failed; `pg_database` lists core and rider only). D33 needs the orchestrator.
- Hazard: the archived `platform-rider-wiring/check-wiring.sh` runs a real `make rider`, which now starts the rider server (services/rider exists). The team lead hit it once on 2026-10-16 and killed the processes it started. Nobody should run that script again; `check-payment-wiring.sh` only runs real targets while `services/payment` is absent.
- `make gen` needs no change for `payment.d.ts`: it already runs `gen:api`, which ui-P5-L1 extends.
- The archived `platform-mobile-wiring/check-mobile-wiring.sh` already fails on main (1 failure, superseded); not used as a gate.
## Requests
- to orchestrator: apply the four payment statements of `deploy/initdb.sql` to `shopperstop-postgres-1` as `postgres` (D33) before payment-P5-L1 runs its tests; task 4.2 re-checks.
- to core (core-P5-L1): extend the living scenario "The Makefile tokens are accepted" and `config_test.go` to the two-entry values `rider:dev-rider-service-token-dev-rider-00,payment:dev-payment-service-token-dev-pay-00` and `rider:e2e-rider-service-token-e2e-rider-00,payment:e2e-payment-service-token-e2e-pay-00`; admit the `payment` subject to its routes.
- to payment (payment-P5-L1): read the env names this Makefile passes (`SHOPPERSTOP_PAYMENT_DATABASE_URL`, `_ADDR`, `_SESSION_PEPPER`, `_WEB_ORIGINS`, `_CORE_URL`, `_CORE_SERVICE_TOKEN`, `_GATEWAY`, `_PUBLIC_URL`, `_TEST_DATABASE_URL`); `seed-demo --reset` must not call core; tie `paymentId` `00000000-0000-4000-8000-000000000a01` to the seed by a test; commit `docs/postman/shopperstop-payment.postman_collection.json` with the first `openapi.json` (`make postman`).
- to ui (ui-P5-L1): `gen:api` generates `packages/ui/src/api/payment.d.ts` from `services/payment/openapi.json`, skipping with a line while it is absent, as it does for rider.
- to web, mobile, admin (Phase 5 e2e lanes): Playwright configs that need payment start `go run ./cmd/payment` in `services/payment` on :18082 with the env `make e2e` passes.
## Blockers
None.
## T1 review
Verdict: approve (commit f90534f). No findings that need a change.
- Re-ran: check-payment-wiring.sh deploy make -> `payment wiring check: ok`; `make -n dev|e2e|payment|test-payment|seed|prod-local` exit 0 with the expected output; `openspec validate --all --strict` 20 passed, 0 failed.
- Wiring: six servers in `-j6`; seed, payment, test-payment, e2e, gen, prod-local each skip with one line while services/payment is absent; core tokens carry rider and payment in dev and e2e; e2e payment on :18082, `shopperstop_payment_e2e`, gateway fake, PUBLIC_URL :18082; PAYMENT_ENV and E2E_ENV are separate, no dev value in e2e. Caddy `/api/payment/*` to host.docker.internal:8082 sits before `/admin/*` and the catch-all. initdb adds the four statements. The deploy compose file and the `db` target are untouched.
- Side fix, in scope and correct: prod-local's rider migrate now runs in a subshell, so the payment migrate does not run from services/rider.
- Scope: only the three files, tasks.md 1.x ticks and the T1 log. Commit identity correct, no trailers.
- Test-first: the check script was committed with the proposal (83fb0a7) and is the test; red (36 failures) is recorded in the T1 log before the feat. Acceptable per the brief.
- Nit (no action): the "five servers" scenario name is kept by validate rules, now describes six.
## T2 review
Verdict: approve (commits 490b4c7 test, 6762af2 feat). No findings.
- Re-ran: `node --test scripts/postman.test.mjs` 27 pass, 0 fail; `make postman` twice prints `postman: services/payment/openapi.json absent, skipping`, `git status --porcelain` empty; core and rider collections byte-identical to 5eeae78 (only the environment file changed under docs/postman); no payment collection; `openspec validate --all --strict` 20 passed, 0 failed.
- postman.mjs: two lines (`payments: 'paymentId'`, `payment: { baseUrl: 'paymentBaseUrl', ownToken: 'customerToken' }`), nothing else.
- Environment: fourteen variables, `paymentBaseUrl` http://localhost:8082/api/payment/v1 and `paymentId` 00000000-0000-4000-8000-000000000a01 (type default) before `serviceToken`.
- Scenarios: each spec-delta scenario (URLs, skip line, committed-collection guard, routes, ids, environment variables, payment id fixed) has a test; the guard test passes before and after by design.
- Test-first: 490b4c7 touches only the test file (21 pass / 6 fail per log, names match task 2.1); 6762af2 adds the code, env, tasks 2.1 to 2.3 ticked and the T2 log. Scope clean; no needless complexity.
- Not re-run: make test-core and make test-rider (worker reports exit 0; the change cannot affect them beyond the environment file).
## T3 review
Verdict: approve (commit ddf619c), with three optional nits. No blocking findings.
- Re-ran: `check-payment-wiring.sh` (all sections) `payment wiring check: ok`; archived `check-docs.sh`, `check-readme-mobile.sh`, `check-tooling.sh` each ok; ci.yml parses as YAML; `openspec validate --all --strict` 20 passed, 0 failed.
- CI `payment` job mirrors `rider` line for line (postgres:16 service, initdb.sql via psql, `hashFiles('services/payment/go.mod')` guard on every step after checkout, setup-go from payment go.mod/go.sum, `make test-payment`); env name and URL match the Makefile's `SHOPPERSTOP_PAYMENT_TEST_DATABASE_URL`. The e2e job needs no change: it already loads all of initdb.sql (so `shopperstop_payment_e2e` exists), and `make e2e` seeds payment with `E2E_ENV` on :18082 with the fake gateway.
- Docs vs tree: ports 8082/18082, targets (`payment`, `test-payment`, `-j6` dev, seed), env names, databases, skip behaviour and the Caddy route all match the Makefile, Caddyfile and initdb.sql; `customerToken`, `paymentBaseUrl`, `paymentId` exist in the Postman environment. The `grep shopperstop_payment deploy/initdb.sql` one-liner selects exactly the four statements.
- config.yaml: the list reads correctly ("..., rider-app, mobile-app from Phase 4, and payment-service and payment-gateway-razorpay from Phase 5."); only the Oxford comma changed. Capabilities match PLAN.md Phase 5.
- Scope: only the six listed files plus tasks.md ticks and the T3 log. No needless complexity.
- Nit 1 (CLAUDE.md:36, "Agents:" paragraph): add the new gate. Edit: "Lanes run `make test-core`, `make test-rider`, `make test-web`" -> "Lanes run `make test-core`, `make test-rider`, `make test-payment`, `make test-web`".
- Nit 2 (CLAUDE.md layout): `services/payment/` sits after `services/<name>/ every later service`, so the catch-all precedes the specific line. Move the `services/payment/` line to directly after the `services/rider/` line, before `services/<name>/`.
- Nit 3 (README.md:122): "the ones the rider service calls" is no longer the whole set once payment calls core with its own token. Edit: "(the ones the rider and payment services call)".
- Test-first: the check script is the test (design Decision 11); the red run is in the T3 log; single `feat:` commit as the brief says.
## Acceptance (/opsx:verify)
Verdict: pass. Acting team lead, orchestrator session, 2026-10-16, on 5d8da35 (cfdb599 merged with origin/main).
- Tasks: 1.1 to 3.4 ticked and landed: 83fb0a7 (proposal and check script), f90534f (T1 feat), 490b4c7 then 6762af2 (T2 test, feat), ddf619c (T3 feat), review logs 5eeae78, 61aa1c5, cfdb599.
- Scope: `git diff origin/main --stat` touches only platform files (deploy/, Makefile, scripts/, docs/postman/ environment, .github/workflows/ci.yml, README.md, CLAUDE.md, openspec/, .claude/commands/*.md, this lane's logs); nothing under services/, packages/ or apps/. No payment collection committed (no contract yet), as designed.
- Re-ran: `check-payment-wiring.sh` (deploy make ci docs) `payment wiring check: ok`; `node --test scripts/postman.test.mjs` 27 pass, 0 fail; `openspec validate platform-payment-wiring --strict` valid; `openspec validate --all --strict` 20 passed, 0 failed.
- Scenario coverage: Makefile, Caddy, initdb, CI shape, docs and area-list scenarios by `check-payment-wiring.sh` (real skip runs plus `make -n` and a scratch Makefile copy with every directory present, including the unformatted-Go gate); Postman and environment scenarios by `scripts/postman.test.mjs`; the pgx scenarios by the check below; "make gen leaves the tree clean" by 4.1 (manager); "Payment tests reach the CI database" only by CI once billing is fixed (4.4); "Relative links resolve" by the archived check-docs.sh (T3 review ok).
- Task 4.2 evidence (pgx, read-only, from services/core): `select 1` as shopperstop_payment on shopperstop_payment_test prints `1`; owner query as shopperstop_core prints exactly `shopperstop_payment`, `shopperstop_payment_e2e`, `shopperstop_payment_test`. D33 is applied on shopperstop-postgres-1; 4.2 ticked.
- Not applied (non-blocking, T3 nits): CLAUDE.md "Lanes run" list lacks `make test-payment`; CLAUDE.md layout puts `services/payment/` after `services/<name>/`; README "the ones the rider service calls". A later platform chore can take them.
