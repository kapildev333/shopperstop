# Proposal

## Why
Plan Task 10: `apps/web` does not exist, so the Spec 2 §7 customer pages have no shell to land in, and `make test-web`, `make e2e` and CI have no customer site to gate. Phase 1 scaffolds the app with its real gates (lint, typecheck, Vitest, build, Playwright with axe against a real core) so Phase 2 only adds pages. The admin shell (`admin-apps-admin`, PR #41) is the template.

## What Changes
- New workspace `apps/web` (`@shopperstop/web`): React 19, Vite 8, TypeScript strict, TanStack Router (file-based), Tailwind 4 through `@tailwindcss/vite`, composed only from `@shopperstop/ui`. Scripts `dev`, `lint`, `typecheck`, `test`, `build`, `e2e` (PLAN.md D15). Same pins as `apps/admin`, plus `lucide-react` 1.55.0 (the `packages/ui` pin) for the header pin icon.
- Customer shell: a banner that is the brand band, holding the "ShopperStop" wordmark and an "Enter pincode" control; a main region; the canvas background. The index route `/` is Home at its emptiest (Spec 2 §7): a page title and a "Set your pincode" empty state. Unknown paths show "Page not found" inside the shell with a link back to Home.
- Served at the root `/` (no Vite `base`, no router `basepath`), matching the `deploy/Caddyfile` catch-all. Dev server on 5173 proxies `/api` to :8080; `vite preview` on 15173 proxies `/api` to :18080 (Spec 1 §7, D15).
- Playwright (Chromium only) starts core (`go run ./cmd/core` from `services/core`, environment from `make e2e`) and `vite preview`; the smoke suite runs axe on every page it visits and proves the `/api` proxy against core's `healthz`.
- `src/no-literal-colors.test.ts` on the shared matcher; one Testing Library test file for the shell.
- New capability `web-app` with ADDED requirements only. The design-system seed scenarios "Literal colour fails the gate" and "Axe on every e2e page" get their web tests here; their requirements are not repeated.

Area: web. Capabilities touched: `web-app` (new); `design-system` scenarios tested, not modified. Out of scope: the pincode sheet and serviceability lookup (the header control is a placeholder that does nothing yet), search, category rail, cart bar, sign-in and every other Spec 2 §7 page (Phase 2); TanStack Query, `openapi-fetch` and the typed client (first API call, Phase 2); README and Makefile wording (platform).

## Capabilities

### New Capabilities
- `web-app`: the customer web app as a whole: its shell (brand header band, pincode control, not-found), where it is served, how it reaches core, and its gates. Phase 2 page capabilities (`serviceability`, `catalog`, `cart`, `orders`, `accounts`) add their pages inside it.

### Modified Capabilities
None.

## Impact
- Files: `apps/web/**` and this change folder; root `package-lock.json` changes mechanically on `npm install`. Root `package.json` workspaces (`apps/*`) already include the app.
- Cross-area contracts relied on:
  - ui: `@shopperstop/ui` exports `Button`, `ButtonLink`, `Card`, `EmptyState`, `PageHeader`; `@shopperstop/ui/tokens.css`; `@shopperstop/ui/testing` `findLiteralColors`; router links through `createLink(ButtonLink)` (ui area plan contract). `packages/ui` is built before app gates (`make test-web`, `make e2e`).
  - core: `go run ./cmd/core` honouring `SHOPPERSTOP_CORE_*`; `GET /api/core/v1/healthz` answering 200 `{"status":"ok"}` (`services/core/openapi.json`).
  - platform: `make test-web` and `make e2e` call the `lint`, `typecheck`, `test`, `build`, `e2e` scripts; `make e2e` sets the e2e environment (core :18080, database `shopperstop_core_e2e`, origins 15173 and 15174); `deploy/Caddyfile` serves the web build at every path not under `/api/core/` or `/admin/`, with SPA fallback.
