# Proposal

## Why
Phase 3 adds the rider service (D29 to D32). Staff need to manage the riders of their stores, and see on the Orders board and the order sheet which rider took an order out (D30's `riderName` and `actorName`). Core's backlog lane (core-P3-L2, D34) gives the board one request for every active order with a total, and the dashboard each store's `isOpen`. ui-P3-L1 (D34) shipped the components that `apps/admin` still copies at app level. This change, admin-P3-L1 (area `admin`), does all four.

## What Changes
- `/riders` for admins and store staff ("Riders" in the nav after "Stock"): a table of riders by email (name, email, phone, store for admins, Active or Inactive); admins choose "All stores" or one store (in the URL as `store`); store staff see their own store's riders and "Store: <name>". A "New rider" dialog (name, email, phone, password, store for admins) and an "Edit <name>" dialog (name, phone, new password, status). The page calls the rider service through a second `openapi-fetch` client on `/api/rider/v1` that shares the core client's middleware: the staff token on every request, a 401 to it ends the session, a failure without the error envelope reaches callers as code `internal`.
- The Orders board asks core once per poll (`GET /admin/stores/{id}/orders?active=true&pageSize=100`) instead of five times, and says "Showing the newest <n> of <total> active orders." when core holds more.
- A board card and the order sheet show "Rider: <name>" once a rider took the order out; an event a rider made reads "<Status> by <rider name>".
- Each dashboard card shows "Open" or "Closed".
- ui swaps, behaviour kept: `ImageTile` (with `alt` and the admin border), `aria-disabled` styling from `Button` (the app's `idle` classes go), `VisuallyHidden live` for the "New orders" region, `Button size="compact"` for an order number in a card or table cell, and the cancel `Dialog` opening over the order `Sheet` instead of in its place (Escape closes only the dialog; after a cancel the keyboard lands on the result inside the sheet).
- Dev and preview proxies send `/api/rider` to the rider service (8081, 18081) ahead of `/api` to core; the e2e suite starts the rider service and resets its demo seed as it does core's.
- e2e: `e2e/riders.spec.ts` (an admin lists, filters, creates and deactivates a rider against the real rider service; store staff see only their store's riders); `e2e/orders.spec.ts` checks the seeded delivered order's rider in History and the dashboard's "Open"; the three nav assertions gain "Riders".

Area: admin. Capabilities: `admin-app` (MODIFIED), `admin-riders` (ADDED, new).

## Capabilities

### New Capabilities
- `admin-riders`: the riders page of the admin app: table, store choice, store staff's view, states, create, change, errors, save in progress, the staff session on the rider client, and the e2e against the rider service.

### Modified Capabilities
- `admin-app`: Core reached through a same-origin proxy (and the rider service), End-to-end suite with axe (rider service started and seeded), Role-based navigation (Riders), Orders board (one request, more than a page, rider on the card), Orders board polling, Orders board states and Orders kept on a failed refresh (the one-of-five-lists scenarios go), Order detail sheet (rider and rider events), Order cancel with a reason (dialog over the sheet), Dashboard (Open or Closed), Orders against core (rider in History, Open).

## Out of scope
- Rider deliveries, locations or a rider's history in the panel (rider-P3-L2's routes are for riders, not staff); assigning a rider to an order from the panel (D32: riders claim).
- A rider column in History, or a rider filter; a pager on /riders (first 100 by email, said on the page); deleting a rider (the service has no route; deactivate instead); moving a rider to another store (the service does not allow it).
- Any `packages/ui`, `services/core` or `services/rider` change; the core demo seed (requested of core, see design.md).

## Impact
- Code: `apps/admin/` only. New: `src/riders.ts`, `src/riders-fake.ts` (test-only), `src/rider-dialog.tsx`, `src/routes/_staff/riders.tsx`, `src/riders.test.tsx`, `src/rider-dialog.test.tsx`, `e2e/riders.spec.ts`. Changed: `src/api.ts`, `src/nav.ts`, `src/routeTree.gen.ts` (generated), `src/image.tsx`, `src/order-board.tsx`, `src/order-sheet.tsx`, `src/order-history.tsx`, `src/orders.ts`, `src/orders-fake.ts`, `src/staff-dialog.tsx`, `src/routes/_staff/index.tsx`, `src/routes/_staff/stock.tsx`, `src/routes/_staff/_admin/categories.tsx`, `src/routes/_staff/_admin/products/index.tsx`, tests of the board, the sheet, the status actions, the dashboard and the shell, `vite.config.ts`, `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/orders.spec.ts`, `e2e/auth.spec.ts`, `e2e/staff.spec.ts`, `e2e/stores.spec.ts`. Deleted: `src/idle.ts`. No new dependency.
- Cross-area contracts relied on:
  - `services/core/openapi.json` through `@shopperstop/ui/api` (`packages/ui/src/api/core.d.ts`): on main `Order.riderName`, `OrderEvent.actorName`, `actorType` `rider` (core-P3-L1); from core-P3-L2 the `active` query parameter of `listStoreOrders` with `total`, and `DashboardStore.isOpen`.
  - `services/rider/openapi.json` through `@shopperstop/ui/api/rider` (ui-P3-L2, `packages/ui/src/api/rider.d.ts`): `paths` `/admin/riders` (GET with `store`, `page`, `pageSize`; POST) and `/admin/riders/{id}` (PATCH), schemas `Rider`, `RiderList`, `RiderCreate`, `RiderPatch`, `Error`.
  - `@shopperstop/ui` exports from ui-P3-L1: `ImageTile`, `VisuallyHidden`, `Button` `size="compact"` and its `aria-disabled` styling, stacking `Dialog` over `Sheet`; plus the ones already used (`Badge`, `Card`, `Dialog`, `DialogFooter`, `EmptyState`, `ErrorBanner`, `FormField`, `Input`, `PageHeader`, `Select`, `Skeleton`, `StatusMessage`, `Table`).
  - Demo seeds (D22): core's stores, staff and orders; the rider service's four riders (`…0801` to `…0804`, password `rider12345`); and, requested of core, `SS-DEMOAAAB` carrying `riderName` "Arjun Rao" with rider events.
