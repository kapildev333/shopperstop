# platform-P3-L1-T1 - deploy files and Makefile (OpenSpec change platform-rider-wiring, tasks 1.1 to 1.6)
Status: done (committed as `feat: rider databases, caddy routes and make targets`; not pushed)
## Doing
Done. Waiting for the reviewer and the area manager to land it with tasks 2 and 3.
## Found
- Red (1.1, unchanged tree, `sh openspec/changes/platform-rider-wiring/check-wiring.sh deploy make`): `wiring check: 45 failures`. First five FAIL lines:
  - `FAIL: deploy/initdb.sql is not the eight statements`
  - `FAIL: Caddyfile lacks: handle /api/rider/* {`
  - `FAIL: Caddyfile lacks: reverse_proxy host.docker.internal:8081`
  - `FAIL: Caddyfile lacks: root * /srv/apps/admin/dist`
  - `FAIL: Caddyfile lacks: handle /rider/* {`
- Green (1.3): `wiring check: ok`.
- 1.4 pgx (throwaway `main.go` in the scratchpad, run from `services/core`): `select 1` as `shopperstop_rider` on `shopperstop_rider_test` prints `1`; the owned-database query prints `shopperstop_rider`, `shopperstop_rider_e2e`, `shopperstop_rider_test`.
- 1.5 gates: `make test-core` exit 0 (`ok .../services/core/internal/store`); `make -n e2e` prints the core/web/admin branch and `e2e: services/rider absent, skipping`; `make -n dev` prints `-j5 core rider web admin rider-app` with the core, rider and three app commands; `make gen` prints `gen: services/rider/sqlc.yaml absent, skipping`, runs core sqlc and `openapi-typescript`, and leaves `core.d.ts` identical; `openspec validate --all --strict`: `Totals: 15 passed, 0 failed (15 items)`.
- The `db` target is byte-identical to `origin/main`; compose diff is only the `../apps:/srv/apps:ro` line.
- Makefile recipe lines are tab-indented (the wiring script's `make` section also runs them).
## Requests
- to platform-P3-L1 (team lead): nothing new; the design was followed without deviation.
## Blockers
none
