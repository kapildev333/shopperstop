# platform-P1-L9 - CI workflow and full Makefile (OpenSpec change platform-ci-makefile)
Status: started
## Doing
Task 2 (ci.yml) written and gated; committing on the branch. Task 3 is the area manager's (runtime evidence).
## Found
- Task 1 red (1.1), unchanged tree, `make test`:
  ```
  make: *** No rule to make target `test'.  Stop.
  ```
- Task 1 gates (1.3 to 1.5), worker run on the branch:
  - 1.3 tree gate, every target prints only its skip line(s) and exits 0 (`test`, `test-core`, `test-web`, `seed`, `core`, `ui`, `web`, `admin`, `e2e`, `gen`, `postman`, `prod-local`).
  - 1.4 `make -n dev` prints `make db`, the compose line, `make seed` (migrate, then `seed-demo --reset`, core env inline), `make -j3 core web admin`, with the `core` recipe carrying `SHOPPERSTOP_CORE_ADDR=':8080'` and `shopperstop_core?sslmode=disable`. `make -n db` diffs empty against `origin/main`'s Makefile.
  - 1.5 scratch copy with `services/core apps/web apps/admin packages/ui`: `SHOPPERSTOP_CORE_DATABASE_URL=leak make -n e2e | grep -c leak` gives `0`; output has `shopperstop_core_e2e` (2 hits) and `':18080'`. `make -n core SHOPPERSTOP_CORE_ADDR=:9090` gives `SHOPPERSTOP_CORE_ADDR=':9090'`. `make -n web` prints the `packages/ui` build line first, then `npm run dev --workspace apps/web`. `make -n prod-local` prints build, compose `--profile prod`, migrate, core, in that order. `make gen` prints `gen: services/core/sqlc.yaml absent, skipping`. With an unformatted `services/core/x.go`, `make test-core` prints `x.go` and exits 2 (`make: *** [test-core] Error 1`).
  - Scratch artifact, not a Makefile bug: in the scratch copy `packages/ui` exists but has no `package.json`, so the second `gen` recipe (`npm run gen:api`) errors with ENOENT after its skip-free sqlc line. Real trees have the root `package.json`.
- Guard hook also rejects `git fetch` (lane rule: no pull or fetch); `origin/main` was read from the existing remote-tracking ref.
- Change `openspec/changes/platform-ci-makefile/`: proposal, `specs/platform/spec.md` (ADDED only, 11 requirements, no name clash with the 9 on main or core's 6), design (full Makefile and ci.yml text), tasks. `openspec validate --all --strict`: 3 passed. No `docs/design/platform-P1-L9.md`: design.md is enough.
- Both artifacts prototyped in scratch before writing the design: every target prints only skip lines and exits 0 on this tree; `make -n dev` shows db, migrate, seed-demo, core/ui/web/admin; a shell-exported dev database URL never reaches `make -n e2e`; unformatted Go fails `test-core`; ci.yml parses with the four jobs.
- Guard hook: any Bash command whose text contains the compose command is denied, heredocs included. Workers write the Makefile with Write/Edit; gates use `make -n` only for db, dev, prod-local.
- YAML gotcha: `run: echo "core: ..."` is invalid (colon-space in a plain scalar); quote the whole value.
- npm: `--workspaces` errors `No workspaces found!` when no workspace exists, and runs in the `workspaces` array order (packages first). The root `build` script names all three workspaces and fails on a partial tree, so make and CI use `npm run build --workspaces --if-present`.
- ui request folded in: `ui` target builds packages/ui before web, admin, test-web (once under `make -j3`); Node floor 22.12, CI uses setup-node `22`.
- Contract for web and admin: each app's `e2e` npm script; Playwright `webServer` starts core (inherits the env `make e2e` sets) and `vite preview` on 15173 (web) and 15174 (admin), proxying `/api` to core on 18080; Chromium only.
- Contract for core: `core-admin seed-demo --reset` is called by `make seed`, `make dev`, `make e2e`.
- Task 2 red (2.2 before the file exists, unchanged tree):
  ```
  FileNotFoundError: [Errno 2] No such file or directory: '.github/workflows/ci.yml'
  ```
- Task 2 gates (ci.yml written verbatim from design.md "The workflow"):
  - 2.2 shape check: `ok`
  - 2.3 `uses:` pins: every `uses: actions/...` is `@v4` (checkout, setup-node) or `@v5` (setup-go); `run: 'echo "...absent, skipping"'` quoted on all three skip lines (core, web, e2e).
  - 2.3 `openspec validate --all --strict`: `Totals: 3 passed, 0 failed (3 items)`.
  - YAML parse: `d[True]` holds the `on` key under PyYAML; the check reads both keys.
  - Not run: `act`, `actionlint` (not installed, no dependency added). Behaviour is verified by the PR's CI run (task 3.1).
## Requests
- to core (via platform manager and orchestrator): `core-admin seed-demo --reset` must exist and exit 0 before `make dev` and `make e2e` can pass with services/core present; recommended a Phase 1 stub that prints `seed-demo: no demo data yet` and exits 0.
- to web, admin (via orchestrator): the `e2e` script and Playwright webServer contract above.
- to platform (same area, separate chore): root `package.json` `build` script to `npm run build --workspaces --if-present`; engines `>=22.12.0` (ui's request).
## Blockers
