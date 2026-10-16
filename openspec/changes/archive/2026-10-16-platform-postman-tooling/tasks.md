Two worker tasks in sequence on `lane/platform-P4-L3-postman-tooling`, then acceptance. Briefs: `.claude/lanes/platform-P4-L3-T1.md`, `.claude/lanes/platform-P4-L3-T2.md`.

## 1. Generator, environment and collections (worker T1)

Scope: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/`. Scenarios: "Service route", "Core service routes", "Saved responses read the same ids", "Parameter without an example", "Default and enum fill a missing example", "Environment variables", "Service token is the dev token", "Two runs give identical bytes". Failing tests: `scripts/postman.test.mjs` `service routes read serviceToken`, `core service routes follow x-service-token`, `saved responses read environment ids`, `parameters without an example get a fixed value`, `environment holds the twelve variables`, `serviceToken is the Makefile dev service token` (design.md, Test strategy).

- [x] 1.1 `test:` the six tests; `node --test scripts/postman.test.mjs` fails on exactly them (record the red in the lane log)
- [x] 1.2 `feat:` `fillExamples`, the `originalRequest` id rewrite and `serviceOps` in `scripts/postman.mjs` (design.md 1 to 3); `serviceToken` appended to `docs/postman/local.postman_environment.json` (design.md 4); `make postman` regenerates both collections, committed in the same commit
- [x] 1.3 Gates: `make postman` twice, `git status --porcelain` empty after the second; `make test-core` and `make test-rider` (their seed tests read the environment file); `openspec validate --all --strict`

## 2. make gen and README (worker T2)

Scope: `Makefile`, `README.md`. Scenarios: "Rider sqlc between core sqlc and the API types", "make gen leaves the tree clean", "Troubleshooting names the crash and the workaround", "README names the tokens step and the service token". Failing test: `sh openspec/changes/platform-postman-tooling/check-tooling.sh` (committed with the proposal; no `test:` commit of its own).

- [x] 2.1 Red: run the check on the branch head, record its FAIL lines in the lane log
- [x] 2.2 `feat:` the `make gen` line (design.md 5) and the three README edits (design.md 6), text as written there
- [x] 2.3 Gates: the check prints `tooling check: ok`; `sh openspec/changes/archive/2026-10-12-platform-readme-claude/check-docs.sh` and `sh openspec/changes/archive/2026-10-16-platform-mobile-readme-spec/check-readme-mobile.sh` still pass (the archived `check-mobile-wiring.sh` already fails on `main`, superseded by that change); `make -n gen`; `openspec validate --all --strict`

## 3. Acceptance

- [x] 3.1 Team lead: `/opsx:verify`: every scenario in the delta maps to a passing test or check line, tasks 1 and 2 ticked, `git diff --stat origin/main...HEAD` holds only the files in design.md
- [x] 3.2 Manager: re-run the gates of 1.3 and 2.3 in the worktree; record in the lane status cell
- [x] 3.3 Manager: archive after merge
