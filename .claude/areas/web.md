# web
Scope: `apps/web/`
Depends on: ui (`@shopperstop/ui` from task 9), core (`services/core/openapi.json` for the generated client, task 8)
Spec: Spec 1 §4, §7, §8; Spec 2 §7, §13; plan task 10
## Doing

## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
## Requests
- from admin (axe findings on the shared components, apply to web): TabNav on `bg-brand` fails contrast, so the nav sits on a `surface` strip; `ink-muted` text needs `surface` behind it (`ink-muted` on `canvas` is 4.47:1, below 4.5). Pin TypeScript 5.9.3 (D18); `@vitejs/plugin-react` is D10 tooling; serve web at `/` (admin is under `/admin/`).
- from platform (D15): `apps/web` package.json scripts `lint`, `typecheck`, `test`, `build`, `e2e`; Playwright config starts core (`go run ./cmd/core` from services/core with the env `make e2e` sets: core :18080, database shopperstop_core_e2e) and `vite preview` on 15173 with `/api` proxied to 18080; Chromium only; axe on every page.

## Found

## Backlog

