# platform-P5-L1-T2 - Postman collection and environment for payment (worker brief)
Status: not started (after T1)
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
## Found
## Requests
## Blockers
