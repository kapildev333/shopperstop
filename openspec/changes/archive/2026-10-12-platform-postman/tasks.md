# Tasks

## 1. Postman generator, collection and environment (worker lane platform-P1-L8, one task)

Scope: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/shopperstop-core.postman_collection.json`, `docs/postman/local.postman_environment.json`, this file's checkboxes.
Scenarios: every scenario in `specs/platform/spec.md`.
Test first: `scripts/postman.test.mjs`, run with `node --test scripts/postman.test.mjs` (Node >= 22.12). It is not wired into `make test` or CI on purpose (design Decision 8); CI's gate is `make postman` leaving the tree clean.
Commits: `test: postman collection scenarios`, then `feat: postman collection generated from openapi.json`.

- [x] 1.1 Write `scripts/postman.test.mjs` with these tests (the real contract is `services/core/openapi.json`; the fixture is the one in design.md; read files relative to `import.meta.url`):
  - `folders follow the contract tags` (real): one folder `platform` with `Liveness` `GET` path `healthz` and `Readiness` `GET` path `readyz`, host `{{baseUrl}}`
  - `request carries its example body` (fixture): `Sign in` raw body parses to the request example
  - `invalid contract is refused` (a document without `openapi`): `generate` rejects
  - `secured requests read the token for their audience` (fixture): `Order` auth bearer value `{{customerToken}}`, `Me` `{{staffToken}}`
  - `public requests carry no auth` (real): `Liveness` and `Readiness` have no auth
  - `sign-in requests store the returned token` (fixture): customer sign-in test script sets `customerToken`, staff sign-in sets `staffToken`, `Sign out` has no event
  - `path ids read environment variables` (fixture): `Order` path variable `id` is `{{orderId}}`
  - `two runs give identical bytes with no generated ids` (real and fixture): equal strings, end with `\n`, no `id` or `_postman_id` key anywhere in the parsed object, no top-level `variable`
  - `committed collection matches the contract` (real): `docs/postman/shopperstop-core.postman_collection.json` equals `generate` of the real contract
  - `environment holds the seven variables`: keys exactly `baseUrl`, `customerToken`, `staffToken`, `storeId`, `productId`, `addressId`, `orderId`; `baseUrl` is `http://localhost:8080/api/core/v1`; the rest empty
- [x] 1.2 Run it, see it fail (module `scripts/postman.mjs` not found), paste the failure in the lane log, commit `test: postman collection scenarios`
- [x] 1.3 Write `scripts/postman.mjs` and `docs/postman/local.postman_environment.json` from design.md, run `npm run postman` to generate the collection, run the test green
- [x] 1.4 Gates: `node --test scripts/postman.test.mjs` all pass; `make postman` twice, then `git status --porcelain` empty after committing; `cd /tmp && node <worktree>/scripts/postman.mjs` leaves the collection unchanged; `openspec validate --all --strict` passes; diff touches only the four files, this file and the lane log. Commit `feat: postman collection generated from openapi.json`
