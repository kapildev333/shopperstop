## Why

Spec 1 §11 makes `services/core/openapi.json` the documentation and asks for a Postman collection generated from it, committed, and kept fresh by CI. The Makefile target, the root `postman` script and the `openapi-to-postmanv2` dev dependency exist (platform-ci-makefile), and core has landed `openapi.json`, but `scripts/postman.mjs` does not exist yet, so `make postman` skips.

## What Changes

- Add `scripts/postman.mjs`: converts `services/core/openapi.json` with `openapi-to-postmanv2` and writes `docs/postman/shopperstop-core.postman_collection.json`: one folder per tag, one request per operation with its example body, bearer auth reading `{{customerToken}}` or `{{staffToken}}` on secured operations, a test script on sign-in requests that stores the returned token, id path variables reading `{{storeId}}`, `{{productId}}`, `{{addressId}}`, `{{orderId}}`, and byte-stable output (no generated ids).
- Add `scripts/postman.test.mjs` (Node's built-in test runner): runs the generator against the real contract and against a Phase 2 shaped fixture.
- Commit the generated collection and a hand-written `docs/postman/local.postman_environment.json` with `baseUrl` `http://localhost:8080/api/core/v1` and empty `customerToken`, `staffToken`, `storeId`, `productId`, `addressId`, `orderId`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform`: adds the Postman requirements (collection generated from the contract, token auth, sign-in token capture, id path variables, byte-stable output, the local environment). Disjoint from the 15 requirements on main and from platform-ci-makefile's "make gen and make postman regenerate committed files" and "CI core job gates core and generated files", which this change relies on and does not restate.

## Impact

- Area: platform. Files: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/shopperstop-core.postman_collection.json`, `docs/postman/local.postman_environment.json`.
- Cross-area contracts relied on: `services/core/openapi.json` (core). Its `tags`, `summary`, request and response `example`s and, from Phase 2, `components.securitySchemes` plus per-operation `security` drive the collection; core routes stay under `/admin/` for staff (Spec 2 §5).
- Relies on, unchanged: root `package.json` (`postman` script, `openapi-to-postmanv2@6.4.0`), `make postman`, the CI `core` job's clean-tree check (PLAN.md D14).
- Out of scope: wiring `postman.test.mjs` into `make test` or CI; scripts that capture ids from responses; Newman runs; collections for later services.
