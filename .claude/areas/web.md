# web
Scope: `apps/web/`
Depends on: ui (`@shopperstop/ui` from task 9), core (`services/core/openapi.json` for the generated client, task 8)
Spec: Spec 1 §4, §7, §8; Spec 2 §7, §13; plan task 10
## Doing
web-P2-L2 (`web-accounts`): T1 landed and reviewed (storage guard fixed); T2 (sign-in, register) worker running and RUNNING THE WEB E2E SUITE on 18080/15173 (admin: message me before running yours); T3 next.

## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| web-P2-L2 | `web-accounts` (sign-in, register, account, addresses) | `apps/web/`, `openspec/changes/web-accounts/` | proposed 2026-10-12 (8 requirements, 23 scenarios, 3 sequential tasks); T1 landed (reviewer approve after the storage-guard fix); T2 running on core-P2-L1's routes (#63); T3 next; branch `lane/web-P2-L2-accounts` |
| web-P1-L1 | plan task 10 apps/web shell | `apps/web/`, `openspec/changes/web-apps-web/` | done 2026-10-12: reviewer approve, acceptance pass, manager verified (`make test-web`, `make e2e` admin+web back to back, Chrome look at Home and not-found); PR #50 merged; archived in this PR |
## Requests
- to core (core-P2-L1, relayed 2026-10-12): register returns `{token, customer}`; PATCH accepts `""` as unset for optional text; 401 documented on `/me*`; `field` carries the JSON field name on validation errors; addresses list shape `{items, ...}`.
- to web-P2-L1 (when cut): reuse `src/api.ts` and `src/session.ts`; whichever lands second rebases `__root.tsx`. From admin: a relative baseUrl fails under Vitest/jsdom once a test makes a real call; use `${location.origin}/api/core/v1` plus `fetch: (r) => globalThis.fetch(r)`. Admin sign-in page (for the cross-app e2e): labels Email/Password, buttons Sign in/Sign out, `redirect` query.
- Decision (orchestrator): no `Checkbox` component; "Set as default" stays on the address list.
- from admin (axe findings on the shared components, apply to web): TabNav on `bg-brand` fails contrast, so the nav sits on a `surface` strip; `ink-muted` text needs `surface` behind it (`ink-muted` on `canvas` is 4.47:1, below 4.5). Pin TypeScript 5.9.3 (D18); `@vitejs/plugin-react` is D10 tooling; serve web at `/` (admin is under `/admin/`).
- from platform (D15): `apps/web` package.json scripts `lint`, `typecheck`, `test`, `build`, `e2e`; Playwright config starts core (`go run ./cmd/core` from services/core with the env `make e2e` sets: core :18080, database shopperstop_core_e2e) and `vite preview` on 15173 with `/api` proxied to 18080; Chromium only; axe on every page.

## Found
- 2026-10-12: Phase 1 web shell done from the orchestrator session (D21). Phase 2 package follows; a `/manage web` session can take over from this file.

## Backlog

## Phase 2 work package (orchestrator, 2026-10-12)
Spec: Spec 2 §7 (routes and pages, store choice in `localStorage` `shopperstop:pincode`, guest cart in `localStorage` pushed with `PUT /me/cart/items` per line at sign-in), §5 (customer token in `localStorage` `shopperstop:customer-token`, 30-day sliding), §13 (the customer e2e flow and the cross-app flows). Figma: `Customer web` page in `docs/figma.md` (phone 390 and desktop 1280 frames for every page and state). Stack additions allowed: `openapi-fetch` 0.17.0 and `@tanstack/react-query` (D10; record the pin). Compose only `@shopperstop/ui` components; sticky cart bar on phone, header cart button on desktop; Stepper everywhere a product is added; `Price` for every amount.

One OpenSpec change per lane; each waits for the core lane that serves its routes:

| Lane | Change | Waits on | Pages |
|---|---|---|---|
| web-P2-L1 | `web-serviceability-catalog` | core-P2-L2 (serviceability, store) and core-P2-L4 (the three customer browsing routes moved there with stock, D24); images and `/files` from core-P2-L3 | pincode sheet on first visit and from the header pin, serviceability with the closed and not-serviceable notices, Home (brand header with search, category rail, parent tiles, "Picked for you" first 12 in stock), `/c/{slug}` with child tabs and infinite scroll by page, `/p/{slug}`, `/search?q=` with the empty state suggesting categories; loading, empty and error states from `packages/ui` |
| web-P2-L2 | `web-accounts` | core-P2-L1 (addresses route lane per core's log) | `/sign-in`, `/register` (return to where the user was), `/account` (name, phone, addresses, sign out), address add and edit dialogs |
| web-P2-L3 | `web-cart` | core-P2-L4 | guest cart reducer in `localStorage` (merge at sign-in, clamping, store change with confirm dialog clearing the cart), cart drawer (lines with Steppers, fee line, free-delivery nudge from `shortfallCents`, min-order notice, "Proceed to checkout" sending to sign-in when signed out), sticky bottom bar on phone, header cart button on desktop; Vitest on the reducer (guest merge, clamping, store change) |
| web-P2-L4 | `web-checkout-orders` | core-P2-L5 | `/checkout` (address list with default selected, add-address dialog, summary, "Place order (COD)", `out_of_stock` highlights lines and offers removal), `/orders/{id}` tracking (timeline from events, promised-minutes countdown, items, address, cancel while allowed, poll every 10 s while not terminal), `/orders` history |
| web-P2-L5 | `web-e2e-flows` | core-P2-L6 (seed), admin-P2-L5 | the two Spec 2 §13 end-to-end flows in `apps/web/e2e`, driving both origins (the Playwright config also builds and serves the admin preview on 15174 under `/admin/`): register, pincode, browse, add two products, change a quantity, sign out and in to see the merged cart, checkout with a new address, order placed; store staff advance it to delivered on the board; tracking shows delivered. Second flow: admin creates a product and sets stock, customer finds it by search. axe on every page visited |

Acting manager: the orchestrator session (D21) until a `/manage web` session starts; that session takes over by reading this file. Gates per PR: `make test-web`, `make e2e` (one at a time; say so in `## Doing`), `openspec validate --all --strict`, the manager's own Chrome walk-through against a running core with the demo seed.
