# platform-P5-L2-T1 - offerId in the Postman generator and environment (worker brief)
Status: done (commits 023a835 test, feat below)
## Brief
- LANE-ID: platform-P5-L2-T1 (team lead platform-P5-L2). Area: platform.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/platform-P5-L2. Branch: lane/platform-P5-L2-postman-offer-id. Commit as kapildev333 <47056817+kapildev333@users.noreply.github.com>, no attribution trailers; never push.
- Change and task: OpenSpec `platform-postman-offer-id`, task 1 (`openspec/changes/platform-postman-offer-id/tasks.md`).
- Scope: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/local.postman_environment.json`, ticking 1.x in `tasks.md`, this file. Nothing else.
- Scenarios (`specs/platform/spec.md` of the change): "Offer id", "Environment variables", "Rider ids are fixed".
- Setup: `npm ci` at the worktree root if `node_modules` is absent (never `npm install`).
- Failing tests to start from, in `scripts/postman.test.mjs`:
  1. `environment holds the fifteen variables`: rename of `environment holds the fourteen variables`; key list gains `'offerId'` right after `'deliveryId'`; add `assert.equal(byKey.offerId, '00000000-0000-4000-8000-000000000902');` and `assert.equal(byType.offerId, 'default');` beside the rider ids.
  2. `offer ids read environment variables` (put it after `rider and delivery ids read environment variables`): generate `{ ...riderFixture, paths: { '/me/offers/{id}/accept': { post: { summary: 'Accept offer', tags: ['deliveries'], security: [{ bearer: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'f1' }], responses: { 201: { description: 'Accepted.' } } } } } }` with `generate(..., 'rider')` and assert `requestNamed(c, 'Accept offer').request.url.variable.map((v) => [v.key, v.value])` deep-equals `[['id', '{{offerId}}']]`. If the fixture shape needs adjusting to generate, copy the shape of an existing `riderFixture` path; do not change other tests.
- Commits:
  1. `test: offerId postman variable` with only `scripts/postman.test.mjs`; `node --test scripts/postman.test.mjs` shows exactly those two failing. Paste `# pass` / `# fail` and the names here.
  2. `feat: offerId postman variable`: `offers: 'offerId',` after `deliveries` in `ID_VARS`; the `offerId` entry (`type` `default`, `enabled` true) after `deliveryId` in the environment file; `tasks.md` 1.x ticked; this file.
- Gates (paste results here): `node --test scripts/postman.test.mjs` all pass; `make postman` twice, then `git status --porcelain` shows no collection file changed (core, rider, payment collections byte-identical; no contract has an offers route yet); `make test-core`; `make test-rider` (seed tests read the environment file by key); `openspec validate --all --strict`.
- Never run `make db`, `make dev`, `make prod-local`, `make core`, `make rider`, `make payment`, `make e2e`, the archived `check-wiring.sh` or `check-mobile-wiring.sh`; never touch containers.
- Stop and write here, without guessing, if: the red count is not exactly two; any collection changes; a seed test fails on the environment file; anything needs a file outside scope.
## Log
- Red (`node --test scripts/postman.test.mjs`, before feat): `# pass 26`, `# fail 2`: `not ok 17 - offer ids read environment variables` (path var stayed `f1`), `not ok 27 - environment holds the fifteen variables`.
- Commit 1: `test: offerId postman variable` (023a835), only scripts/postman.test.mjs.
- Green (after feat): `node --test scripts/postman.test.mjs` `# pass 28`, `# fail 0`.
- `make postman` run twice, both exit 0; `git status --porcelain` shows only the feat files (environment, postman.mjs, tasks.md); no collection changed.
- `make test-core` exit 0 (all packages ok); `make test-rider` exit 0 (pg and seed ok, seed 30.0s).
- `openspec validate --all --strict`: 20 passed, 0 failed.
- Commit 2: `feat: offerId postman variable`: `offers: 'offerId'` in ID_VARS, offerId env entry after deliveryId, tasks 1.1 to 1.3 ticked.
