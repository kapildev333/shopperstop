Every task runs in the worktree `.worktrees/platform-P5-L1` on branch `lane/platform-P5-L1-payment-wiring`, one after the other (1, 2, 3). Run `npm ci` once in the worktree if `node_modules` is absent. Each worker keeps its own log `.claude/lanes/platform-P5-L1-T<n>.md` and never runs `make db`, `make dev`, `make prod-local`, `make seed` or `make rider` without `-n`, and never runs the archived `platform-rider-wiring/check-wiring.sh` (its real `make rider` starts the rider server now that `services/rider` exists). The guard hook denies any Bash command whose text contains the compose command, `docker-compose` or `docker exec`: edit such files with the Edit tool and stage with `git add -A`.

The test for tasks 1 and 3 is `check-payment-wiring.sh` in this folder, committed with the change before any worker starts (design.md Decision 11): the red step is that script failing on the unchanged tree, recorded in the worker's log, and the task's commit is `feat:`. Task 2 has a test framework (`node --test`) and commits `test:` then `feat:`.

## 1. Deploy files and Makefile (worker)

Scope: `deploy/initdb.sql`, `deploy/Caddyfile`, `Makefile`, this file's 1.x checkboxes, `.claude/lanes/platform-P5-L1-T1.md`.
Scenarios: "One database and owner role per service" (initdb holds four statements per service; the two payment pgx scenarios), "Caddy routes each prefix to its service or app" (Caddyfile routes the payment prefix), "Payment make targets skip while the payment service is absent" (both), "make dev runs the rider service and app" (Dry run shows five servers, now six with payment; Core accepts the rider's dev token), "make dev runs the payment service" (all three), "Dev origins include the mobile web export", "make test runs the payment gates" (both), "make e2e gives the rider an isolated environment" (e2e core accepts the e2e rider token, now with the payment entry; e2e services accept the mobile web export preview), "make e2e gives the payment service an isolated environment", "make gen runs the rider sqlc" (the three-service order), "make prod-local runs the payment service behind Caddy".
Starts from: `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh deploy make`, failing on the unchanged tree.
Commit: `feat: payment databases, caddy route and make targets`.

- [x] 1.1 Red: run `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh deploy make` on the unchanged tree; paste the last line (`payment wiring check: N failures`) and the first five FAIL lines into the log
- [x] 1.2 Write the three files exactly as design.md "The files" (initdb: append the four lines; Caddyfile: insert the block after `/api/rider/*`; Makefile: whole file, tab-indented recipes); `git diff origin/main -- Makefile` leaves the `db` target untouched; `deploy/docker-compose.yml` is not touched
- [x] 1.3 Green: `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh deploy make` prints `payment wiring check: ok`; paste it
- [x] 1.4 Database: from `services/core`, a throwaway pgx program (a `main.go` in the scratchpad, run with `go run <abs path>/main.go <url> <sql>`) runs `select 1` as `shopperstop_payment` on `shopperstop_payment_test`, and `select datname from pg_database where pg_get_userbyid(datdba) = 'shopperstop_payment' order by 1` as `shopperstop_core` on `shopperstop_core_test`; paste both outputs. If the role is missing (D33 not applied yet), paste the error and say so in the log; do not create the role yourself
- [x] 1.5 Today's targets unchanged: `make test-core` and `make test-rider` pass; `make -n e2e` and `make -n dev` still print every core, rider, web and admin command; `make gen` prints `gen: services/payment/sqlc.yaml absent, skipping` and leaves `git status --short` with only this task's files; `sh openspec/changes/archive/2026-10-16-platform-postman-tooling/check-tooling.sh make` prints ok; `openspec validate --all --strict` passes. Paste the summaries
- [x] 1.6 `git status --short` before the commit shows only the three files, this file and the log

## 2. Postman collection and environment for payment (worker, after task 1)

Scope: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/local.postman_environment.json`, this file's 2.x checkboxes, `.claude/lanes/platform-P5-L1-T2.md`. No `docs/postman/shopperstop-payment.postman_collection.json` (no payment contract yet).
Scenarios: "Postman collection is generated from the contract" (Payment URLs read the payment base URL), "Postman skips a service without a contract" (Payment skipped while its contract is absent, Committed payment collection matches the payment contract), "Postman requests authenticate from environment tokens" (Payment routes), "Path ids read environment variables" (Payment ids), "Local Postman environment" (Environment variables), "Postman environment carries the payment variables".
Starts from: `scripts/postman.test.mjs` tests `payment URLs read the payment base URL`, `payment routes read the customer token`, `payment ids read environment variables`, `payment collection follows the payment contract`, `postman CLI skips an absent payment contract`, `environment holds the fourteen variables`, and the payment case of `two runs give identical bytes with no generated ids`, exactly as design.md "scripts/postman.test.mjs" gives them.
Commits: `test: payment postman collection and environment`, then `feat: postman collection and environment for payment`.

- [x] 2.1 Write the fixture and tests from design.md into `scripts/postman.test.mjs`; run `node --test scripts/postman.test.mjs`: six tests fail (`payment URLs read the payment base URL`, `payment routes read the customer token`, `payment ids read environment variables`, `postman CLI skips an absent payment contract`, `two runs give identical bytes with no generated ids`, `environment holds the fourteen variables`), the rest pass. Paste the `# pass` / `# fail` lines and the failing names into the log; commit `test: ...`
- [x] 2.2 Add the two lines to `scripts/postman.mjs` and the two environment variables as design.md says
- [x] 2.3 Green: `node --test scripts/postman.test.mjs` 27 pass, 0 fail; `make postman` twice prints `postman: services/payment/openapi.json absent, skipping` and leaves `git diff -- docs/postman/shopperstop-core.postman_collection.json docs/postman/shopperstop-rider.postman_collection.json` empty; `ls docs/postman` shows no payment collection; `make test-core` and `make test-rider` pass (their seed tests read the environment file); `openspec validate --all --strict` passes. Paste the outputs; commit `feat: ...`

## 3. CI payment job, docs and area lists (worker, after task 1)

Scope: `.github/workflows/ci.yml`, `README.md`, `CLAUDE.md`, `.claude/commands/orchestrate.md`, `.claude/commands/manage.md`, `openspec/config.yaml`, this file's 3.x checkboxes, `.claude/lanes/platform-P5-L1-T3.md`.
Scenarios: "CI runs a rider job" (Workflow shape with the rider job), "CI runs a payment job" (both), "Repository documentation matches the tree" (all), "CLAUDE.md and docs/figma.md describe the tree" (all), "Area lists name the payment area".
Starts from: `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh ci docs`, failing on the tree after task 1.
Commit: `feat: payment ci job, docs and area lists`.

- [x] 3.1 Red: run `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh ci docs`; paste the last line and the FAIL lines into the log
- [x] 3.2 Insert the `payment` job from design.md between `rider` and `web` in `ci.yml` (no other job changes); apply every find-and-replace of design.md "README.md, CLAUDE.md, .claude/commands/*.md, openspec/config.yaml" with the Edit tool; nothing else in those files changes
- [x] 3.3 Green: `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh` (every section) prints `payment wiring check: ok`; `openspec validate --all --strict` passes. Paste the outputs
- [x] 3.4 `git status --short` before the commit shows only the six files, this file and the log

## 4. Manager verification and runtime evidence (area manager, not a worker)

- [ ] 4.1 Re-run on the branch: `sh openspec/changes/platform-payment-wiring/check-payment-wiring.sh`, `node --test scripts/postman.test.mjs`, `make test`, `make postman` twice (tree clean), `make gen` (tree clean), `openspec validate --all --strict`
- [x] 4.2 Database: after the orchestrator applied the payment statements (D33), the pgx checks of 1.4 print `1` and exactly `shopperstop_payment`, `shopperstop_payment_e2e`, `shopperstop_payment_test`
- [ ] 4.3 One `make e2e` (take the slot per D35): `E2E_ENV` gained payment values; every suite stays green with the `e2e: services/payment absent, skipping` line and core accepting the two-entry e2e token list
- [ ] 4.4 Pending until the payment area lands, recorded by the orchestrator at phase close: a fresh volume gets the payment role and databases from `initdb.sql` (CI `payment` job once billing is fixed, or a fresh-clone `make dev`); `make dev` reaches six servers and Ctrl-C stops all of them; `make prod-local` serves `/api/payment/`
