# admin
Scope: `apps/admin/`
Depends on: ui (`@shopperstop/ui`, landed #20), core (`services/core/openapi.json`, landed #23)
Spec: Spec 1 §4, §7, §8; Spec 2 §8, §13; plan task 11
## Doing
admin-P1-L1: change `admin-apps-admin` seen by the orchestrator (D13), one worker building task 1 on `lane/admin-P1-L1-apps-admin`. No `make e2e` here; the admin Playwright suite runs directly with `npm run e2e --workspace apps/admin` until the next `make e2e` slot (guard covers `apps/admin` since #30).

## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| admin-P1-L1 | Task 11 `apps/admin` shell (`@shopperstop/admin`) | `apps/admin/`, `openspec/changes/admin-apps-admin/` | team lead done: capability `admin-app` (5 ADDED requirements), `openspec validate --strict` passes, design dry-run green against a real core (lint, typecheck, build, Vitest 3/3, Playwright 3/3); worker started 2026-10-12 |
## Requests
- to platform: e2e guard for `apps/admin` and `admin-app` capability landed in #30; README names the admin dev URL `http://localhost:5174/admin/` (with platform-P1-L11).
- to web (information): `TabNav` on `bg-brand` fails axe `color-contrast`; put the nav on a `surface` strip and keep only `on-brand` text on the brand band. `ink-muted` on `canvas` is 4.47:1, so `PageHeader`/`EmptyState` descriptions sit on a `Card` or are omitted.
## Found
- Decisions taken by the orchestrator for admin (D13): `@vitejs/plugin-react` 6.1.2 is D10 implied tooling; TypeScript pinned 5.9.3 per D18 ahead of ui's follow-up; `@tanstack/react-router` 1.170.42, `@tanstack/router-plugin` 1.168.43, `@tailwindcss/vite` 4.3.3, `@playwright/test` 1.64.0, `@axe-core/playwright` 4.13.0 recorded as in-stack.
- The app is served under `/admin/` (Vite `base`, router `basepath`) to match `deploy/Caddyfile`; dev `http://localhost:5174/admin/`, preview `http://localhost:15174/admin/`.
- Playwright 1.64.0 needs Chromium 1248; installed in the user cache on this machine.
- CI is blocked by account billing (see PLAN.md); admin PRs carry locally run gates.
## Backlog
- Phase 2 (Spec 2 §8): sign-in, role-based nav, Dashboard, Orders board, Stock, Stores, Categories, Products, Staff; TanStack Query and `openapi-fetch` with the typed client from ui's `ui-api-types` follow-up.
