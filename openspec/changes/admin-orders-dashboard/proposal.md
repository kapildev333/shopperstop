# Proposal

## Why
Store staff pack and hand over orders from the admin panel, and admins watch every store (Spec 2 §8 and §13): the Orders board is where a placed order becomes a delivered one. `apps/admin` has an `/orders` placeholder and a Dashboard placeholder (a `PageHeader` each, from admin-P2-L1) and nothing else. core-P2-L5 (`core-orders`, merged #137) serves the staff order routes and the dashboard; this change, admin-P2-L5 (area `admin`), gives staff the pages that call them.

## What Changes
- `/orders`, the board (admins and store staff): a column per active status (Placed, Accepted, Packing, Ready, Out for delivery) with its count; a card per order with its number, the time since it was placed, its item count, total and pincode, the longest waiting first. Core lists one status per request, so the board is five requests of 100.
- The store: an admin gets a "Store" selector, the chosen store in the URL (`?store=<id>`), the first store by default; store staff get their own store, named from the public `GET /stores/{id}`, with no selector. Everything the page keeps for a store is dropped on any change of store.
- Polling: the board asks core again every 10 seconds, not while the tab is hidden, and at once when it shows again. A hidden `role="status"` region announces newly placed orders ("New order SS-…"), never the first load, an unchanged answer or a failed poll. The time since placed moves on by itself.
- One next-status button per card ("Accept", "Start packing", "Mark ready", "Send out", "Mark delivered"), one `POST /admin/orders/{id}/status` per press; core's answer is written into the page, with no second listing. While it runs the button reads "Saving…", stays focusable (`aria-disabled`, never `disabled`) and no second change can be sent. "Mark delivered" asks first in a `Dialog`. A 409 reads the order again and says someone else changed it first; any other failure is an alert. A poll answer that core read before the change never moves the card back.
- The detail `Sheet`, from a card's or a history row's number: status badge, items and totals, the customer with phone, the address, the events; it reads the order from core and follows it every 10 seconds while it is active. "Cancel order" (placed or accepted only) opens a `Dialog` with a required reason, sent as the `note`, which core stores as the cancel reason.
- The History tab (`?tab=history`): a table of delivered orders, or cancelled ones (`?status=cancelled`), 24 a page with a pager in the URL; rows kept while the next page loads are `aria-busy`; URL values core would refuse are cut.
- A failed refresh never replaces what a page shows: the board, the history, the sheet and the dashboard keep their content, and the alert is only for a view with nothing to show. The notice "Could not refresh. Showing what was loaded last." is the app's one `RefetchNotice` at the root (admin-P2-L7); no page of this change renders one, except the order sheet, a modal over the root's, which shows the same words.
- `/`, the dashboard: a card per store core answers (every store for an admin, their own for store staff) with today's orders by status and in all, revenue today and the low-stock count, and links to that store's orders and to `/stock?store=<id>&lowStock=true` (admin-stock's URL contract).
- Status badges follow D28: `accent` under way, `success` delivered, `neutral` cancelled, always with the status as text; the seven names are the customer site's.
- e2e against the real core and the demo seed: `e2e/orders.spec.ts` (store staff take the seeded placed order `SS-DEMOAAAD` step by step to delivered and find it in History; an admin sees the dashboard cards and opens a store's orders), and one more test in `e2e/catalog.spec.ts`, deferred by admin-catalog until orders existed: deleting the ordered product `…0601` offers "Deactivate instead" (the offer is not taken). axe on every page, sheet and dialog visited.

Area: admin. Capability: `admin-app` (ADDED requirements only).

## Capabilities

### New Capabilities
None. `orders` is core's capability (seeded by core-orders); the pages are behaviour of the admin app, as every earlier admin lane decided for its pages.

### Modified Capabilities
- `admin-app`: 29 ADDED requirements, each name starting with "Order", "Orders", "Dashboard" or "Ordered product": the board, its store, polling, announcements, the time since placed, the states, what a failed refresh keeps, the next status, a change in progress, the delivered confirmation, the 409, failures, the poll race, the sheet, the cancel, badges, the history, its pager, URL values, the dashboard, and the e2e.

## Out of scope
- Sound or desktop notifications for a new order; a visible "new" marker on a card.
- Moving an order from the sheet (the card's button is the one way); moving several cards at once; drag and drop; undo.
- An order's page with its own URL (the sheet is page state); search, date range or customer filters in History; a merged delivered-and-cancelled list (core lists one status per request).
- More than the newest 100 orders of one status on the board.
- Auto-refresh of the dashboard (it refreshes on opening and when the tab is shown again); charts; a date other than today.
- Fixing the load-failure states of the existing pages (stores, products, categories, stock) and the root notice itself: admin-P2-L7 (`admin-keep-data-on-refetch-error`), which merges before this change.
- Any `packages/ui` or `services/core` change.

## Impact
- Code: `apps/admin/` only. New: `src/orders.ts`, `src/idle.ts`, `src/order-board.tsx`, `src/order-sheet.tsx`, `src/order-history.tsx`, `src/orders-fake.ts` (test-only), five test files, `e2e/orders.spec.ts`. Replaced: `src/routes/_staff/orders.tsx` and `src/routes/_staff/index.tsx` (the two placeholders). Appended: one test in `e2e/catalog.spec.ts`. No new dependency, no config change, no `routeTree.gen.ts` change (both routes exist), no edit to `src/fake-core.ts`.
- Needs on the branch before task 1: admin-stock (admin-P2-L4, merged), for `storeNameQuery` in `src/stock.ts`, the `/stock` route's `store` and `lowStock` search params (the dashboard's typed link) and `src/api.ts` turning a failure without core's error body into an `internal` envelope; and admin-keep-data-on-refetch-error (admin-P2-L7), for `RefetchNotice` in `src/routes/__root.tsx`, which three of this change's tests assert.
- Cross-area contracts relied on: `services/core/openapi.json` through `@shopperstop/ui/api` (`packages/ui/src/api/core.d.ts`: operations `listStoreOrders`, `getAdminOrder`, `setOrderStatus`, `getDashboard`, the public `getStore`, the path `/admin/stores`; schemas `Order`, `OrderItem`, `OrderEvent`, `OrderAddress`, `OrderList`, `OrderStatusChange`, `DashboardStore`, `Dashboard`, `AdminStore`, `Staff.storeId`, `Error`); the `@shopperstop/ui` exports `Badge`, `Button`, `Card`, `Chip`, `Dialog`, `DialogFooter`, `EmptyState`, `ErrorBanner`, `FormField`, `Input`, `PageHeader`, `Price`, `Select`, `Sheet`, `Skeleton`, `StatusMessage`, `TabNav`, `Table`, `buttonClass`, `cn`; `tokens.css` through the app's Tailwind theme; core's demo seed (D22) for the e2e: stores `…0401` and `…0402`, orders `…0701` to `…0703`, product `…0601`, the admin and the Koramangala store staff accounts.
