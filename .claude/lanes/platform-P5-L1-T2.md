# platform-P5-L1-T2 - Postman collection and environment for payment (worker brief)
Status: done (2026-10-16): test commit 490b4c7 (red 21 pass / 6 fail, names below); feat commit follows with the green gates
## Brief
- LANE-ID: platform-P5-L1-T2 (team lead platform-P5-L1). Area: platform.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/platform-P5-L1. Branch: lane/platform-P5-L1-payment-wiring. Commit there as kapildev333 <47056817+kapildev333@users.noreply.github.com>, no attribution trailers; never push.
- Change and task: OpenSpec `platform-payment-wiring`, task 2 (`openspec/changes/platform-payment-wiring/tasks.md`). Read its `design.md` Decisions 6 and 7 and "The files" sections `scripts/postman.mjs`, `docs/postman/local.postman_environment.json`, `scripts/postman.test.mjs`. The code there is the design; copy it, do not redesign.
- Scope: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/local.postman_environment.json`, ticking 2.x in `tasks.md`, this file. No `docs/postman/shopperstop-payment.postman_collection.json`. Nothing else.
- Scenarios (spec delta `specs/platform/spec.md`): "Payment URLs read the payment base URL", "Payment skipped while its contract is absent", "Committed payment collection matches the payment contract", "Payment routes", "Payment ids", "Environment variables", "Payment id is fixed".
- Setup: if the worktree has no `node_modules`, run `npm ci` at its root (never `npm install`).
- Failing tests to start from, in `scripts/postman.test.mjs` (exact contents in design.md): `payment URLs read the payment base URL`, `payment routes read the customer token`, `payment ids read environment variables`, `payment collection follows the payment contract` (passes before and after: it guards the absent collection), `postman CLI skips an absent payment contract`, `environment holds the fourteen variables` (rename of `environment holds the twelve variables`), and the payment case of `two runs give identical bytes with no generated ids`.
- Commits:
  1. `test: payment postman collection and environment` with only `scripts/postman.test.mjs`; `node --test scripts/postman.test.mjs` shows 21 pass and 6 fail (the six names in task 2.1). Paste the failing names here.
  2. `feat: postman collection and environment for payment`: `scripts/postman.mjs` (two lines), the environment file (two entries before `serviceToken`), `tasks.md` (2.x ticked), this file.
- Gates (paste results here): `node --test scripts/postman.test.mjs` 27 pass, 0 fail; `make postman` twice prints the payment skip line and `git status --porcelain` shows no collection change; `make test-core`; `make test-rider`; `openspec validate --all --strict`.
- Stop and write here, without guessing, if: the red count differs from 6; the core or rider collection changes; a seed test fails on the environment file; anything needs a file outside scope.
## Doing
- Red (commit 490b4c7, `test: payment postman collection and environment`): `node --test scripts/postman.test.mjs` gave `# pass 21`, `# fail 6`. Failing: `payment URLs read the payment base URL`, `payment routes read the customer token`, `payment ids read environment variables`, `postman CLI skips an absent payment contract`, `two runs give identical bytes with no generated ids`, `environment holds the fourteen variables`. `payment collection follows the payment contract` passed as expected.
- Green (`feat: postman collection and environment for payment`): two lines in `scripts/postman.mjs` (`payments: 'paymentId'`, `payment: { baseUrl: 'paymentBaseUrl', ownToken: 'customerToken' }`); two entries before `serviceToken` in the environment file; tasks 2.1 to 2.3 ticked.
  - `node --test scripts/postman.test.mjs`: `# tests 27`, `# pass 27`, `# fail 0`.
  - `make postman` (run twice): prints `postman: services/payment/openapi.json absent, skipping`; `git status --porcelain` empty after the second run except the two committed files; `git diff` on the core and rider collections is empty; no payment collection in `docs/postman`.
  - `make test-core` and `make test-rider`: exit 0, no FAIL (the seed tests read the environment file).
  - `openspec validate --all --strict`: `Totals: 20 passed, 0 failed`, exit 0.
  - Not run: `check-payment-wiring.sh`, the archived check scripts, and any make target that starts a server or a container.
## Found
- None. The design's code applied as written; the red count matched the brief's six.
## Requests
- None.
## Blockers
- None.
