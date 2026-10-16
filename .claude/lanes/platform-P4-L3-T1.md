# platform-P4-L3-T1 - Postman generator, environment and collections (worker brief)
Status: done (commits e41a216 test, 8dad1ca feat; gates green, task 1.3 ticked)
## Brief
- LANE-ID: platform-P4-L3-T1 (team lead platform-P4-L3). Area: platform.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/platform-P4-L3. Branch: lane/platform-P4-L3-postman-tooling. Commit there as kapildev333 <47056817+kapildev333@users.noreply.github.com>, no attribution trailers; never push.
- Change and task: OpenSpec `platform-postman-tooling`, task 1 (`openspec/changes/platform-postman-tooling/tasks.md`). Read its `design.md` sections 1 to 4 and "Test strategy"; the code shapes there are the design, do not redesign.
- Scope: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/` (the environment and both regenerated collections), ticking task 1 in `tasks.md`, this file. Nothing else.
- Scenarios (spec delta `specs/platform/spec.md`): "Service route", "Core service routes", "Saved responses read the same ids", "Parameter without an example", "Default and enum fill a missing example", "Environment variables", "Service token is the dev token", "Two runs give identical bytes".
- Setup: the worktree has no `node_modules`; run `npm ci` at the worktree root first (`npm ci`, never `npm install`).
- Failing tests to start from, in `scripts/postman.test.mjs` (exact contents in design.md "Test strategy"): `service routes read serviceToken`, `core service routes follow x-service-token`, `saved responses read environment ids`, `parameters without an example get a fixed value`, `environment holds the twelve variables` (rename of `environment holds the eleven variables`), `serviceToken is the Makefile dev service token`.
- Commits:
  1. `test: Postman service token, saved-response ids and missing examples` with only `scripts/postman.test.mjs`; `node --test scripts/postman.test.mjs` fails on those six tests and passes the rest. Paste the failing test names here.
  2. `feat: Postman serviceToken, saved-response ids and fixed missing examples`: `scripts/postman.mjs`, `docs/postman/local.postman_environment.json`, and both collections as written by `make postman`; tick 1.1 and 1.2.
- Gates (paste results here): `make postman` twice and `git status --porcelain` empty after the second; `make test-core`; `make test-rider`; `openspec validate --all --strict`. Then tick 1.3 (amend into the feat commit or a `chore:` commit).
- Stop and write here, without guessing, if: a test needs a fixture shape design.md does not give; the converter output differs from design.md's assumptions (for example `url.path` with a server prefix, or no `originalRequest.url`); `make test-core` or `make test-rider` fails on the environment file; anything needs a file outside scope.
## Doing
- Done: 1.1 (red), 1.2 (green, feat with both regenerated collections), 1.3 (gates below).

## Found
- Red (`node --test scripts/postman.test.mjs` on e41a216), 6 failing, 16 passing. Failing names: `service routes read serviceToken`, `core service routes follow x-service-token`, `saved responses read environment ids`, `parameters without an example get a fixed value`, `environment holds the twelve variables`, `serviceToken is the Makefile dev service token`. Reasons: `{{staffToken}}` vs `{{serviceToken}}`; core set empty vs 5 marked ops; `'o1'` vs `'{{orderId}}'`; random faker dates differ between runs; key list missing `serviceToken`; last key `deliveryId`.
- Green (feat 8dad1ca): `node --test scripts/postman.test.mjs` 22 pass, 0 fail.
- Converter output matched design.md assumptions: `url.path` has no server prefix, path ids are `:id`, `originalRequest.url` present on saved responses. Core marks 5 operations `x-service-token: true`; the generated set matches.
- Gates: `make postman` run twice, both exit 0, `git status --porcelain` empty after the second. `make test-core` exit 0 (no FAIL lines). `make test-rider` exit 0 (no FAIL lines). `openspec validate --all --strict` exit 0 (20 passed, 0 failed). Postgres `shopperstop-postgres-1` used as running, not touched. `make e2e` not run.
- Rider collection changed only in id values (`riderId`, `deliveryId`, `orderId` now environment variables in `originalRequest`); no random values left in either collection.

## Requests
- none

## Blockers
- none
