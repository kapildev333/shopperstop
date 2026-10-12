# platform
Scope: root files, `deploy/`, `.github/`, `openspec/`, `docs/`, `Makefile`, `README.md`, `CLAUDE.md`
Depends on: none
Spec: Spec 1 §3, §5.1, §6, §7, §11, §12; plan tasks 1, 3, 4, 12, 13, 15 (task 2 done)
## Doing
platform-P1-L3 and platform-P1-L4 team leads running (2026-10-12). No `make e2e` running.
## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| platform-P1-L3 | Task 3 OpenSpec seed (`platform`, `design-system` specs) | `openspec/` | team-lead running; worktree `.worktrees/platform-P1-L3`, branch `lane/platform-P1-L3-openspec-seed` off local main |
| platform-P1-L4 | Task 4 deploy files and `make db` | `deploy/`, `Makefile` | team-lead running; worktree `.worktrees/platform-P1-L4`, branch `lane/platform-P1-L4-deploy-db` off local main |
| platform-P1-L8 | Task 12 Postman | `scripts/`, `docs/postman/` | waits on core task 8 (`openapi.json`) |
| platform-P1-L9 | Task 13 CI and Makefile | `.github/workflows/`, `Makefile` | waits on L4 and the core and ui scaffolds |
| platform-P1-L11 | Task 15 README, CLAUDE.md, docs/figma.md | `README.md`, `CLAUDE.md`, `docs/figma.md` | waits on tasks 13 and 14 |
## Requests

## Found
- 2026-10-12: GitHub repo `kapildev333/shopperstop` and the `origin` remote do not exist; plan Task 1 steps 1 to 4 (root `package.json`, PR template, dependabot, `gh repo create --private --push`) are orchestrator-owned and not done. No orchestrator session was running (peers were the core and ui managers). Every area is blocked on landing until then; ui is blocked on starting. Platform lanes run off local `main` and will rebase onto `origin/main` before pushing.
- 2026-10-12: the Docker daemon is not running (reported by the core manager), so `make db` cannot be verified until Docker is started.
- The Phase 1 plan spells out only Tasks 1 to 4; Tasks 12, 13 and 15 exist only as lane-table rows, so their team leads write the OpenSpec changes from Spec 1 §7, §11, §12 directly.
## Backlog
