# Proposal

## Why
Every Spec 2 §8 admin page needs a signed-in staff member and their role, and `apps/admin` has neither: the Phase 1 shell is open to anyone and its nav is one static link. This change adds staff sign-in, the session, role-based nav, protected routes and sign-out, so the page lanes (admin-P2-L2 to L6) only add pages.

## What Changes
- `/sign-in`: email and password form composed from `FormField`, `Input`, `Button`, `ErrorBanner`; client-side required checks; error states for wrong credentials, inactive staff, `rate_limited`, a field `validation` error and an unreachable core; submit disabled while pending; returns to the page the user came from.
- Session: the staff token is kept in memory and in `localStorage` `shopperstop:staff-token` (Spec 2 §5) and attached as `Authorization: Bearer` by one shared typed client (`openapi-fetch` over `@shopperstop/ui/api` `paths`). `GET /admin/me` restores the session on load; any 401 on a request that carried the token clears the session and sends the user to sign-in.
- Protected routes: every page except `/sign-in` and the not-found page requires a session; signed out, a deep link goes to `/sign-in?redirect=<path>`.
- Role-based nav on the existing surface strip: admins see Dashboard, Orders, Stock, Stores, Categories, Products, Staff; store staff see Dashboard, Orders, Stock. A store staff deep link to an admin page shows the not-found page inside the shell, no redirect (Spec 2 §8).
- Sign-out button in the banner: `POST /admin/auth/sign-out`, clears the session, lands on `/sign-in`.
- Placeholder routes `/orders`, `/stock`, `/stores`, `/categories`, `/products`, `/staff`, each only a `PageHeader`, so the nav has targets and the role rule is testable; the page lanes replace them.
- The not-found page gains a `Card` with an `EmptyState` and a "Go to Dashboard" link (Phase 1 design's stated ceiling).
- Playwright gets a global setup that migrates and runs `core-admin seed-demo --reset` (D22), and a sign-in, dashboard, sign-out flow against the real core as the seeded admin. The smoke test that opened the Dashboard signed out now opens the sign-in page.
- Dependencies (D10, approved in the work package): `openapi-fetch` 0.17.0, `@tanstack/react-query` 5.104.2; dev `@testing-library/user-event` 14.6.7 (same pin as `packages/ui`).
- **BREAKING** (app behaviour): `/` now requires a session; signed out it redirects to `/sign-in?redirect=%2F`.

Area: admin. Out of scope: every real Spec 2 §8 page body (Dashboard cards, Orders board, Stock, Stores, Categories, Products, Staff: admin-P2-L2 to L6); the admin store selector (comes with the first page that needs it); store-staff and wrong-role cases in Playwright (store staff are seeded only with core-P2-L2, D22; covered by Testing Library here and by e2e in a later lane); the Spec 2 §13 cross-app flows (admin-P2-L6, web-P2-L5); expiring the session on the client clock (core answers 401 after 12 hours and the 401 rule handles it); any change to `packages/ui` or `services/core`.

## Capabilities

### New Capabilities
None. Sign-in, session and nav are behaviour of the admin app as a whole, so they live in `admin-app`. A separate `admin-auth` capability was rejected: `admin-staff` and `accounts` are core's (seeded by core-P2-L1 for the HTTP routes), and a third auth-named capability for the client side would split one user-facing flow across two specs.

### Modified Capabilities
- `admin-app`: MODIFIED "Admin shell" (nav per role, sign-out in the banner), "Served under /admin/" (the entry now lands on sign-in), "Core reached through a same-origin proxy" (absolute same-origin URL, typed client), "End-to-end suite with axe" (global setup, the sign-in flow); ADDED "Staff sign-in", "Staff session", "Protected routes", "Role-based navigation", "Wrong-role deep link shows not found", "Sign-out".

## Impact
- Files: `apps/admin/**` and this change folder; root `package-lock.json` changes mechanically on `npm install`.
- Cross-area contracts relied on:
  - core (`services/core/openapi.json`, regenerated into `packages/ui/src/api/core.d.ts` by core-P2-L1 per D19): `POST /admin/auth/sign-in`, `POST /admin/auth/sign-out`, `GET /admin/me`, the error envelope `{error:{code,message,field?}}`, the staff schema. Shapes not yet in `openapi.json` are listed as assumptions in design.md and rechecked in task 0.
  - core: `go run ./cmd/core-admin migrate` and `seed-demo --reset` honouring `SHOPPERSTOP_CORE_*`, the seed creating `admin@shopperstop.local` / `admin12345` (D22).
  - ui: `@shopperstop/ui` exports `Button`, `buttonClass`, `Card`, `EmptyState`, `ErrorBanner`, `FormField`, `Input`, `PageHeader`, `TabNav`; `@shopperstop/ui/api` types `paths` and `components`; `@shopperstop/ui/tokens.css`.
  - platform: `make e2e` sets the e2e environment and runs `npm run e2e` per workspace.
