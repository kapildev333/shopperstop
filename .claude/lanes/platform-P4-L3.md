# platform-P4-L3 - platform-postman-tooling (team lead)
Status: done (acceptance passed; 3.2 manager, 3.3 archive after merge)
## Doing
Acceptance passed on 3ab7a43; 3.1 ticked. Waiting for 3.2 (manager), the PR and the archive (3.3).
## Found
- Change: `openspec/changes/platform-postman-tooling/` (proposal, design, tasks, delta `specs/platform/spec.md`, `check-tooling.sh`). `openspec validate platform-postman-tooling --strict` valid; `openspec validate --all --strict` Totals 20 passed, 0 failed.
- Delta: MODIFIED "Postman requests authenticate from environment tokens", "Path ids read environment variables", "Postman collection is byte-stable", "Local Postman environment", "make gen runs the rider sqlc"; ADDED "Postman environment carries the service token", "README troubleshooting and tooling notes". Bodies 309 to 483 characters.
- `openspec/config.yaml` already lists all 18 folders under `openspec/specs/`; no edit.
- Service routes need no contract change: core already marks them `x-service-token: true` (five operations), proven by core's `TestContractSecurity`.
- Measured with openapi-to-postmanv2 6.4.0: a parameter without an example and without a schema `default` is random in the request and in `originalRequest` alike, so rewriting `originalRequest` alone would not make the collection deterministic; design.md fills missing examples on the cloned contract before conversion. Both contracts on main carry examples (rider's `page`/`pageSize` rely on schema `default`), so today's collections change only in `originalRequest` ids and the five service routes' auth.
- `gen:tokens` output equals the committed `packages/ui/src/tokens.ts` (two runs, identical bytes), so `make gen` stays clean.
- The archived `check-mobile-wiring.sh` already fails on main (1 failure, a link into apps/mobile, superseded by platform-mobile-readme-spec); the T2 gates use `check-readme-mobile.sh` instead.
- `openspec/changes/platform-ci-makefile/` (Phase 1) is still unarchived on main; worth an archive or delete chore by the manager.
- The worktree has no `node_modules`; workers run `npm ci` first.
## Requests
- to core (optional, via the area plan): in `POST /admin/orders/{id}/status`, list the `rider` request body example before `staff`, so the generated Postman request (which now reads `{{serviceToken}}`) carries a body the service token is allowed to send; today it answers 400 (`actor` required).
- to core (heads-up): core-P4-L2 will change `openapi.json`; whichever of core-P4-L2 and this lane merges second runs `make postman` after merging main and commits the regenerated collection.
- to platform manager: CLAUDE.md's `make gen` row should also name `packages/ui/src/tokens.ts` once this lands (outside this lane's scope).
## Blockers
None.

## T1 review
Verdict: approve. No findings.
- Commit order: e41a216 (test only, scripts/postman.test.mjs) before 8dad1ca (feat); red recorded in the T1 log with the six expected names. Scope held (scripts, docs/postman, tasks.md, lane log).
- Code matches design.md 1 to 4: fillExamples runs on the structuredClone and skips $ref and existing examples; id rewrite covers originalRequest.url; serviceOperations reads x-service-token and matches the converter's `:id` paths (the real-contract test checks both ways).
- Regenerated docs diff holds only: five core routes staffToken to serviceToken, literal seed ids to {{storeId}}/{{orderId}}/{{productId}}/{{riderId}}/{{deliveryId}}/{{addressId}} in saved-response originalRequest, and the twelfth environment variable (secret, Makefile dev token).
- Gates I ran: `node --test scripts/postman.test.mjs` 22 pass 0 fail; `make postman` twice, both exit 0, `git status --porcelain` empty; `openspec validate --all --strict` 20 passed 0 failed. test-core/test-rider and e2e not re-run (environment file only gains a key at the end).
- Nits (no action): none needed.

## T2 review
Verdict: approve. No findings.
- Scope: a1517ad touches Makefile (one line), README.md, tasks.md, lane log; 473d77b ticks 2.3 and the T2 log. No test: commit is expected (check-tooling.sh came with the proposal; red recorded in the T2 log with 10 FAIL lines).
- Makefile: `gen:api && gen:tokens`, same `test -d packages/ui` guard and `--if-present`; sits after both sqlc steps, matching "Rider sqlc between core sqlc and the API types". Idempotent: make gen leaves the tree clean.
- README: Troubleshooting only restates rider-P3-L3-T1 and areas/rider.md (crash text, npm 10.9.9, vitest 5.0.4, optional peer, legacy-peer-deps and npm 11 rewrite other entries, admin-seeded lock, package-lock-only, ci --dry-run); the closing `npm ci` claim holds (Quick start line 29, ci.yml). make gen row and API sentence correct (x-service-token exists in core openapi.json). All four scenarios covered by check-tooling.sh.
- Complexity: none.
- Gates I ran: check-tooling.sh `tooling check: ok`; check-docs.sh `docs check: ok`; check-readme-mobile.sh `readme mobile check: ok`; `make gen` exit 0 then `git status --porcelain` empty; `openspec validate --all --strict` 20 passed, 0 failed. No containers, no e2e.

## Acceptance (/opsx:verify platform-postman-tooling, on 3ab7a43): pass
- Tasks: 1.1 to 1.3 and 2.1 to 2.3 ticked by the workers; 3.1 ticked here; 3.2 (manager) and 3.3 (archive) open.
- Test-first: `e41a216 test:` precedes `8dad1ca feat:` (T1); T2's test is `check-tooling.sh` from `9d97135`, red recorded in `platform-P4-L3-T2.md` before `a1517ad feat:`. All commits by kapildev333 noreply, no attribution lines.
- Scope: `git diff --stat origin/main...HEAD` holds only design.md's files (`scripts/postman.mjs`, `scripts/postman.test.mjs`, the three `docs/postman/*.json`, `Makefile`, `README.md`, the change folder) plus the three platform-P4-L3 lane logs. Code matches design.md 1 to 6; nothing extra.
- Scenario to test map (all passing):
  - Customer route, Staff route, Public route, Rider routes: existing `secured requests read the token for their audience`, `public requests carry no auth`, `rider routes read their tokens`.
  - Service route: `service routes read serviceToken`. Core service routes: `core service routes follow x-service-token` (set derived from the contract, non-empty).
  - Order id, Rider and delivery ids, Slug keeps its example: existing `path ids read environment variables`, `rider and delivery ids read environment variables`, `slug path variables keep their example value`. Saved responses read the same ids: `saved responses read environment ids`.
  - Two runs give identical bytes: `two runs give identical bytes with no generated ids` and `make postman` twice with a clean tree. Parameter without an example, Default and enum fill a missing example: `parameters without an example get a fixed value` (code, since, pageSize 24, status ready; request and every originalRequest; fixture unchanged).
  - Environment variables: `environment holds the twelve variables`. Ids are the seeded rows: core `TestSummaryMatchesSeed` (make test-core, manager). Service token is the dev token: `serviceToken is the Makefile dev service token`.
  - Rider sqlc between core sqlc and the API types, make gen leaves the tree clean: `check-tooling.sh` make section. Troubleshooting names the crash and the workaround, README names the tokens step and the service token: `check-tooling.sh` docs section.
- My re-run on 3ab7a43: `node --test scripts/postman.test.mjs` 22 pass, 0 fail; `make postman` twice, `git status --porcelain` empty; `check-tooling.sh` ok (tree clean after its real `make gen`); `check-docs.sh` ok; `check-readme-mobile.sh` ok; `openspec validate platform-postman-tooling --strict` valid; `openspec validate --all --strict` 20 passed, 0 failed.
- Manager's evidence for 3.2 (relayed 2026-10-16, recorded here, not ticked by me): node --test 22/0; `make postman` twice and `make gen` clean; check-tooling, check-docs, check-readme-mobile ok; strict 20 passed; `make test-core` and `make test-rider` green; real core on :18090 against the migrated dev database: the four service-token GET routes 200 with `{{serviceToken}}`, `/admin/staff-users` with it 403, a wrong token 401.
- Still open from the proposal: the core request (rider body example first on `POST /admin/orders/{id}/status`, else that Postman request answers 400 with the service token), the merge-order note with core-P4-L2, CLAUDE.md's `make gen` row, and the unarchived `platform-ci-makefile` change.
