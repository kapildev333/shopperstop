# platform-P5-L1 - platform-payment-wiring (team lead)
Status: started (change proposed; workers not started)
## Doing
Change proposed and committed; waiting for the manager to launch T1, then T2 and T3. Acceptance (`/opsx:verify`) after 3.4.
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
