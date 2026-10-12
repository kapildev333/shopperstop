# platform-P1-L11 - README.md and CLAUDE.md (OpenSpec change platform-readme-claude)
Status: started
## Doing
Change platform-readme-claude written and valid; waiting for the platform manager to launch workers t1 (README) then t2 (CLAUDE.md) on this branch. Acceptance (/opsx:verify) after both land.
## Found
- Worktree was created on origin/main 6ae9c6b (one commit past the brief's 0daca74: core area plan chore #26); nothing in it touches README.md or CLAUDE.md.
- The red step for both tasks is `sh openspec/changes/platform-readme-claude/check-docs.sh` (37 failures on the unchanged tree); it ends `docs check: ok` when both tasks are done.
- `make dev` does not run `npm ci`; the README quick start says `npm ci` once first (design.md Decision 2).
## Requests
- to platform manager (backlog, Makefile owner): `make dev` runs `npm ci` when `node_modules` is absent, so the quick start is one command; README drops its `npm ci` line then.
- to orchestrator: D14 says "Spec 1 §6 ... wording updated in Task 15", but Spec 1 is frozen (D6) and outside this lane's scope; recommend D14 plus the platform-ci-makefile requirements (living spec once archived) stand as the record, or an "Amended" note like the plan's, by the orchestrator.
## Blockers
