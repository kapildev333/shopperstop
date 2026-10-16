Every task runs in the worktree `.worktrees/platform-P3-L1` on branch `lane/platform-P3-L1-rider-wiring`, one after the other (1, 2, 3), with `PATH=~/.local/node-v22.23.3/bin:$PATH` and `node_modules` already installed. Each worker keeps its own log `.claude/lanes/platform-P3-L1-T<n>.md` and never runs `make db`, `make dev`, `make prod-local` or `make seed` without `-n`. The guard hook denies any Bash command whose text contains the compose command, `docker-compose` or `docker exec` (heredocs and `git add deploy/docker-compose.yml` included): write such files with the Write or Edit tool and stage with `git add deploy`.

The test for tasks 1 and 3 is `check-wiring.sh` in this folder, committed with the change before any worker starts (design.md Decision 12): the red step is that script failing on the unchanged tree, recorded in the worker's log, and the task's commit is `feat:`. Task 2 has a test framework (`node --test`) and commits `test:` then `feat:`.

## 1. Deploy files and Makefile (worker)

Scope: `deploy/initdb.sql`, `deploy/Caddyfile`, `deploy/docker-compose.yml`, `Makefile`, this file's 1.x checkboxes, `.claude/lanes/platform-P3-L1-T1.md`.
Scenarios: "One database and owner role per service" (initdb holds four statements per service; the two rider pgx scenarios), "Caddy runs only under the prod profile" (the three prefixes, the rider prefixes, one app mount), "Rider make targets skip while the rider is absent" (both), "make dev runs the rider service and app" (all four), "make test runs the rider gates" (both), "make e2e gives the rider an isolated environment" (both), "make gen runs the rider sqlc", "make prod-local runs the rider behind Caddy".
Starts from: `sh openspec/changes/platform-rider-wiring/check-wiring.sh deploy make`, failing on the unchanged tree.
Commit: `feat: rider databases, caddy routes and make targets`.

- [x] 1.1 Red: run `sh openspec/changes/platform-rider-wiring/check-wiring.sh deploy make` on the unchanged tree; paste the last line (`wiring check: N failures`) and the first five FAIL lines into the log
- [x] 1.2 Write the four files exactly as design.md "The files" (initdb: append the four lines; Caddyfile: whole file; compose: the two caddy app mounts become `- ../apps:/srv/apps:ro`; Makefile: whole file, tab-indented recipes); `git diff origin/main -- deploy/docker-compose.yml` shows only that mount change and `git diff origin/main -- Makefile` leaves the `db` target untouched
- [x] 1.3 Green: `sh openspec/changes/platform-rider-wiring/check-wiring.sh deploy make` prints `wiring check: ok`; paste it
- [x] 1.4 Database: from `services/core`, a throwaway pgx program (a `main.go` in the scratchpad, run with `go run <abs path>/main.go <url> <sql>`) prints `1` for `select 1` as `shopperstop_rider` on `shopperstop_rider_test`, and `shopperstop_rider`, `shopperstop_rider_e2e`, `shopperstop_rider_test` for `select datname from pg_database where pg_get_userbyid(datdba) = 'shopperstop_rider' order by 1`; paste both outputs
- [x] 1.5 Today's targets unchanged: `make test-core` passes; `make -n e2e` and `make -n dev` still print every core, web and admin command; `make gen` prints `gen: services/rider/sqlc.yaml absent, skipping` and leaves `git status --short` with only this task's files; `openspec validate --all --strict` passes. Paste the summaries
- [x] 1.6 `git status --short` before the commit shows only the four files, this file and the log

## 2. Postman collection per service (worker, after task 1)

Scope: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/local.postman_environment.json`, this file's 2.x checkboxes, `.claude/lanes/platform-P3-L1-T2.md`. No `docs/postman/shopperstop-rider.postman_collection.json` (no rider contract yet).
Scenarios: "Postman collection is generated from the contract" (Rider URLs read the rider base URL, Rider skipped while its contract is absent, Committed rider collection matches the rider contract; the three core scenarios keep passing), "Postman requests authenticate from environment tokens" (Rider routes), "Sign-in requests store the returned token" (Rider sign-in), "Path ids read environment variables" (Rider and delivery ids, Slug keeps its example), "Local Postman environment" (Environment variables, Rider ids are fixed).
Starts from: `scripts/postman.test.mjs` tests `rider URLs read the rider base URL`, `rider routes read their tokens`, `rider sign-in stores riderToken`, `rider and delivery ids read environment variables`, `rider collection follows the rider contract`, `postman CLI skips an absent rider contract`, `environment holds the eleven variables`, and the rider case of `two runs give identical bytes with no generated ids`, as design.md "scripts/postman.test.mjs" lists them.
Commits: `test: rider postman collection and environment`, then `feat: postman collection per service with rider tokens and ids`.

- [ ] 2.1 Write the tests and the `riderFixture` from design.md into `scripts/postman.test.mjs`; run `node --test scripts/postman.test.mjs`: the new rider tests and the environment test fail, the existing core tests pass. Paste the `# pass` / `# fail` lines and the failing test names into the log; commit `test: ...`
- [ ] 2.2 Write `scripts/postman.mjs` exactly as design.md "scripts/postman.mjs" and append the four environment variables as design.md says
- [ ] 2.3 Green: `node --test scripts/postman.test.mjs` all pass; `make postman` twice prints `postman: services/rider/openapi.json absent, skipping` and leaves `git diff -- docs/postman/shopperstop-core.postman_collection.json` empty; `ls docs/postman` shows no rider collection; `make test-core` passes (its seed test reads the environment file); `openspec validate --all --strict` passes. Paste the outputs; commit `feat: ...`

## 3. CI rider job, README and CLAUDE.md (worker, after task 1)

Scope: `.github/workflows/ci.yml`, `README.md`, `CLAUDE.md`, this file's 3.x checkboxes, `.claude/lanes/platform-P3-L1-T3.md`.
Scenarios: "CI runs a rider job" (Workflow shape with the rider job; Rider tests reach the CI database, by the job's env and step order), "Repository documentation matches the tree" (all seven).
Starts from: `sh openspec/changes/platform-rider-wiring/check-wiring.sh ci docs`, failing on the tree after task 1.
Commit: `feat: rider ci job and docs`.

- [ ] 3.1 Red: run `sh openspec/changes/platform-rider-wiring/check-wiring.sh ci docs`; paste the last line and the FAIL lines into the log
- [ ] 3.2 Insert the `rider` job from design.md between `core` and `web` in `ci.yml` (no other job changes); edit `README.md` and `CLAUDE.md` as design.md "README.md and CLAUDE.md" says, in the files' existing voice, no new sections beyond the "Cloned before Phase 3?" paragraph, no link to a path that does not exist
- [ ] 3.3 Green: `sh openspec/changes/platform-rider-wiring/check-wiring.sh` (every section) prints `wiring check: ok`; `sh openspec/changes/archive/2026-10-12-platform-readme-claude/check-docs.sh` prints `docs check: ok`; `openspec validate --all --strict` passes. Paste the outputs
- [ ] 3.4 `git status --short` before the commit shows only the three files, this file and the log

## 4. Manager verification and runtime evidence (area manager, not a worker)

- [ ] 4.1 Re-run on the branch: `sh openspec/changes/platform-rider-wiring/check-wiring.sh`, `node --test scripts/postman.test.mjs`, `make test`, `make postman` twice (tree clean), `openspec validate --all --strict`
- [ ] 4.2 One `make e2e` (take the slot per D35): `E2E_ENV` gained rider values and the `:15175` origin; admin and web suites stay green with the extra env and the `e2e: services/rider absent, skipping` line
- [ ] 4.3 Pending until the rider area lands, recorded here by the orchestrator at phase close: a fresh volume gets the rider role and databases from `initdb.sql` (CI `rider` job once billing is fixed, or a fresh-clone `make dev`); `make dev` reaches four servers and the rider app and Ctrl-C stops all of them; `make prod-local` serves `/rider/` and `/api/rider/`
