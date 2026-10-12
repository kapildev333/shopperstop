# platform-P1-L8 - Postman collection generated from openapi.json (OpenSpec change platform-postman)
Status: done (task 1 landed on lane/platform-P1-L8-postman, reviewer and manager verification pending)
## Doing
Task 1 done: red commit dbeecf2, generator and environment committed in the feat commit; all 10 tests pass; gates in Found.
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
- Green (task 1.3): `node --test scripts/postman.test.mjs` -> `# tests 10`, `# pass 10`, `# fail 0`.
- Gates (task 1.4), before the feat commit: `openspec validate --all --strict` -> `Totals: 4 passed, 0 failed (4 items)`; `make postman` twice and `cd /private/tmp && node .../scripts/postman.mjs` left the collection byte-identical (`git status --porcelain` shows only the new files, no drift).
- Design choice taken as written: no open choices. Note for reviewer: `docs/postman/` and `scripts/postman.mjs` are new, so the collection is untracked until the feat commit lands.
## Requests
- to core (via platform manager and orchestrator): Phase 2 `openapi.json` declares `components.securitySchemes.bearer` (`type: http`, `scheme: bearer`) and `security: [{bearer: []}]` on every authenticated operation; keep every staff route under `/admin/`; give sign-in and register 2xx examples a string `token`. Optional: fixed demo-data ids so the environment can hold `storeId`, `productId`, `addressId`.
## Blockers
