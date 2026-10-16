# platform-P3-L1-T3 - CI rider job, README and CLAUDE.md (OpenSpec change platform-rider-wiring, tasks 3.1 to 3.4)
Status: done (committed as `feat: rider ci job and docs`, with the manager's five-jobs amendment of `platform-ci-makefile`; not pushed)
## Doing
Done. Waiting for the reviewer and the area manager to land it with tasks 1 and 2.
## Found
- Red (3.1, unchanged tree before this commit, `sh openspec/changes/platform-rider-wiring/check-wiring.sh ci docs`): `wiring check: 18 failures`. The `ci` section fails on the job list (`AssertionError: ['core', 'web', 'e2e', 'spec']`, reported as `FAIL: ci.yml: rider job shape`); the `docs` section passes the archived `check-docs.sh` and fails on the rider strings. FAIL lines:
  - `FAIL: ci.yml: rider job shape`
  - `FAIL: README.md lacks:` `:8081`, `:5175/rider/`, `rider1-koramangala@shopperstop.local`, `rider12345`, `rider-admin seed-demo --reset`, the `grep shopperstop_rider deploy/initdb.sql | docker exec -i shopperstop-postgres-1 psql ...` one-liner, `` `make test-rider` ``, `` `make rider` ``, `` `make rider-app` ``
  - `FAIL: CLAUDE.md lacks:` `` `make test-rider` ``, `shopperstop_rider_e2e`, `18081`, `15175`, `` `rider` (`make test-rider` ``, `shopperstop-rider.postman_collection.json`, `packages/ui/src/api/rider.d.ts`, `` `rider-app` ``
- Green (3.3): `sh openspec/changes/platform-rider-wiring/check-wiring.sh` prints `wiring check: ok` (all four sections, exit 0). `sh openspec/changes/archive/2026-10-12-platform-readme-claude/check-docs.sh` prints `docs check: ok`. `openspec validate --all --strict` prints `Totals: 15 passed, 0 failed (15 items)`; `openspec validate platform-ci-makefile --strict` and `openspec validate platform-rider-wiring --strict` both print valid.
- `ci.yml`: the `rider` job is the design's text verbatim, between `core` and `web`; the parsed job list is `core, rider, web, e2e, spec`. No other job changed.
- Manager's extra item (done): `openspec/changes/platform-ci-makefile/specs/platform/spec.md` requirement "CI runs five jobs" (heading, the requirement text, the Workflow shape scenario's list, and the Foundation scenario's "all five jobs succeed"); every other word unchanged. This resolves the platform-P3-L1 request to the orchestrator about "CI runs four jobs".
- README: status line, the "Phase 3 adds ..." sentence and the "Cloned before Phase 3?" paragraph after the Quick start; four rider rows in Demo sign-ins with one sentence saying they are not on `main` yet; Commands table rows (`make dev`, `make test`, `make test-rider`, `make rider`, `make rider-app`, `make e2e`, `make gen`, `make postman`); API paragraph names the rider contract and collections without linking `services/rider/openapi.json`; areas list adds `rider`.
- CLAUDE.md: the stale "Phase 1 ... except the two apps" sentence replaced by the design's sentence; Commands table rows and the pieces sentence; single-test line for the rider; the Agents lane list adds `make test-rider` (one word beyond the design, so the lane list does not omit the rider gate); `ci.yml` job list and e2e list; API documentation paragraph; `docs/postman/` layout line.
- No link to a path that does not exist was added (the docs check resolves relative links and passes).
## Requests
- to platform-P3-L1 (team lead): nothing new.
## Blockers
none
