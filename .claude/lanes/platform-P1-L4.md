# platform-P1-L4 - deploy files and make db (OpenSpec change platform-deploy-db)
Status: done
## Doing
## Found
- Change `openspec/changes/platform-deploy-db/`: proposal, `specs/platform/spec.md` (ADDED: One database and owner role per service; make db starts Postgres and waits for health; Caddy runs only under the prod profile), design, tasks (one task). `openspec validate platform-deploy-db --strict` passes.
- No overlap with platform-P1-L3's requirement names or paths (L3 touches only `openspec/specs` and docs). The delta is ADDED against `platform`, which exists only in L3's worktree; after L3 merges, re-run `openspec validate --all --strict` on main.
- The guard hook denies every `docker compose` command, including `config`; the worker's gates are `make -n db` and greps only.
- Acceptance (/opsx:verify) passed 2026-10-12: tasks 1.1 to 1.3 done; all six scenarios covered by the committed files or the runtime evidence below; diff limited to the four deploy files, the change folder and this log.
- Runtime gate 1.3, run by the orchestrator from this worktree on 2026-10-12 (`psql` is not installed on the host, so the check used a Go pgx client; same SQL, same result):
  ```
  make db
   Container shopperstop-postgres-1  Started
   Container shopperstop-postgres-1  Waiting
   Container shopperstop-postgres-1  Healthy
  docker ps --format '{{.Names}} {{.Status}}' | grep shopperstop
  shopperstop-postgres-1 Up 2 seconds (healthy)
  (no caddy container listed)
  pgx client as shopperstop_core/shopperstop_core on localhost:5432/shopperstop_core_test:
  select 1 -> 1
  select datname from pg_database where pg_get_userbyid(datdba) = 'shopperstop_core' order by 1:
  owned: shopperstop_core
  owned: shopperstop_core_e2e
  owned: shopperstop_core_test
  ```
## Requests
## Blockers
