## Why

Phase 3 gives the last leg of an order to riders (PLAN.md D29, D32). The rider service is on main with accounts, sessions (rider-service-foundation) and deliveries (rider-deliveries): ready orders, claims, delivered, location and the customer's delivery read. Riders still have no screen to use it. This change adds `apps/rider`, a phone-first web app served under `/rider/`, and seeds the capability `rider-app`. Its e2e suite also carries the Phase 3 cross-app flow: customer, store staff, rider.

## What Changes

- New workspace `apps/rider` (`@shopperstop/rider`), the same stack and shape as `apps/admin`: React 19, Vite 8 with `base: '/rider/'`, TanStack Router (file-based, `basepath: '/rider'`) and Query, Tailwind 4 with `@shopperstop/ui/tokens.css`, `openapi-fetch` 0.17.0, Vitest with Testing Library, Playwright with axe, `no-literal-colors.test.ts`. Dev server 5175 proxies `/api/core` to 8080 and `/api/rider` to 8081; preview 15175 proxies them to 18080 and 18081. npm scripts `dev`, `build`, `typecheck`, `lint`, `test`, `e2e`.
- Two same-origin clients: the rider client (`/api/rider/v1`, `paths` from `@shopperstop/ui/api/rider`) carries the rider token; the core client (`/api/core/v1`, `paths` from `@shopperstop/ui/api`) carries no token and only reads `GET /stores/{id}` for the store name in the banner.
- Session: token in memory and `localStorage` `shopperstop:rider-token`, restored with `GET /me`, cleared on a 401 that answers a request carrying it (admin's rule).
- Pages, phone-first at 390 px, composed from `@shopperstop/ui` only:
  - `/sign-in`: email and password.
  - `/` "Ready to pick up": the rider's own assigned deliveries first, then the store's ready orders as cards polled every 10 s, each with "Pick up" and a confirm `Dialog`; a 409 or 404 refusal is a `StatusMessage` and the list is read again.
  - `/deliveries/{id}`: customer, address, a `tel:` link, the items, the total with "Collect ₹X cash" for cash on delivery, "Mark delivered" with a confirm `Dialog`; while `assigned` the page reports the Geolocation position (first fix at once, then every 15 s).
  - `/history`: the rider's delivered deliveries.
- Banner: "ShopperStop Rider", the store name, the rider's name, "Sign out"; navigation "Rider" with "Pick up" and "History".
- e2e under `apps/rider/e2e`: Chromium with the `geolocation` permission and a fixed position; smoke, sign-in, the rider's flow against core and rider (pick up, location seen by the customer read, delivered, history), the cross-app flow over web (15173), admin (15174) and rider (15175), and a phone-width check; axe on every page visited.

Out of scope: a map (no map library is decided, D32), push notifications, offline or online state, delivery proof, cash reconciliation, batches, handing a delivery back; any change to `services/rider`, `services/core`, `packages/ui`, `apps/web` or `apps/admin`; the rider's name on the customer's tracking page (web-P3-L1). The cross-app flow checks the rider's name through the customer's API reads until web-P3-L1 is on main (design Decision 10).

## Capabilities

### New Capabilities

- `rider-app`: the rider web app: shell, where it is served and how it reaches core and rider, rider sign-in, session and sign-out, ready orders and pick up, the delivery page with delivered and location reporting, history, and the e2e suite with the Phase 3 cross-app flow.

### Modified Capabilities

None.

## Impact

- Area: rider. Files under `apps/rider/` and this change folder, plus the root `package-lock.json` entries npm writes for the new workspace (PLAN.md: lockfile changes from workspace installs are expected in app PRs).
- Cross-area contracts relied on:
  - `services/rider/openapi.json` through `packages/ui/src/api/rider.d.ts` (`@shopperstop/ui/api/rider`): `POST /auth/sign-in`, `POST /auth/sign-out`, `GET /me`, `GET /me/ready-orders`, `POST /me/deliveries`, `GET /me/deliveries`, `GET /me/deliveries/{id}`, `POST /me/deliveries/{id}/delivered`, `PUT /me/location`, and `GET /orders/{orderId}/delivery` (e2e only, with a customer's core token).
  - `services/core/openapi.json` through `packages/ui/src/api/core.d.ts` (`@shopperstop/ui/api`): public `GET /stores/{id}` (`name`); in e2e only, customer `POST /auth/register`, `POST /me/addresses`, `PUT /me/cart/items`, `GET /orders/{id}` (`riderName`), staff `POST /admin/auth/sign-in` and `POST /admin/orders/{id}/status`.
  - `@shopperstop/ui` exports: `Button`, `ButtonLink`, `Card`, `Badge`, `Dialog`, `DialogFooter`, `EmptyState`, `ErrorBanner`, `FormField`, `Input`, `PageHeader`, `Price`, `Skeleton`, `StatusMessage`, `Table` (`stack`), `TabNav`, `buttonClass`; `@shopperstop/ui/tokens.css`; `@shopperstop/ui/format` (`formatInr`); `@shopperstop/ui/testing` (`findLiteralColors`).
  - The web app's checkout ("Place order (COD)") and tracking texts ("Your order is out for delivery.", "Your order was delivered."), the admin app's sign-in and Orders board buttons ("Accept", "Start packing", "Mark ready" followed by the number), used by the cross-app e2e only.
  - `make e2e` (platform): runs `npm run build` and `npm run e2e` over every workspace with `E2E_ENV`; the demo seeds of core and rider (store `...0401`, riders `rider1-koramangala` and `rider2-koramangala`, delivered delivery `...0901`).
