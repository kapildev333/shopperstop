# admin
Scope: `apps/admin/`
Depends on: ui (`@shopperstop/ui`, landed #20), core (`services/core/openapi.json`, landed #23)
Spec: Spec 1 §4, §7, §8; Spec 2 §8, §13; plan task 11
## Doing
Paused 2026-10-12 (owner stopped for the day). Resume at: `/manage admin`, then rebase `.worktrees/admin-P2-L3` (branch `lane/admin-P2-L3-admin-catalog`, unpushed; proposal committed by its team lead, see `.claude/lanes/admin-P2-L3.md`) onto origin/main, run task 0 of `admin-catalog` against the merged admin-stores base and `core.d.ts`, send the change to the orchestrator under D13, then workers. admin-P2-L4 `admin-stock` waits on core-P2-L4 on main. No `make e2e` running; nothing on 18080/15174.

## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| admin-P2-L2 | `admin-stores`: /stores table, store form, delete, pincode editor | `apps/admin/`, `openspec/changes/admin-stores/` | done 2026-10-12: PR #91 (cb7d0a9); tasks 0 to 5 + 4b, reviews approve with nits (closed in 4b, 4b approve clean), acceptance pass (22 scenarios); manager verified `make test` (admin 52 Vitest), `make e2e` (admin 6), `make postman`, openspec 10 passed, Chrome walk-through with real 409s and a create/delete round trip; archive PR chore/admin-archive-admin-stores |
| admin-P2-L3 | `admin-catalog`: /categories tree, /products table and form, image upload | `apps/admin/`, `openspec/changes/admin-catalog/` | team lead proposing 2026-10-12 against core-P2-L3 and the admin-stores base |
| admin-P2-L1 | `admin-auth-nav`: sign-in, session, role nav, protected routes, sign-out | `apps/admin/`, `openspec/changes/admin-auth-nav/` | done 2026-10-12: PR #71 (8242bbb); 4 tasks, 4 reviews approve with nits (all closed in task 4 or recorded), team-lead acceptance pass (11 requirements, 37 scenarios mapped); manager verified `make test` (admin 31 Vitest), `make e2e` (admin 4 passed), `make postman`, openspec 8 passed, Chrome walk-through against a real core; archive PR chore/admin-archive-admin-auth-nav |
| admin-P1-L1 | Task 11 `apps/admin` shell (`@shopperstop/admin`) | `apps/admin/`, `openspec/changes/admin-apps-admin/` | done 2026-10-12: PR #41 merged (squash 1e4e08f); reviewer approve with nits (addressed), team-lead acceptance pass; manager verified `make test`, `make e2e` (3 passed), `make postman` clean, openspec valid, real core + preview over HTTP and Chrome; archive PR chore/admin-archive-admin-apps-admin |
## Requests
- to core (core-P2-L1): keep schema names `Staff` and `StaffSession`; `GET /admin/me` returns the Staff object unwrapped (`id`, `email`, `name`, `role`, `isActive`, `storeId` omitted for admins); sign-in 200 `{token, staff}`; inactive staff 401 `unauthorized`; sign-out 204.
- to web (information): relative `baseUrl` fails under Vitest/jsdom; use `${location.origin}/api/core/v1` and `fetch: (r) => globalThis.fetch(r)`. Admin sign-in page contract for web-P2-L5's cross-app e2e: labels "Email"/"Password", buttons "Sign in"/"Sign out", `redirect` query.
- to platform: e2e guard for `apps/admin` and `admin-app` capability landed in #30; README names the admin dev URL `http://localhost:5174/admin/` (with platform-P1-L11).
- to web (information): `TabNav` on `bg-brand` fails axe `color-contrast`; put the nav on a `surface` strip and keep only `on-brand` text on the brand band. `ink-muted` on `canvas` is 4.47:1, so `PageHeader`/`EmptyState` descriptions sit on a `Card` or are omitted.
## Found
- admin-P2-L2 decisions under D13: Status as a ui `Select` (ceiling: a ui Switch if the Figma toggle is wanted); stores table unpaged at pageSize 100; nav overflow fixed in ui `TabNav` (ui-P2-L1, #82). Patterns worth reusing: typed `Link`s need placeholder routes before their targets exist; a created item's page refetches on mount, so fakes must answer the GET; a save writes `setQueryData` and lists refetch on mount at staleTime 0 (no invalidation); mutation-proven guard tests; e2e written in task 1, run last with the slot.
- Admin e2e needs SHOPPERSTOP_CORE_FILES_DIR exported alongside the other four when run standalone (core requires it since core-P2-L3); `make e2e` sets it.
- admin-P2-L1 ceilings (design.md): no client-side 12 h timer (next 401 ends the session); `GET /admin/me` cached per page load; retry banner and 403 not-found pages carry no nav or Sign out; `/sign-in` reachable while signed in; six placeholder pages (PageHeader only) until L2 to L6; store-staff nav and wrong-role deep link are unit tests until core-P2-L2 seeds store staff. 401 rule: the session is cleared only when the 401 answers a request carrying the current token (reviewer-found race). Safe redirect `/^\/(?![/\\])/`.
- Local tooling: a worktree whose `npm install` ran with `--workspace` only lacks the other apps' nested binaries; `npm ci` at the root before `make test`/`make e2e`. The Chrome extension's pointer clicks missed the banner button in one session; Playwright clicks it for real.
- Admin e2e: global setup runs core's migrate + seed-demo --reset against the env it is given; running `npm run e2e --workspace apps/admin` with a dev DATABASE_URL exported would reset dev demo accounts (D22 by design); use `make e2e`.
- admin-P2-L1 pins (D10 tooling per the package): `openapi-fetch` 0.17.0, `@tanstack/react-query` 5.104.2, dev `@testing-library/user-event` 14.6.7. Capability stays `admin-app` (no separate `admin-auth`). Ceilings: `GET /admin/me` cached per page load; no client-side 12-hour timer (next 401 ends the session); admin-only rule is a route folder.
- Core rate limit (10 sign-ins per email per hour per process) caps local admin e2e runs against one reused core; restart core to clear.
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
| admin-P2-L1 | `admin-auth-nav`: sign-in, session, role nav, protected routes, sign-out | `apps/admin/`, `openspec/changes/admin-auth-nav/` | done 2026-10-12: PR #71 (8242bbb); 4 tasks, 4 reviews approve with nits (all closed in task 4 or recorded), team-lead acceptance pass (11 requirements, 37 scenarios mapped); manager verified `make test` (admin 31 Vitest), `make e2e` (admin 4 passed), `make postman`, openspec 8 passed, Chrome walk-through against a real core; archive PR chore/admin-archive-admin-auth-nav |
| admin-P2-L2 | `admin-stores` | core-P2-L2 | `/stores` table, `/stores/{id}` form (fees, minimums, promised minutes, open toggle, pincode list editor with the conflict message naming the other store) |
| admin-P2-L3 | `admin-catalog` | core-P2-L3 | `/categories` tree with sort order and image upload; `/products` table with search and filters, `/products/{id}` form (category, unit, MRP, price, active toggle, image upload), deactivate hint on 409 |
| admin-P2-L4 | `admin-stock` | core-P2-L4 | `/stock` table (product, unit, price, quantity inline-editable, low-stock badge), search, low-stock filter, store selector, batched save with one `PUT` |
| admin-P2-L5 | `admin-orders-dashboard` | core-P2-L5 | `/orders` board (column per active status, cards with number, time since placed, item count, total, pincode, one next-status button; polls every 10 s; `aria-live` for new placed orders), History tab table, detail sheet (items, customer with phone, address, events, cancel with reason), status dialog; `/` dashboard cards per visible store |
| admin-P2-L6 | `admin-staff-e2e` | core-P2-L6 (seed) | `/staff` table and create/edit dialog; the Spec 2 §13 admin e2e flows against the seeded data |

Gates per PR: `make test-web` and `make e2e` (one e2e at a time; say so in `## Doing`), axe on every page visited, `openspec validate --all --strict`, and the manager's own Chrome walk-through against a running core with the demo seed.
