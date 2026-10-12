# platform-P1-L4 - deploy files and make db (OpenSpec change platform-deploy-db)
Status: started
## Doing
Change proposed and validated; waiting for worker task 1, then /opsx:verify acceptance.
## Found
- Change `openspec/changes/platform-deploy-db/`: proposal, `specs/platform/spec.md` (ADDED: One database and owner role per service; make db starts Postgres and waits for health; Caddy runs only under the prod profile), design, tasks (one task). `openspec validate platform-deploy-db --strict` passes.
- No overlap with platform-P1-L3's requirement names. The delta is ADDED against `platform`, which exists only in L3's worktree; after L3 merges, re-run `openspec validate --all --strict` on main.
- The guard hook denies every `docker compose` command, including `config`; the worker's gates are `make -n db` and greps only.
- `openspec/config.yaml` `rules.tasks` items contain unquoted `: ` and parse as mappings; the CLI warns and ignores the tasks rules. Fix belongs to whoever owns `openspec/` next (not in this lane's scope).
## Requests
- to orchestrator: run plan Task 4 step 2 (`make db`, `docker ps`, `psql ... select 1`) after the worker lands; Docker daemon is not running now.
## Blockers
