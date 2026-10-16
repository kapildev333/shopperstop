## Why

After `mobile-cart` (L3) and `mobile-checkout` (L4b) the app covers every customer screen, each with its own e2e suite, but nothing drives one customer through all of them in a row. Spec 2 §13 asks for that flow: register, pincode, browse, two products, a quantity change, sign out and in with the cart merged, checkout with a new address, placed, then delivered. The web suite holds it (`web-app` "Customer cross-app end-to-end flows", `apps/web/e2e/flows.spec.ts`); this change gives the mobile suite the same flow on the web export, closing Phase 4's L5 (D40, D42).

## What Changes

- Area: mobile. Capability touched: `mobile-app` (one ADDED requirement).
- `apps/mobile/e2e/flow.spec.ts` (new): one Playwright test at 390×844 against core with the demo seed. The customer half is taps only (register, pincode sheet, category, search, cart sheet, account, sign-in, checkout, address sheet, Place order); the store-staff half moves the order to `delivered` through core's staff route `POST /admin/orders/{id}/status` as the seeded Koramangala store staff, because the admin app is not part of the mobile suite. The tracking screen, left open, shows the delivery through its 10 s poll. axe runs on every screen and open sheet.
- Unlike web's flow, the guest-cart merge is exercised inside the flow: the second product is added as a guest after sign-out and merged into the server cart at sign-in.

Out of scope: product code (the flow only drives what L1 to L4b built; a failure that needs an app change stops the lane and goes to the manager); the admin app; the second §13 flow ("admin product found by customer search", which needs the admin app; the web suite holds it); extracting shared e2e helpers (design.md Decision 3); native device e2e (D37 ceiling).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-app`: ADDED requirement "Mobile customer flow end-to-end" with its scenario.

## Impact

- Files: `apps/mobile/e2e/flow.spec.ts` (new), this change, `.claude/lanes/mobile-P4-L5b*.md`. No other spec file and no app file.
- Cross-area contracts relied on, unchanged: `services/core/openapi.json` (`GET /stores/{id}`, `GET /stores/{id}/products`, `POST /admin/auth/sign-in`, `POST /admin/orders/{id}/status`; the app's own calls as L1 to L4b use them). No rider route is driven; the tracking screen's rider read answers without a delivery and the card stays hidden. No new dependency.
- Depends on mobile-P4-L3 (`mobile-cart`) and mobile-P4-L4b (`mobile-checkout`) merged on main; the worker starts only after both.
