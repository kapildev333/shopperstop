# Proposal

## Why
Store staff keep their store's stock right and admins do it for any store (Spec 2 §8): what a store holds decides what customers can order there. `apps/admin` has a `/stock` placeholder (a `PageHeader` from admin-P2-L1) and nothing else. core-P2-L4 (`core-stock-cart`, merged #106) serves `GET` and `PUT /admin/stores/{id}/stock`; this change, admin-P2-L4 (area `admin`), gives staff the page that calls them.

## What Changes
- `/stock` (admins and store staff): a `Table` with `stack` named "Stock" of one page of 24 active products at one store: name with brand, unit, price, the quantity in a text field labelled "Quantity of <name>", and a "Low stock" badge when the quantity core holds is below 5 (zero included, core's threshold).
- The store: an admin gets a "Store" selector of every store (first 100 by name); the chosen store is in the URL (`?store=<id>`), the first store when the URL names none or one that does not exist. Store staff get their own store, no selector and no stores request, whatever the URL says; they see "Store: <name>", read from the public `GET /stores/{id}`, and the page works without it when that request fails.
- A search form (`q`), a "Low stock only" toggle (`lowStock=true`) and a pager ("Previous", "Page x of y, n products", "Next"), all held in the URL, so a reload or a shared link shows the same list. Any change of store, search or filter starts again at page 1. The buttons at the ends of the pager, and "Save changes" and "Discard changes" with nothing to save, are `aria-disabled`, never `disabled`, and keep keyboard focus. While the next page, search or filter loads, the rows on screen stay, `aria-busy` and dimmed, under the page number core answered for them, with read-only quantity fields. The search field follows the URL, also on Back and Forward. A URL value core would refuse (a huge `page`, a `q` over 100 characters or with a NUL) is cut before core is asked.
- Edits: a typed quantity is an unsaved edit for that product. Edits are kept in one place for the store across pages, search and filter; the page counts them ("2 unsaved changes"), marks each edited row "Unsaved", and "Discard changes" drops them. A quantity typed back to what core holds is no edit.
- Save: "Save changes" sends every edit in ONE `PUT /admin/stores/{id}/stock` (`{rows:[{productId,quantity}]}`), at most 500 rows (core's limit); edits beyond 500 stay unsaved for the next save. After the 204 the page shows "Stock saved." and the list as core now holds it, including pages visited before the save. While the save runs the button reads "Saving…", stays focusable (`aria-disabled`, never `disabled`) and a second press sends nothing.
- What cannot be saved: a quantity that is not a whole number from 0 to 100000 is marked as it is typed, and "Save changes" then sends nothing and names the products. A 400 `validation` from core (a changed product was deleted) and any other failure show an alert and keep the edits; the alert goes when a quantity is edited.
- Switching store with unsaved edits asks first in a `Dialog` (Cancel, then "Discard and switch"). Edits are tied to their store and dropped by any change of store, also through the URL, Back or Forward, so they are never shown for or sent to another store and do not come back.
- Loading, empty ("No products found"), load-failure and no-stores states.
- e2e (`e2e/stock.spec.ts`) against the real core and the demo seed: the seeded admin picks Koramangala, filters to low stock, searches Sunny Fields Toned Milk, changes its quantity, meets the discard dialog, saves, reloads, sees the new quantity and puts the old one back; the seeded Koramangala store staff see their store, named, without a selector and are not moved by a `store` in the URL; axe on every state visited.

Area: admin. Capability: `admin-app` (ADDED requirements only).

## Capabilities

### New Capabilities
None. `stock` is core's capability (seeded by core-stock-cart); the page is behaviour of the admin app, as admin-auth-nav, admin-stores and admin-catalog decided for their pages.

### Modified Capabilities
- `admin-app`: ADDED requirements, every name starting with "Stock": the table, the store for admins and for store staff, search and the low-stock filter, the pager, the states, edits, save, quantities the page cannot send, save failures, the store switch, and the e2e.

## Out of scope
- Product images in the table (no `ImageTile` in `@shopperstop/ui` yet; admin-catalog's app-level copy is not on main), category filter, sorting, CSV import or export, stock history.
- A warning when leaving the page or closing the tab with unsaved edits; Enter in a quantity field saving; a sticky save bar.
- More than 500 edits in one request (one press sends the first 500; press again for the rest).
- The dashboard's low-stock count and its link here (admin-P2-L5); the link target this change provides is `/stock?store=<id>&lowStock=true`.
- Any `packages/ui` or `services/core` change.

## Impact
- Code: `apps/admin/` only: new `src/stock.ts`, `src/stock.test.tsx`, `src/stock-rules.test.ts`, `e2e/stock.spec.ts`; `src/routes/_staff/stock.tsx` replaces the placeholder. No new dependency, no config change, no `routeTree.gen.ts` change (the route exists), no edit to `src/fake-core.ts` (the stock fixtures live in the test file).
- Cross-area contracts relied on: `services/core/openapi.json` through `@shopperstop/ui/api` (`packages/ui/src/api/core.d.ts`: operations `getStock`, `putStock` and the public `getStore`, the path `/admin/stores`, schemas `StockRow`, `StockList`, `StockUpdate`, `AdminStore`, `Store`, `Staff.storeId`, `Error`); the `@shopperstop/ui` exports `Badge`, `Button`, `Card`, `Chip`, `Dialog`, `DialogFooter`, `EmptyState`, `ErrorBanner`, `FormField`, `Input`, `PageHeader`, `Price`, `Select`, `Skeleton`, `StatusMessage`, `Table`; `tokens.css` through the app's Tailwind theme; core's demo seed (D22) for the e2e.
- Base: cut from main at 503e1ba, since rebased onto main with admin-catalog merged (admin suite 95 before task 1).
