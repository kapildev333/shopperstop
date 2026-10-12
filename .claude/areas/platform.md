# platform
Scope: root files, `deploy/`, `.github/`, `openspec/`, `docs/`, `Makefile`, `README.md`, `CLAUDE.md`
Depends on: none
Spec: Spec 1 §3, §5.1, §6, §7, §11, §12; plan tasks 1, 3, 4, 12, 13, 15 (tasks 1 and 2 done by the orchestrator)
## Doing
platform-P1-L9 (CI and Makefile) team lead running from 2026-10-12. No `make e2e` running.
## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| platform-P1-L3 | Task 3 OpenSpec seed (`platform`, `design-system` specs) | `openspec/` | done 2026-10-12: reviewer approve, acceptance pass, manager verified (diff gate, validate); PR #3 merged; archived in #5 |
| platform-P1-L4 | Task 4 deploy files and `make db` | `deploy/`, `Makefile` | done 2026-10-12: reviewer approve, acceptance pass, manager verified (`make db` healthy, `select 1` as shopperstop_core on `_test`, role owns 3 databases); PR #4 merged; archived in #6 |
| platform-P1-L9 | Task 13 CI workflow and Makefile | `.github/workflows/`, `Makefile` | team lead running; worktree `.worktrees/platform-P1-L9`, branch `lane/platform-P1-L9-ci-makefile` |
| platform-P1-L8 | Task 12 Postman | `scripts/`, `docs/postman/` | waits on core task 8 (`services/core/openapi.json`) |
| platform-P1-L11 | Task 15 README, CLAUDE.md, docs/figma.md | `README.md`, `CLAUDE.md`, `docs/figma.md` | waits on tasks 13 and 14 |
## Requests

## Found
- 2026-10-12: `psql` is not installed on this host; ad-hoc database checks use a Go pgx client. Recorded for the README.
- 2026-10-12: the lane guard hook denies `git merge-base` and `git fetch` to reviewers (pattern matches `merge`); reviewers work around with `git rev-parse` and three-dot diffs. Harmless; tighten the regex to word boundaries if it bites again.
- The Phase 1 plan spells out only Tasks 1 to 4; Tasks 12, 13 and 15 are written as OpenSpec changes from Spec 1 §6, §7, §11, §12.
## Backlog
