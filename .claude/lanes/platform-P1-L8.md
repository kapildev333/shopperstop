# platform-P1-L8 - Postman collection generated from openapi.json (OpenSpec change platform-postman)
Status: done (task 1 landed: red ee86d59, green b6c433d; reviewer approve; manager verified; team-lead acceptance passed)
## Doing
## Found
- Change `openspec/changes/platform-postman/`: proposal, `specs/platform/spec.md` (ADDED, 6 requirements, 12 scenarios, no name clash with main's 15 or platform-ci-makefile's 11), design (generator code prototyped and verified against openapi-to-postmanv2 6.4.0, environment file, test fixture), tasks (one task). `openspec validate platform-postman --strict` valid; `--all --strict` 4 passed. No `docs/design/platform-P1-L8.md`: design.md is enough.
- Converter 6.4.0 facts: random `id` on every item and response plus `info._postman_id` (only volatile output; stripped); collection `variable` baseUrl `/api/core/v1` (dropped); bearer `security` becomes `{{bearerToken}}` (rewritten); invalid document gives `result: false`.
- Token audience is chosen by the `/admin/` path prefix, not by tag (design Decision 3).
- Node: `PATH=~/.local/node-v22.23.3/bin:$PATH`; `npm ci` already run in this worktree.
- Red step (task 1.2), `node --test scripts/postman.test.mjs` before `scripts/postman.mjs` exists, output verbatim (head):
```
# node:internal/modules/esm/resolve:275
#     throw new ERR_MODULE_NOT_FOUND(
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../scripts/postman.mjs' imported from .../scripts/postman.test.mjs
```
- Red commit ee86d59 (rebased; was dbeecf2), green commit b6c433d. Green (task 1.3): `node --test scripts/postman.test.mjs` -> `# tests 10`, `# pass 10`, `# fail 0`.
- Gates (task 1.4), before the feat commit: `openspec validate --all --strict` -> `Totals: 4 passed, 0 failed (4 items)` before the rebase, `5 passed, 0 failed (5 items)` after it; `make postman` twice and `cd /private/tmp && node .../scripts/postman.mjs` left the collection byte-identical (`git status --porcelain` shows only the new files, no drift).
- Design choice taken as written: no open choices. Note for reviewer: `docs/postman/` and `scripts/postman.mjs` are new, so the collection is untracked until the feat commit lands.
- Manager verification: 10/10 tests; `make postman` twice leaves the tree clean; the committed collection's `Liveness` and `Readiness` replayed over HTTP against a real core on :8080 both answered 200 `{"status":"ok"}` with no auth.
- Acceptance (team lead, /opsx:verify platform-postman, on b6c433d based on d7130c0): PASS. Tasks 1.1 to 1.4 ticked. 12 scenarios (the earlier "13" was a miscount), each mapped: Folders follow the contract tags -> test 1 (real contract) + HTTP replay; Request carries its example body -> test 2; Invalid contract is refused -> test 3 (`generate` rejects; the CLI awaits `generate` before `writeFileSync`, so nothing is written); Customer route, Staff route -> test 4; Public route -> test 5 + HTTP replay (200 with no auth); Customer sign-in, Staff sign-in, Sign-out has no script -> test 6; Order id -> test 7; Two runs give identical bytes -> test 8 + double `make postman` clean + test 9; Environment variables -> test 10. Fixture-only until Phase 2 routes exist: tests 2, 4, 6, 7 (reviewer low finding; manager wires `node --test scripts/postman.test.mjs` into `make postman` as a platform chore after merge). Nothing extra landed: lane diff is the change folder, the two scripts, the two `docs/postman/` files, this log. Gates re-run: `node --test scripts/postman.test.mjs` -> `# tests 10`, `# pass 10`, `# fail 0`; `make postman` twice, then `cd /private/tmp && node .../scripts/postman.mjs` -> `git status --porcelain` empty; `openspec validate --all --strict` -> `Totals: 5 passed, 0 failed (5 items)`.
## Requests
- to core (via platform manager and orchestrator; relayed as PLAN.md D20): Phase 2 `openapi.json` declares `components.securitySchemes.bearer` (`type: http`, `scheme: bearer`) and `security: [{bearer: []}]` on every authenticated operation; keep every staff route under `/admin/`; give sign-in and register 2xx examples a string `token`. Optional: fixed demo-data ids so the environment can hold `storeId`, `productId`, `addressId`.
## Blockers
