## Why

PLAN.md D46 hands platform four tooling items that other areas reported while Phase 3 landed:

- rider-P3-L1 (`.claude/areas/rider.md` Requests): a path or query parameter without an `example` makes the converter invent a random value, so `make postman` is not byte-stable for such a contract; `scripts/postman.mjs` rewrites path ids in each request but not in the saved example responses' `originalRequest`. Rider's contract carries examples as a workaround.
- core-P3-L1 (`.claude/areas/core.md` Requests): the five routes that admit a service token use `{{staffToken}}` in the collection; there is no `serviceToken` variable.
- rider-P3-L3 (`.claude/lanes/rider-P3-L3-T1.md`, PLAN.md backlog): npm 10.9.9 crashes with `Cannot read properties of null (reading 'edgesOut')` on an `npm install` that adds a workspace; the workaround lives only in a lane log.
- `make gen` does not run `packages/ui`'s `gen:tokens`, so `src/tokens.ts` is regenerated only by hand (the ui drift test catches a stale file; `make gen` should fix it).

## What Changes

- `scripts/postman.mjs`: a parameter without an example gets a fixed value (schema `default`, else first `enum` value, else `<name>`) before conversion; the path id rewrite also applies to every saved response's `originalRequest`; an operation marked `x-service-token: true` reads `{{serviceToken}}`.
- `docs/postman/local.postman_environment.json`: a twelfth variable, `serviceToken` (type `secret`, the Makefile's dev service token). Both collections regenerated.
- `scripts/postman.test.mjs`: tests for the above.
- `Makefile`: `make gen` runs `gen:tokens` after `gen:api`.
- `README.md`: a `## Troubleshooting` section with the npm `edgesOut` crash and the workaround rider-P3-L3 used; the `make gen` row names `src/tokens.ts`; the API paragraph names `serviceToken`.
- `check-tooling.sh` in this folder: the test for the Makefile and README scenarios.

`openspec/config.yaml` needs nothing: its capability list already names all 18 folders under `openspec/specs/`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform`: MODIFIED "Postman requests authenticate from environment tokens", "Path ids read environment variables", "Postman collection is byte-stable", "Local Postman environment", "make gen runs the rider sqlc"; ADDED "Postman environment carries the service token", "README troubleshooting and tooling notes".

## Impact

- Area: platform. Files: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/*.json`, `Makefile`, `README.md`, this folder.
- Cross-area contracts relied on: `services/core/openapi.json` marks the routes a service token may call with `x-service-token: true` (core, on `main` since core-P3-L1; core's `TestContractSecurity` proves the mark against the router). `packages/ui/package.json` script `gen:tokens` (ui, on `main` since ui-tokens-export; idempotent). `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN ?=` in the `Makefile` (platform).
- Out of scope: any edit to `services/`, `packages/` or `apps/`; the order of the `staff` and `rider` body examples on `POST /admin/orders/{id}/status` (a request to core, see design.md); a second request per service route for staff.
