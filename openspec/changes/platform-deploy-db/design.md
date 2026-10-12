## Context

Plan Task 4 (`docs/plans/2026-10-12-foundation-and-design-system.md`) gives the four files verbatim; Spec 1 §3, §4 and §7 fix the layout, the one-database-per-service rule and `make db`. Lanes may not run `docker compose` (guard hook), so the runtime check is the orchestrator's.

## Goals / Non-Goals

**Goals:** a local Postgres 16 with the core role and its three databases, started by `make db`; a Caddyfile ready for the later `prod-local` target.

**Non-Goals:** other Makefile targets (Task 13), CI Postgres (Task 12), env files, helper scripts, TLS, roles for later services.

## Decisions

- Copy the plan's four files byte for byte. The plan is approved; any deviation is a new decision for the owner.
- `initdb.sql` uses plain `create role` / `create database` with no `if not exists` guards: the Postgres entrypoint runs it only on an empty data volume, and CI runs it once on a fresh service. Ceiling: re-running it by hand on an initialised server errors; reset is `docker compose down -v` by the owner.
- Password equals role name (`shopperstop_core`) and the superuser password is `postgres`. Local and CI only; ceiling: any shared or deployed database needs real secrets, out of scope until the first real deploy (Spec 1 §13 deferrals).
- A third database `shopperstop_core_e2e` beyond Spec 1 §4's `_test`: the plan's interface keeps Playwright runs from clobbering `go test` data. Same owner, no extra cost.
- `make db` names the `postgres` service explicitly, so `up` never starts `caddy` even if someone adds a profile env var; `caddy` is also behind `profiles: ["prod"]`.
- Caddy reaches core through `host.docker.internal:8080`: core runs on the host, not in compose. Ceiling: on Linux hosts this needs `extra_hosts: host-gateway`; add it with `make prod-local` (Task 13) if a Linux machine needs it.

## Files

`deploy/docker-compose.yml`, `deploy/initdb.sql`, `deploy/Caddyfile`, `Makefile`. All in the platform area.

## Risks / Trade-offs

- Port 5432 may be taken by a host Postgres; `make db` then fails and the orchestrator reports it (no remapping).
- No automated test lands with this change: the files are configuration, and the only meaningful test (start Postgres, connect) is a container action lanes may not take. The spec scenarios are checked by the orchestrator's plan Task 4 step 2 and, from Task 12 on, by CI's core job loading `initdb.sql`.
