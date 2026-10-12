# admin
Scope: `apps/admin/`
Depends on: ui (`@shopperstop/ui`, landed #20), core (`services/core/openapi.json`, landed #23)
Spec: Spec 1 §4, §7, §8; Spec 2 §8, §13; plan task 11
## Doing
Nothing running. Phase 1 admin work is complete (admin-P1-L1, #41); Phase 2 (Spec 2 §8) starts when the orchestrator writes the work package. No `make e2e` here.

## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| admin-P1-L1 | Task 11 `apps/admin` shell (`@shopperstop/admin`) | `apps/admin/`, `openspec/changes/admin-apps-admin/` | done 2026-10-12: PR #41 merged (squash 1e4e08f); reviewer approve with nits (addressed), team-lead acceptance pass; manager verified `make test`, `make e2e` (3 passed), `make postman` clean, openspec valid, real core + preview over HTTP and Chrome; archive PR chore/admin-archive-admin-apps-admin |
## Requests
- to platform: e2e guard for `apps/admin` and `admin-app` capability landed in #30; README names the admin dev URL `http://localhost:5174/admin/` (with platform-P1-L11).
- to web (information): `TabNav` on `bg-brand` fails axe `color-contrast`; put the nav on a `surface` strip and keep only `on-brand` text on the brand band. `ink-muted` on `canvas` is 4.47:1, so `PageHeader`/`EmptyState` descriptions sit on a `Card` or are omitted.
## Found
- Decisions taken by the orchestrator for admin (D13): `@vitejs/plugin-react` 6.1.2 is D10 implied tooling; TypeScript pinned 5.9.3 per D18 ahead of ui's follow-up; `@tanstack/react-router` 1.170.42, `@tanstack/router-plugin` 1.168.43, `@tailwindcss/vite` 4.3.3, `@playwright/test` 1.64.0, `@axe-core/playwright` 4.13.0 recorded as in-stack.
- The app is served under `/admin/` (Vite `base`, router `basepath`) to match `deploy/Caddyfile`; dev `http://localhost:5174/admin/`, preview `http://localhost:15174/admin/`.
- Playwright 1.64.0 needs Chromium 1248; installed in the user cache on this machine.
- `apps/admin` has no `preview` script; Playwright runs `vite preview` directly. Bare `/` on the preview redirects into `/admin/`.
- Phase 2 contract wish for core (D20 already covers security schemes): admin pages will use `@shopperstop/ui/api` types with `openapi-fetch`; TanStack Query added with the first page that calls core.
- CI is blocked by account billing (see PLAN.md); admin PRs carry locally run gates.
## Backlog
- Phase 2 (Spec 2 §8): sign-in, role-based nav, Dashboard, Orders board, Stock, Stores, Categories, Products, Staff; TanStack Query and `openapi-fetch` with the typed client from ui's `ui-api-types` follow-up.

## Phase 2 work package (orchestrator, 2026-10-12)
Spec: Spec 2 §8 (routes and pages), §5 (staff sessions: token in memory and `localStorage` `shopperstop:staff-token`, attached by the generated client; 12-hour expiry), §13 (admin e2e: sign in as store staff, see the order on the board, advance it to delivered; admin creates a product and sets stock). Figma: `Admin web` page in `docs/figma.md`. Stack additions allowed: `openapi-fetch` 0.17.0 and `@tanstack/react-query` (D10 tooling; record the pin). Compose only `@shopperstop/ui` components; the Orders board uses `aria-live`; nav shows only what the role can reach; an unauthorised deep link shows the `not_found` empty state; store selector for admins.

One OpenSpec change per lane; each waits for the core lane that serves its routes to be on main (the regenerated `@shopperstop/ui/api` types are the signal):

| Lane | Change | Waits on | Pages |
|---|---|---|---|
| admin-P2-L1 | `admin-auth-nav` | core-P2-L1 | `/sign-in` (email, password; error states), session in `localStorage`, `GET /admin/me`, role-based nav (admin: all; store staff: Dashboard, Orders, Stock), sign-out, protected routes redirect to sign-in and return after |
| admin-P2-L2 | `admin-stores` | core-P2-L2 | `/stores` table, `/stores/{id}` form (fees, minimums, promised minutes, open toggle, pincode list editor with the conflict message naming the other store) |
| admin-P2-L3 | `admin-catalog` | core-P2-L3 | `/categories` tree with sort order and image upload; `/products` table with search and filters, `/products/{id}` form (category, unit, MRP, price, active toggle, image upload), deactivate hint on 409 |
| admin-P2-L4 | `admin-stock` | core-P2-L4 | `/stock` table (product, unit, price, quantity inline-editable, low-stock badge), search, low-stock filter, store selector, batched save with one `PUT` |
| admin-P2-L5 | `admin-orders-dashboard` | core-P2-L5 | `/orders` board (column per active status, cards with number, time since placed, item count, total, pincode, one next-status button; polls every 10 s; `aria-live` for new placed orders), History tab table, detail sheet (items, customer with phone, address, events, cancel with reason), status dialog; `/` dashboard cards per visible store |
| admin-P2-L6 | `admin-staff-e2e` | core-P2-L6 (seed) | `/staff` table and create/edit dialog; the Spec 2 §13 admin e2e flows against the seeded data |

Gates per PR: `make test-web` and `make e2e` (one e2e at a time; say so in `## Doing`), axe on every page visited, `openspec validate --all --strict`, and the manager's own Chrome walk-through against a running core with the demo seed.
