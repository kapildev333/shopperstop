## 1. Deploy files and make db (worker lane platform-P1-L4, one task)

Scope: `deploy/docker-compose.yml`, `deploy/initdb.sql`, `deploy/Caddyfile`, `Makefile`, this file's checkboxes.
Scenarios: every scenario in `specs/platform/spec.md`.
Test first: none. Why: the files are configuration whose behaviour is a running container, and lanes may not run `docker compose` (guard hook); there is no Go module, Node package or CI job yet to host a test. Static checks below stand in; runtime scenarios are the orchestrator's (plan Task 4 step 2) and CI's from Task 12.
Commit: one commit, `chore: postgres compose, initdb roles and databases, caddyfile`.

- [ ] 1.1 Write `deploy/docker-compose.yml`, `deploy/initdb.sql`, `deploy/Caddyfile` and `Makefile` byte for byte from plan Task 4 step 1 (Caddyfile and Makefile recipe lines indented with a tab)
- [ ] 1.2 Static gates pass: `make -n db` prints `docker compose -f <worktree>/deploy/docker-compose.yml up -d --wait postgres`; `grep -c '^create' deploy/initdb.sql` prints `4`; the Makefile recipe and Caddyfile indentation are tabs (`grep -c "$(printf '^\t')" Makefile` prints `1`; macOS grep has no `-P`); `git status --short` shows only the four files plus `tasks.md`
- [ ] 1.3 Runtime gate, orchestrator only (lanes skip): `make db`, then `docker ps --format '{{.Names}}' | grep shopperstop-postgres-1`, then `PGPASSWORD=shopperstop_core psql -h localhost -U shopperstop_core -d shopperstop_core_test -c 'select 1'` returns `1`
