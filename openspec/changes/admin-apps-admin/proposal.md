# Proposal

## Why
Plan Task 11: `apps/admin` does not exist, so Spec 2 §8 pages have no shell to land in and `make test`, `make e2e` and CI have nothing to gate for the admin panel. Phase 1 scaffolds the app with its real gates (lint, typecheck, Vitest, build, Playwright with axe against a real core) so Phase 2 only adds pages.

## What Changes
- New workspace `apps/admin` (`@shopperstop/admin`): React 19, Vite 8, TypeScript strict, TanStack Router (file-based), Tailwind 4 through `@tailwindcss/vite`, composed only from `@shopperstop/ui`. Scripts `dev`, `lint`, `typecheck`, `test`, `build`, `e2e` (PLAN.md D15).
- Admin shell: a banner with the brand band and the "ShopperStop Admin" wordmark, an "Admin" navigation landmark on a surface strip with one link (Dashboard), a main region; the index route `/` is a Dashboard placeholder; unknown paths show "Page not found" inside the shell.
- Served under `/admin/` (Vite `base`, router `basepath`), matching `deploy/Caddyfile` and `make prod-local`. Dev server on 5174 proxies `/api` to :8080; `vite preview` on 15174 proxies `/api` to :18080 (Spec 1 §7, D15).
- Playwright (Chromium only) starts core (`go run ./cmd/core` from `services/core`, environment from `make e2e`) and `vite preview`; the smoke suite runs axe on every page it visits and proves the `/api` proxy against core's `healthz`.
- `src/no-literal-colors.test.ts` on the shared matcher; one Testing Library test file for the shell.
- New capability `admin-app` (D4: the app's capability is seeded by its first change) with ADDED requirements only. The design-system seed scenarios "Literal colour fails the gate" and "Axe on every e2e page" get their admin tests here; their requirements are not repeated.

Area: admin. Out of scope: sign-in and every Spec 2 §8 page (Phase 2); role-based nav; TanStack Query, `openapi-fetch` and the typed client `src/api/core.d.ts` (ui follow-up change `ui-api-types`; no API call in the app yet); `lucide-react` icons in the app; README and Makefile wording (platform).

## Capabilities

### New Capabilities
- `admin-app`: the admin and store-staff web app as a whole: its shell (banner, navigation, not-found), where it is served, how it reaches core, and its gates. Phase 2 page capabilities (`admin-stores`, `admin-catalog`, `admin-staff`, `orders`, `stock`) add their pages inside it.

### Modified Capabilities
None.

## Impact
- Files: `apps/admin/**` and this change folder; root `package-lock.json` changes mechanically on `npm install`. Root `package.json` workspaces (`apps/*`) already include the app.
- Cross-area contracts relied on:
  - ui: `@shopperstop/ui` exports `PageHeader`, `TabNav`, `Card`, `EmptyState`; `@shopperstop/ui/tokens.css`; `@shopperstop/ui/testing` `findLiteralColors`. `packages/ui` is built before app gates (`make test-web`, `make e2e`).
  - core: `go run ./cmd/core` honouring `SHOPPERSTOP_CORE_*`; `GET /api/core/v1/healthz` answering 200 `{"status":"ok"}` (`services/core/openapi.json`).
  - platform: `make test-web` and `make e2e` call the `lint`, `typecheck`, `test`, `build`, `e2e` scripts; `make e2e` sets the e2e environment (core :18080, database `shopperstop_core_e2e`, origins 15173 and 15174); `deploy/Caddyfile` serves the build under `/admin/` with the prefix stripped.
