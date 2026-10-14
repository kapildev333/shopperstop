# Proposal

## Why
Admins decide who may use the panel and for which store (Spec 2 §8, `/staff`: "Table and create or edit dialog"). `apps/admin` has a `/staff` placeholder (a `PageHeader` from admin-P2-L1) and nothing else; core-P2-L1 serves `GET` and `POST /admin/staff-users` and `PATCH /admin/staff-users/{id}`. Two more gaps close with it. core-P2-L6 (#154) added `imageUrl` to the stock rows, so the stock table can show the product image admin-stock left out. And Spec 2 §13 names an admin flow no e2e runs as one flow yet: "admin creates a product and sets stock". This change is lane admin-P2-L6 (area `admin`), the last admin page lane of Phase 2.

## What Changes
- `/staff` (admins only; store staff get the app's "Page not found", as on every admin-only route): a `Table` with `stack` named "Staff users" from `GET /admin/staff-users?pageSize=100`, in core's order (by email): name (with a "You" badge on the signed-in admin's own row), email, role ("Admin" or "Store staff"), store (the store's name; "All stores" for an admin), an "Active" or "Inactive" badge, and an "Edit" button. No pager and no filter; when core holds more than 100 the page says the list is cut.
- States by admin-P2-L7's rule (#163): the alert with "Try again" only while the page holds nothing; a failed later read keeps the table, and the root layout's one notice says so. The page shows no notice of its own.
- "New staff user" opens a `Dialog` (Cancel first): name, email, password, role and, for store staff, the store. One `POST`; core's answer is written into the list, with no second read.
- "Edit" opens the same `Dialog` for a row. Core changes only the name, the password and the status, so the email, the role and the store are shown as text; "New password" left empty keeps the password. One `PATCH` with only what changed; nothing changed sends nothing.
- An admin's own row: no "Status" field (core would accept the deactivation and end the admin's own session; the panel does not offer it, so the admin at the screen can never lock the last admin out). A saved name shows in the banner at once.
- Every refusal core can give is shown: a 400 naming a field on that field in the page's words, the taken email (409) on "Email", anything else (404, 5xx, an answer without core's error body) as one alert in the dialog. An edit clears it.
- While a save runs the button reads "Saving…", stays focusable (`aria-disabled`, never `disabled`), a second press or Enter sends nothing, and Cancel and Escape wait for the answer.
- Passwords: `type="password"`, `autocomplete="new-password"`, never rendered as text, never logged, held only by the open dialog, and not kept in the mutation cache after the save.
- `/stock`: a first column "Image" with the product's 1:1 tile (the app's `ImageTile` from `src/image.tsx`, a placeholder when the row has no `imageUrl`).
- e2e against the real core and the demo seed, axe on every page and open dialog:
  - `e2e/staff.spec.ts` (new): the admin creates a store-staff user for Indiranagar (the seeded id `…0402`); that user signs in in a second browser context, sees Dashboard, Orders and Stock only, their store named on `/stock`, and "Page not found" on `/staff`; the admin deactivates them and their next page is the sign-in page.
  - `e2e/catalog.spec.ts`, inside "admin runs the catalog": between the upload and the delete of "E2E Curd Cup", the admin opens `/stock?store=<Koramangala, …0401>`, finds the product with its image tile and quantity 0, saves 12, reloads and sees 12. This is Spec 2 §13's "admin creates a product and sets stock" as one flow; the delete that follows cleans up (core drops the stock row with the product).

Area: admin. Capability: `admin-app` (ADDED requirements only).

## Capabilities

### New Capabilities
None. `admin-staff` is core's capability (the staff routes, sessions and the seed); the page is behaviour of the admin app, as admin-auth-nav, admin-stores, admin-catalog, admin-stock and admin-orders-dashboard decided for their pages. `admin-staff` is not changed: nothing here asks core for anything new.

### Modified Capabilities
- `admin-app`: 13 ADDED requirements. Ten start with "Staff user" or "Staff users" (the table, its states, the list beyond one page, admins only, create, change, the own account, form errors, a save in progress, passwords), then "Stock product image", "Staff users against core" and "Product and stock against core". Nothing is MODIFIED: "Stock table" lists what a row shows and stays true with one more column; "Catalog against core" lists steps that still happen in that order.

## Out of scope
- Deleting a staff user (core has no route); changing an email, a role or a store (core refuses: create a new user and deactivate the old one).
- A pager, search or filter on `/staff`; a page per staff user (core has no read of one staff user).
- Password strength rules beyond core's 8 to 72 bytes; a "show password" control; sending the new user their password.
- Telling an admin who else is signed in; ending sessions other than by deactivating.
- The store-staff half of Spec 2 §13 (sign in as store staff, see the order on the board, advance it to delivered): admin-P2-L5's `e2e/orders.spec.ts`. "Customer finds it by search" in §13's second test: the customer site's suite (area `web`).
- A shared `ImageTile` in `packages/ui` (asked of ui by admin-P2-L3; the app-level one is used until it lands).
- Any `packages/ui` or `services/core` change.

## Impact
- Code: `apps/admin/` only. New: `src/staff.ts`, `src/staff-dialog.tsx`, `src/staff-fake.ts` (test-only), `src/staff.test.tsx`, `src/staff-dialog.test.tsx`, `e2e/staff.spec.ts`. Replaced: `src/routes/_staff/_admin/staff.tsx` (the placeholder). Edited: `src/routes/_staff/stock.tsx` (two inserted lines), `src/stock.test.tsx` (one test appended), `e2e/catalog.spec.ts` (two insertions). No new dependency, no config change, no `routeTree.gen.ts` change (the route exists), no edit to `src/fake-core.ts`.
- Cross-area contracts relied on, none changed: `services/core/openapi.json` through `@shopperstop/ui/api` (`packages/ui/src/api/core.d.ts`: operations `listStaffUsers`, `createStaffUser`, `patchStaffUser`, the path `/admin/stores`, schemas `Staff`, `StaffList`, `StaffCreate`, `StaffPatch`, `AdminStore`, `StockRow.imageUrl`, `Error`); the `@shopperstop/ui` exports `Badge`, `Button`, `Card`, `Dialog`, `DialogFooter`, `ErrorBanner`, `FormField`, `Input`, `PageHeader`, `Select`, `Skeleton`, `StatusMessage`, `Table`; `tokens.css` through the app's Tailwind theme; core's demo seed and the ids it prints (`services/core/internal/seed/summary.go`): staff `…0101` to `…0103`, stores `…0401` and `…0402`.
- Base: the branch was cut from main at 04e68ca (admin suite 160). admin-P2-L7 (#163) has merged since (admin suite 180); the manager rebases the branch onto main before task 1, and every count in tasks.md is "base + n".
