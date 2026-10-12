# admin-P2-L1 - admin sign-in, session, role-based nav (OpenSpec change admin-auth-nav)
Status: blocked
## Doing
Change `admin-auth-nav` proposed and valid (`openspec validate admin-auth-nav --strict`); worker briefs for tasks 1 to 4 are in the team-lead report. Next: task 0 (recheck design.md assumptions A1 to A10 against the regenerated `core.d.ts`) as soon as core-P2-L1 is on origin/main.
## Found
- Capability: `admin-app` only (4 MODIFIED, 7 ADDED requirements). No `admin-auth` capability: `admin-staff` and `accounts` are core's HTTP capabilities (core-P2-L1), and the client side of one flow belongs to the app.
- Spike 2026-10-12 (scratchpad copy of 5101344, Node 22.23.3, staff routes added to a scratch `openapi.json` as assumed): workspace install clean; lint, typecheck, Vitest 5 files / 28 tests, `vite build` with `routeTree.gen.ts` stable; Playwright + axe on a scratch preview port (25174, not 15174/18080): sign-in, error banner, Dashboard, not-found signed out, store-staff not-found on `/stores`, reload restores the session, `/admin/stock` round trip through sign-in, sign-out: all clean.
- Spike findings that shape the design: (1) openapi-fetch with a relative `baseUrl` throws `Failed to parse URL` under jsdom; use `${location.origin}/api/core/v1`. (2) openapi-fetch captures `globalThis.fetch` at `createClient`; pass `fetch: (r) => globalThis.fetch(r)` so tests can stub it later. (3) openapi-fetch `error` is the whole envelope; the code is at `error.error.code`. (4) A disabled `useQuery` observer keeps its data after `queryClient.clear()`; the root reads the staff member from the `_staff` match instead. (5) A root `errorComponent` replaces the whole layout; it sits on `_staff`. (6) Playwright runs `webServer`s before `globalSetup`.
- core-P2-L1's design (its branch, not main) agrees with A1 to A4 and A6 to A10; A5 settled: inactive staff get 401 `unauthorized` with the same message as a wrong password, so no 403 branch.
- Pins: `openapi-fetch` 0.17.0, `@tanstack/react-query` 5.104.2, dev `@testing-library/user-event` 14.6.7 (same as web-P2-L2).
- Session store guards every `localStorage` access, the same rule as web-P2-L2's review fix.
- For web-P2-L5 (cross-app e2e): the admin sign-in page has fields labelled "Email" and "Password" and a "Sign in" button; the banner has a "Sign out" button; `/admin/<path>` signed out goes to `/admin/sign-in?redirect=%2F<path>` and returns there after sign-in.
## Requests
- to web (information, via the admin area plan): `createClient({ baseUrl: '/api/core/v1' })` throws `TypeError: Failed to parse URL` in Vitest/jsdom on the first real call through the client (middleware-only tests do not hit it); `${location.origin}/api/core/v1` plus `fetch: (r) => globalThis.fetch(r)` fixes it and stays same-origin in the browser.
- to core (core-P2-L1): keep the schema names `Staff` and `StaffSession` and the 401-for-inactive rule as in your design; the admin app types against them.
## Blockers
- Workers wait for core-P2-L1 on origin/main (regenerated `packages/ui/src/api/core.d.ts`, D19), then task 0.
