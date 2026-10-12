# platform-P1-L9 - CI workflow and full Makefile (OpenSpec change platform-ci-makefile)
Status: started
## Doing
Change written and validated; worker briefs for tasks 1 (Makefile) and 2 (ci.yml) handed to the platform manager, sequential on this branch.
## Found
- Change `openspec/changes/platform-ci-makefile/`: proposal, `specs/platform/spec.md` (ADDED only, 11 requirements, no name clash with the 9 on main or core's 6), design (full Makefile and ci.yml text), tasks. `openspec validate --all --strict`: 3 passed. No `docs/design/platform-P1-L9.md`: design.md is enough.
- Both artifacts prototyped in scratch before writing the design: every target prints only skip lines and exits 0 on this tree; `make -n dev` shows db, migrate, seed-demo, core/ui/web/admin; a shell-exported dev database URL never reaches `make -n e2e`; unformatted Go fails `test-core`; ci.yml parses with the four jobs.
- Guard hook: any Bash command whose text contains the compose command is denied, heredocs included. Workers write the Makefile with Write/Edit; gates use `make -n` only for db, dev, prod-local.
- YAML gotcha: `run: echo "core: ..."` is invalid (colon-space in a plain scalar); quote the whole value.
- npm: `--workspaces` errors `No workspaces found!` when no workspace exists, and runs in the `workspaces` array order (packages first). The root `build` script names all three workspaces and fails on a partial tree, so make and CI use `npm run build --workspaces --if-present`.
- ui request folded in: `ui` target builds packages/ui before web, admin, test-web (once under `make -j3`); Node floor 22.12, CI uses setup-node `22`.
- Contract for web and admin: each app's `e2e` npm script; Playwright `webServer` starts core (inherits the env `make e2e` sets) and `vite preview` on 15173 (web) and 15174 (admin), proxying `/api` to core on 18080; Chromium only.
- Contract for core: `core-admin seed-demo --reset` is called by `make seed`, `make dev`, `make e2e`.
## Requests
- to core (via platform manager and orchestrator): `core-admin seed-demo --reset` must exist and exit 0 before `make dev` and `make e2e` can pass with services/core present; recommended a Phase 1 stub that prints `seed-demo: no demo data yet` and exits 0.
- to web, admin (via orchestrator): the `e2e` script and Playwright webServer contract above.
- to platform (same area, separate chore): root `package.json` `build` script to `npm run build --workspaces --if-present`; engines `>=22.12.0` (ui's request).
## Blockers
