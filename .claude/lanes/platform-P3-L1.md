# platform-P3-L1 - rider wiring: databases, Makefile, Caddy, CI, Postman, docs (OpenSpec change platform-rider-wiring)
Status: started (change proposed, validated; waiting for the orchestrator's look and the workers)
## Doing
Team lead: change committed; three worker briefs in the report; reachable for worker questions here.
## Found
- Change `openspec/changes/platform-rider-wiring/`: proposal, `specs/platform/spec.md` (8 MODIFIED: initdb, Caddy, five Postman requirements, docs; 7 ADDED: rider make targets skip, make dev, make test, make e2e, make gen, make prod-local, CI rider job), design (exact Makefile, Caddyfile, compose mount, initdb lines, CI job, generator; tests to add), tasks (3 worker tasks, 1 manager task), `check-wiring.sh` (test for tasks 1 and 3). `openspec validate platform-rider-wiring --strict` valid; `--all --strict` 15 passed. No `docs/design/platform-P3-L1.md`: design.md is enough.
- Prototyped in a scratch copy (git archive of c2dbfb3): `check-wiring.sh deploy make ci` ok with the design's files, 62 FAIL lines on c2dbfb3; the design's generator writes a byte-identical core collection, prints the rider skip line, passes the existing 11 tests, and gives the rider fixture the right hosts, tokens and ids.
- The running container has the rider role and databases (D33): pgx as `shopperstop_rider` on `shopperstop_rider_test` answers `select 1`; the role owns exactly `shopperstop_rider`, `_e2e`, `_test`.
- `openspec validate` checks MODIFIED blocks against `openspec/specs/`: a renamed or dropped scenario fails. The Makefile and CI requirements exist only in the open change `platform-ci-makefile`, so the rider ones are ADDED (design Decision 1).
- Compose creates a missing bind-mount source (`apps/rider/dist`) on the host, which would make `test -d apps/rider` true; Caddy now mounts `../apps` once.
- A recipe line containing `$(MAKE)` runs under `make -n`; prod-local's servers are on their own line for that reason.
- Guard hook: Bash text containing the compose command, `docker-compose` or `docker exec` is denied (heredocs and `git add` of the compose file too). Use Write/Edit and `git add deploy`.
- `.claude/commands/*.md` already name the rider area (orchestrator); not touched by this lane.
## Requests
- to orchestrator: `platform-ci-makefile` "CI runs four jobs" says "exactly core, web, e2e and spec"; this change adds `rider`. Amend that requirement to the five jobs when archiving `platform-ci-makefile` (or archive it first and this change turns its ADDED Makefile and CI requirements into MODIFIED).
- to rider (via `.claude/areas/rider.md` Requests): `rider-admin seed-demo --reset` must not call core (make seed and make e2e run it before any server); the seed test ties `riderId` 0801 and `deliveryId` 0901 in `docs/postman/local.postman_environment.json` to the seed, as core's does; `apps/rider` provides `dev`, `build` and `e2e` npm scripts and its Playwright config starts core and rider from the inherited `make e2e` env; the first PR with `services/rider/openapi.json` commits `docs/postman/shopperstop-rider.postman_collection.json` from `make postman`.
- to core (via `.claude/areas/core.md`): `SHOPPERSTOP_CORE_SERVICE_TOKENS` arrives as `rider:<token>` from the Makefile in dev and e2e; if core-P3-L1 makes it required, the Makefile already passes it.
- to ui (via `.claude/areas/ui.md`): `make gen` calls only `npm run gen:api --workspace packages/ui --if-present`; ui-P3-L2 extends that script to write `packages/ui/src/api/rider.d.ts` when `services/rider/openapi.json` exists (and skip otherwise, so `make gen` stays clean on main).
## Blockers
