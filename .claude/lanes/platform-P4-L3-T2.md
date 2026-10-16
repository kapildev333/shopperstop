# platform-P4-L3-T2 - make gen runs gen:tokens, README troubleshooting and tooling notes (worker brief)
Status: not started (starts after T1 is committed)
## Brief
- LANE-ID: platform-P4-L3-T2 (team lead platform-P4-L3). Area: platform.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/platform-P4-L3. Branch: lane/platform-P4-L3-postman-tooling. Commit there as kapildev333 <47056817+kapildev333@users.noreply.github.com>, no attribution trailers; never push.
- Change and task: OpenSpec `platform-postman-tooling`, task 2 (`openspec/changes/platform-postman-tooling/tasks.md`). Read its `design.md` sections 5 and 6; the Makefile line and the README text there are exact, copy them.
- Scope: `Makefile` (the `gen` target's `packages/ui` line only), `README.md` (the `make gen` row, the `## API` paragraph, a new `## Troubleshooting` section between `## Commands` and `## API`), ticking task 2 in `tasks.md`, this file. Nothing else.
- Scenarios (spec delta `specs/platform/spec.md`): "Rider sqlc between core sqlc and the API types", "make gen leaves the tree clean", "Troubleshooting names the crash and the workaround", "README names the tokens step and the service token".
- Setup: `npm ci` at the worktree root if `node_modules` is absent (T1 runs it). `sqlc` v1.31.1 is on the PATH.
- Failing test to start from: `sh openspec/changes/platform-postman-tooling/check-tooling.sh` from the worktree root, already committed by the team lead with the proposal, so this task has no `test:` commit of its own. Run it on a clean tree before any edit and paste its FAIL lines here (expected: the `make -n gen` order line, and the Troubleshooting, make gen row and API lines).
- Commit: `feat: make gen runs gen:tokens; README troubleshooting and tooling notes` with `Makefile`, `README.md`, ticks 2.1 and 2.2.
- Gates (paste results here): `sh openspec/changes/platform-postman-tooling/check-tooling.sh` prints `tooling check: ok` (run it after committing, on a clean tree: its make section runs a real `make gen` and compares `git status`); `sh openspec/changes/archive/2026-10-12-platform-readme-claude/check-docs.sh`; `sh openspec/changes/archive/2026-10-16-platform-mobile-readme-spec/check-readme-mobile.sh`; `make -n gen`; `openspec validate --all --strict`. Then tick 2.3. Do not run the archived `check-mobile-wiring.sh` or `check-wiring.sh` (one fails on main already, the other's make section starts the rider service).
- Never run `make db`, `make dev`, `make prod-local` or any docker command.
- Stop and write here if: `make gen` changes a file (other than through your Makefile edit); a check needs README text different from design.md; anything needs a file outside scope.
## Doing
## Found
## Requests
## Blockers
