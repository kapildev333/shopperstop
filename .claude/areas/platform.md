# platform
Scope: root files, `deploy/`, `.github/`, `openspec/`, `docs/`, `Makefile`, `README.md`, `CLAUDE.md`
Depends on: none
Spec: Spec 1 §3, §5.1, §6, §7, §11, §12; plan tasks 1, 3, 4, 12, 13, 15 (tasks 1 and 2 done by the orchestrator)
## Doing
No platform lane running. Phase 1 platform tasks are all on main; the only open item is the first green CI run (account billing). No `make e2e` running.
## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| platform-P1-L3 | Task 3 OpenSpec seed (`platform`, `design-system` specs) | `openspec/` | done 2026-10-12: reviewer approve, acceptance pass, manager verified (diff gate, validate); PR #3 merged; archived in #5 |
| platform-P1-L4 | Task 4 deploy files and `make db` | `deploy/`, `Makefile` | done 2026-10-12: reviewer approve, acceptance pass, manager verified (`make db` healthy, `select 1` as shopperstop_core on `_test`, role owns 3 databases); PR #4 merged; archived in #6 |
| platform-P1-L9 | Task 13 CI workflow and Makefile | `.github/workflows/`, `Makefile` | done 2026-10-12: reviewer approve, acceptance pass with task 3.1 (first green CI run) open because GitHub Actions is disabled by account billing; manager verified skip targets, dry runs, e2e isolation, YAML; PR #15 merged; change `platform-ci-makefile` stays open until a real CI run ticks 3.1, then archive |
| platform-P1-L8 | Task 12 Postman | `scripts/`, `docs/postman/` | done 2026-10-12: reviewer approve, acceptance pass, manager verified (10/10 tests, double `make postman` clean, HTTP replay of the collection against core :8080 both 200); PR #36 merged; archived #38; `make postman` runs the tests (#37) |
| platform-P1-L11 | Task 15 README, CLAUDE.md | `README.md`, `CLAUDE.md` | done 2026-10-12: reviewer changes-needed then fixed, acceptance pass, manager verified (`check-docs.sh` ok, validate, every make target dry-runs); PR #42 merged; archived #43 |
| orchestrator | Task 14 Figma | Figma file, `docs/figma.md` | done 2026-10-12 (D17): https://www.figma.com/design/pUvvBVQbwM8287Q3Fji8G1 |
## Requests

## Found
- 2026-10-12: chores landed: e2e guard on web or admin (#30), `make postman` runs the generator tests (#37), Node floor (#10), root build script (#13).
- 2026-10-13: backlog chores landed in #97: the lane guard allows `git merge-base`; `make ui` (so `make dev`, `make test-web`) runs `npm ci` when `node_modules` is absent. sqlc was pinned in #58.
- 2026-10-12: GitHub Actions blocked by account billing (PLAN.md Blockers); first `ci` run on PR #15 started no steps.
- 2026-10-12: `psql` is not installed on this host; ad-hoc database checks use a Go pgx client. Recorded for the README.
- 2026-10-12: the lane guard hook denies `git merge-base` and `git fetch` to reviewers (pattern matches `merge`); reviewers work around with `git rev-parse` and three-dot diffs. Harmless; tighten the regex to word boundaries if it bites again.
- The Phase 1 plan spells out only Tasks 1 to 4; Tasks 12, 13 and 15 are written as OpenSpec changes from Spec 1 §6, §7, §11, §12.
## Backlog

## Phase 3 work package (orchestrator, 2026-10-15; runs in the orchestrator session, D9)
Spec: PLAN.md Phase 3, D29, D33; Spec 1 §3 (layout), §6 (CI), §7 (local development), §11 (Postman: "later services add their own collection and reuse the environment"). One change, first in the phase; every piece skips while `services/rider` or `apps/rider` is absent, so it merges before the rider area starts.

| Lane | Change | Deliverable |
|---|---|---|
| platform-P3-L1 | `platform-rider-wiring` (MODIFIED `platform`) | `deploy/initdb.sql`: role `shopperstop_rider` and databases `shopperstop_rider`, `_test`, `_e2e` (D33: the orchestrator applies them to the running container by hand, README says how for an existing clone). `deploy/Caddyfile`: `/api/rider/*` to `host.docker.internal:8081`, `/rider/*` served from `/srv/rider` (compose mounts `../apps/rider/dist`). Makefile: `RIDER_ENV` (`SHOPPERSTOP_RIDER_DATABASE_URL`, `_ADDR :8081`, `_SESSION_PEPPER`, `_WEB_ORIGINS` 5173 to 5175, `_CORE_URL http://localhost:8080`, `_CORE_SERVICE_TOKEN`), `SHOPPERSTOP_CORE_SERVICE_TOKENS` and `:5175` origin added to `CORE_ENV`, `rider` and `rider-app` targets, `seed` also runs rider `migrate` and `seed-demo --reset`, `dev` runs five servers, `test-rider` (gofmt, vet, race on `shopperstop_rider_test`) in `test`, `E2E_ENV` adds the rider values (`shopperstop_rider_e2e`, `:18081`, core URL `http://localhost:18080`, origins 15173 to 15175), `e2e` migrates and seeds rider too, `gen` runs rider's sqlc and `gen:api` for both contracts, `prod-local` builds rider. `scripts/postman.mjs` takes the service as an argument and writes `docs/postman/shopperstop-rider.postman_collection.json` (token variable `riderToken` for `/auth` and `/me*`, `staffToken` under `/admin/`, `customerToken` elsewhere; id variables `riderId`, `deliveryId`); the environment gains `riderBaseUrl` and those three; `make postman` and its tests cover both. CI: `rider` job (like `core`, guarded by `hashFiles('services/rider/go.mod')`), `web` job unchanged (workspaces), `e2e` guard includes `apps/rider`. README (rider URLs, demo riders, D33 one-liner), CLAUDE.md (area, layout, commands), `.claude/commands/orchestrate.md` and `manage.md` area lists, `.claude/areas/README.md` unchanged |
