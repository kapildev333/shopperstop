# platform-P4-L3 - platform-postman-tooling (team lead)
Status: started
## Doing
Proposal committed (`docs(openspec): propose platform-postman-tooling`); waiting for the manager to launch T1, then T2. Acceptance (`/opsx:verify`) after both.
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
