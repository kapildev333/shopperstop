## 1. Makefile targets (worker, lane platform-P1-L9, task 1)

Scope: `Makefile`, this file's 1.x checkboxes. Scenarios: platform "Make targets skip absent parts" (both), "make dev runs the whole stack" (dry run, override), "Apps build against a fresh packages/ui" (both, by recipe order), "make test runs core then web gates" (both), "make e2e is isolated from dev", "make gen and make postman regenerate committed files" (both), "make prod-local serves the builds through Caddy".
Test first: none committed. Why: there is no test framework for a Makefile and none may be added (CLAUDE.md dependency rule). The red step is behavioural: before editing, `make test` fails with `No rule to make target`; paste that output into the lane log. Never run `make db`, `make dev` or `make prod-local` without `-n` (they start containers; the guard hook denies it). Write the Makefile with the Write or Edit tool, not a Bash heredoc: the guard hook rejects any Bash command whose text contains the compose command.
Commit: one commit, `feat: makefile dev, test, e2e, gen, postman and prod-local targets with skip guards`.

- [ ] 1.1 Red: run `make test` on the unchanged tree, record the `No rule to make target` output in the lane log
- [ ] 1.2 Write `Makefile` exactly as design.md "The Makefile" (recipe lines start with a tab); the header comment, `SHELL` line and `db` target are byte-identical to `origin/main` (`git diff origin/main -- Makefile` shows only added lines and the `.PHONY` line)
- [ ] 1.3 Green on this tree: `for t in test e2e gen postman seed core ui web admin prod-local; do make $t; echo "[$t $?]"; done` prints only `<target>: <path> absent, skipping` lines and `[<t> 0]` for every target
- [ ] 1.4 `make -n dev` prints the `$(MAKE) db` compose line, `go run ./cmd/core-admin migrate`, `go run ./cmd/core-admin seed-demo --reset`, then the `core`, `ui`, `web`, `admin` recipes, the core ones carrying `SHOPPERSTOP_CORE_ADDR=':8080'` and the `shopperstop_core?sslmode=disable` URL; `make -n db` output is unchanged from `origin/main`
- [ ] 1.5 Present-directory checks in a scratch copy (copy the Makefile into an empty scratch directory, `mkdir -p services/core apps/web apps/admin packages/ui`): `SHOPPERSTOP_CORE_DATABASE_URL=leak make -n e2e | grep -c leak` prints `0` and the output contains `shopperstop_core_e2e` and `':18080'`; `make -n core SHOPPERSTOP_CORE_ADDR=:9090` contains `SHOPPERSTOP_CORE_ADDR=':9090'`; `make -n web` prints the `npm run build --workspace packages/ui` recipe before `npm run dev --workspace apps/web`; `make -n prod-local` prints build, compose `--profile prod`, migrate, core in that order; `make gen` prints `gen: services/core/sqlc.yaml absent, skipping`; with `printf 'package x\nfunc  f(){}\n' > services/core/x.go`, `make test-core` prints `x.go` and exits non-zero. Paste the outputs into the lane log
- [ ] 1.6 `git status --short` shows only `Makefile`, this file and the lane log

## 2. CI workflow (worker, lane platform-P1-L9, task 2, after task 1 on the same branch)

Scope: `.github/workflows/ci.yml`, this file's 2.x checkboxes. Scenarios: platform "CI runs four jobs", "CI jobs skip absent directories", "CI core job gates core and generated files" (both), "CI web, e2e and spec jobs" (both), and the CI half of "Apps build against a fresh packages/ui".
Test first: none committed. Why: `act` and `actionlint` are not installed and no dependency may be added; the workflow's behaviour is only observable on GitHub. The red step: 2.2's check run before the file exists fails with `FileNotFoundError`; record it in the lane log.
Commit: one commit, `feat: ci workflow with core, web, e2e and spec jobs`.

- [ ] 2.1 Write `.github/workflows/ci.yml` exactly as design.md "The workflow" (every skip `run:` value quoted as a whole: `run: 'echo "core: services/core absent, skipping"'`)
- [ ] 2.2 Shape check passes: `python3 -c "import yaml;d=yaml.safe_load(open('.github/workflows/ci.yml'));on=d.get('on',d.get(True));assert d['name']=='ci' and list(d['jobs'])==['core','web','e2e','spec'] and 'pull_request' in on and on['push']['branches']==['main'];print('ok')"` prints `ok`
- [ ] 2.3 `grep -c "uses: actions/" .github/workflows/ci.yml` lists only `@v4`/`@v5` majors; `openspec validate --all --strict` passes; `git status --short` shows only `ci.yml`, this file and the lane log

## 3. Runtime evidence (area manager, not a worker)

- [ ] 3.1 On the PR: `ci` runs four jobs, all green; the `core`, `web` and `e2e` logs show their skip lines (scenario "Foundation tree is green"). Paste the run URL into the lane log
- [ ] 3.2 Pending until the contracts land, checked on those PRs' CI runs and recorded here by the manager: stale Postman collection fails `core` (after platform Task 12), core tests reach the CI database (after core task 3), failing ui test fails `web` (after ui lands), `make dev` reaches three servers and Ctrl-C stops them (orchestrator at phase close)
