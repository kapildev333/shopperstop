# web-e2e-flows

## Why

Spec 2 §13 names two end-to-end flows that cross both apps: a customer's order from registration to delivered, moved by store staff on the admin board, and an admin's new product found by a customer's search. Each app's suite covers its own half today (web `checkout.spec.ts`, `orders.spec.ts`; admin `orders.spec.ts`, `catalog.spec.ts`), but nothing drives both origins in one test, so a break at the seam (an order placed on the web that the board does not show, a product created in admin that search does not find) passes every suite.

## What changes

- `apps/web/playwright.config.ts` also serves the built admin app with `vite preview` on port 15174 under `/admin/` (a third `webServer`, `reuseExistingServer` outside CI, as admin's own config does).
- New `apps/web/e2e/flows.spec.ts` with the two flows, axe on every page visited in both apps.

## Area and capabilities

- Area: web. Files: `apps/web/playwright.config.ts`, `apps/web/e2e/flows.spec.ts`. Nothing in `apps/admin/`, `services/core/`, `packages/ui/`, the Makefile or CI.
- Capability `web-app`: MODIFIED "Customer site end-to-end suite with axe" (the suite also serves the admin preview), ADDED "Customer cross-app end-to-end flows" (two scenarios).

## Contracts relied on

- `services/core/openapi.json` routes already served: register, sign-in, admin sign-in, store products, cart, addresses, orders, admin order status, admin products, admin stock.
- The admin app's visible names (labels, buttons, headings, regions) as its own e2e uses them (`apps/admin/e2e/orders.spec.ts`, `catalog.spec.ts`); a rename there breaks this suite. No `@shopperstop/ui` export or token is new.
- `make e2e` builds every workspace before any suite and sets `SHOPPERSTOP_CORE_WEB_ORIGINS` to both origins (unchanged).

## Out of scope

- Any page or component change in either app; any core change.
- Building the admin app from the web config: the web suite serves `apps/admin/dist` as `make e2e` built it.
- Phone-width runs of the flows (the per-app phone tests cover layout).
- Rider, payment, receipt flows (later services).
