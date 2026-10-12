# web
Scope: `apps/web/`
Depends on: ui (`@shopperstop/ui` from task 9), core (`services/core/openapi.json` for the generated client, task 8)
Spec: Spec 1 §4, §7, §8; Spec 2 §7, §13; plan task 10
## Doing

## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
## Requests
- from platform (D15): `apps/web` package.json scripts `lint`, `typecheck`, `test`, `build`, `e2e`; Playwright config starts core (`go run ./cmd/core` from services/core with the env `make e2e` sets: core :18080, database shopperstop_core_e2e) and `vite preview` on 15173 with `/api` proxied to 18080; Chromium only; axe on every page.

## Found

## Backlog

