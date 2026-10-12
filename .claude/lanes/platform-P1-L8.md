# platform-P1-L8 - Postman collection generated from openapi.json (OpenSpec change platform-postman)
Status: started
## Doing
Task 1.2 red done: scripts/postman.test.mjs (10 tests) written, failing on the missing generator. Next: task 1.3 generator and environment.
## Found
- Change `openspec/changes/platform-postman/`: proposal, `specs/platform/spec.md` (ADDED, 6 requirements, 13 scenarios, no name clash with main's 15 or platform-ci-makefile's 11), design (generator code prototyped and verified against openapi-to-postmanv2 6.4.0, environment file, test fixture), tasks (one task). `openspec validate platform-postman --strict` valid; `--all --strict` 4 passed. No `docs/design/platform-P1-L8.md`: design.md is enough.
- Converter 6.4.0 facts: random `id` on every item and response plus `info._postman_id` (only volatile output; stripped); collection `variable` baseUrl `/api/core/v1` (dropped); bearer `security` becomes `{{bearerToken}}` (rewritten); invalid document gives `result: false`.
- Token audience is chosen by the `/admin/` path prefix, not by tag (design Decision 3).
- Node: `PATH=~/.local/node-v22.23.3/bin:$PATH`; `npm ci` already run in this worktree.
- Red step (task 1.2), `node --test scripts/postman.test.mjs` before `scripts/postman.mjs` exists, output verbatim (head):
```
# node:internal/modules/esm/resolve:275
#     throw new ERR_MODULE_NOT_FOUND(
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../scripts/postman.mjs' imported from .../scripts/postman.test.mjs
```
## Requests
- to core (via platform manager and orchestrator): Phase 2 `openapi.json` declares `components.securitySchemes.bearer` (`type: http`, `scheme: bearer`) and `security: [{bearer: []}]` on every authenticated operation; keep every staff route under `/admin/`; give sign-in and register 2xx examples a string `token`. Optional: fixed demo-data ids so the environment can hold `storeId`, `productId`, `addressId`.
## Blockers
