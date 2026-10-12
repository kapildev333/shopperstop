# web
Scope: `apps/web/`
Depends on: ui (`@shopperstop/ui` from task 9), core (`services/core/openapi.json` for the generated client, task 8)
Spec: Spec 1 §4, §7, §8; Spec 2 §7, §13; plan task 10
## Doing
No web lane running; e2e ports free.

## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| web-P1-L1 | plan task 10 apps/web shell | `apps/web/`, `openspec/changes/web-apps-web/` | done 2026-10-12: reviewer approve, acceptance pass, manager verified (`make test-web`, `make e2e` admin+web back to back, Chrome look at Home and not-found); PR #50 merged; archived in this PR |
## Requests
- from admin (axe findings on the shared components, apply to web): TabNav on `bg-brand` fails contrast, so the nav sits on a `surface` strip; `ink-muted` text needs `surface` behind it (`ink-muted` on `canvas` is 4.47:1, below 4.5). Pin TypeScript 5.9.3 (D18); `@vitejs/plugin-react` is D10 tooling; serve web at `/` (admin is under `/admin/`).
- from platform (D15): `apps/web` package.json scripts `lint`, `typecheck`, `test`, `build`, `e2e`; Playwright config starts core (`go run ./cmd/core` from services/core with the env `make e2e` sets: core :18080, database shopperstop_core_e2e) and `vite preview` on 15173 with `/api` proxied to 18080; Chromium only; axe on every page.

## Found
- 2026-10-12: Phase 1 web shell done from the orchestrator session (D21). Phase 2 package follows; a `/manage web` session can take over from this file.

## Backlog

