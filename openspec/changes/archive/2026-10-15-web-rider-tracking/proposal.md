# web-rider-tracking

## Why

Phase 3 (PLAN.md D30, D32, D34) puts riders on orders. Core now snapshots `Order.riderName`, records rider events with `actorType` `rider` and `actorName`, and freezes `promisedMinutes` and `storeName` on every order. The rider service answers the customer's `GET /api/rider/v1/orders/{orderId}/delivery` with the rider's name, the delivery status and the last position. The customer's tracking page shows none of it, and still counts down from the store's current promise. Separately, ui-P3-L1 shipped `ImageTile` and `ChoiceGroup`, so web's app-level image tile and checkout's `Chip` address group are copies to retire (D34).

## What Changes

- Tracking page: a "Rider" card from `out_for_delivery` on (name, status badge, "Last seen <relative time>" and an "Open in Maps" link while the rider read carries a position). A second `openapi-fetch` client on `/api/rider/v1` with the customer token and the existing middleware; read only from `out_for_delivery` on, polled every 10 s with the order while it is out for delivery; its 404 shows nothing.
- "Status history" names the rider on rider events: "Picked up by <name>", "Delivered by <name>".
- The countdown uses `placedAt` plus `Order.promisedMinutes`; the tracking page stops reading the store.
- `ImageTile` from `@shopperstop/ui` replaces the app's copy at its five call sites; checkout's address chips become a `ChoiceGroup` radio group "Deliver to".
- `vite.config.ts` proxies `/api/rider` to the rider service (8081 dev, 18081 preview); the Playwright config also starts the rider service and the global setup resets the rider demo seed; two e2e tests read the rider card against core and rider.

Area: web (`apps/web/`). Out of scope: a map library or embedded map (D32 ceiling), location history, the rider app and the live three-app flow (rider-P3-L3), admin (admin-P3-L1), any change to core, rider or `packages/ui`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-app`: ADDED "Customer order rider card", "Customer rider last seen", "Customer order rider read", "Customer status history names the rider"; MODIFIED "Customer site reaches core through a same-origin proxy" (rider proxy), "Customer site end-to-end suite with axe" (rider service and seed), "Customer order countdown" (the order's own promise), "Customer checkout address choice" (radio group).

## Impact

- `apps/web/src/api.ts`, `orders.ts`, `order-parts.tsx`, `order-tracking.tsx`, `checkout.tsx`, `product-card.tsx`, `cart-drawer.tsx`, `routes/index.tsx`, `routes/p.$slug.tsx`, their tests; `apps/web/vite.config.ts`, `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/orders.spec.ts`, `e2e/smoke.spec.ts`, `e2e/checkout.spec.ts`, `e2e/flows.spec.ts`.
- Cross-area contracts relied on, unchanged: `services/core/openapi.json` (`Order.riderName`, `Order.promisedMinutes`, `OrderEvent.actorType` `rider`, `OrderEvent.actorName`); `services/rider/openapi.json` `GET /orders/{orderId}/delivery` (200 `CustomerDelivery`, 401, 404) and `GET /healthz`, through `@shopperstop/ui/api/rider`; `@shopperstop/ui` exports `ImageTile`, `ChoiceGroup`, `Choice`, `VisuallyHidden`, `ButtonLink`, `Badge`; `openspec/specs/deliveries` "Customers see their order's delivery" and "Delivery demo seed"; the Makefile's `E2E_ENV` (rider :18081, `shopperstop_rider_e2e`).
