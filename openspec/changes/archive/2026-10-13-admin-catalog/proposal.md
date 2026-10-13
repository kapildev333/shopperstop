# Proposal

## Why
Admins run the catalog: the two-level category tree with its sort order and images, and the products customers buy, with their prices, active flag and image (Spec 2 §8). `apps/admin` has `/categories` and `/products` placeholders (a `PageHeader` each, from admin-P2-L1) and nothing else. core-P2-L3 (`core-catalog`, merged #87) serves the admin catalog routes, the image uploads and the public `/files` images; this change, admin-P2-L3 (area `admin`), gives admins the pages that call them.

## What Changes
- `/categories` (admin only): one `Table` with `stack` named "Categories" holding the tree in core's order (each parent, then its children), with a 1:1 image tile, the name (children indented), the parent ("Top level" for a parent), the sort order, and "Edit <name>" and "Delete <name>" buttons; a "New category" button; loading, empty and error states.
- Category create and change in a `Dialog` (Cancel first): "Name", "Parent" (create only: "None (top level)" or a parent; core never moves a category), "Sort order" (whole number, 0 to 9999); a change sends only the changed fields; every save reloads the tree, so a new sort order moves the row.
- Category delete in a confirmation `Dialog`; a 409 `conflict` (children or products) is explained in the dialog.
- `/products` (admin only): a `Table` with `stack` named "Products" of one page of 24 (image tile, name linking to `/products/{id}` with the brand, category as "Parent › Child", unit, price with MRP, Active/Inactive badge), a search form, a "Category" filter (every parent and child) and a "Status" filter (active and inactive, active, inactive), a pager ("Previous", "Page x of y, n products", "Next"), "New product"; loading, empty and error states.
- `/products/new` and `/products/{id}`: the product form ("Name", "Brand", "Category", "Unit", "MRP (₹)", "Price (₹)", "Description", "Status" Active or Inactive); amounts typed in rupees and sent in paise; create opens the new product; a change sends only the changed fields (`""` clears brand or description, never `null`) and shows "Product saved."; core's `validation` errors on their fields; an unknown id shows the not-found page.
- Product delete in a confirmation `Dialog`; a 409 `conflict` (the product was ordered) explains why and offers "Deactivate instead", which sends `PATCH {"isActive":false}` and opens `/products`.
- Image upload on the product page and in the category edit dialog: a labelled native file input (`image/png,image/jpeg,image/webp`) inside `FormField`; picking a file uploads it at once with one multipart `PUT`; the client refuses other types and files over 5 MiB without a request; core's 400 on `file` shows on the field; the 1:1 tile shows the stored image (a counter in the query string makes a same-URL re-upload load the new bytes).
- e2e (`e2e/catalog.spec.ts`) against the real core and the demo seed: the seeded admin reads the tree, searches and edits a product price and restores it, creates a product, uploads a generated PNG, sees the tile, deletes the product; store staff get not found on both pages; axe on every page and dialog visited.

## Capabilities

### New Capabilities
None. `admin-catalog` already exists and stays core's HTTP capability (seeded by core-catalog).

### Modified Capabilities
- `admin-app`: ADDED requirements for the categories page, the products table, the product form, product and category delete, image upload and the catalog e2e (same call as admin-auth-nav and admin-stores: the client side of a flow is app behaviour).

## Out of scope
- Moving a category to another parent (core never changes `parentId`), drag-and-drop or up/down reordering, bulk edits, CSV import.
- Stock per store (admin-P2-L4 `admin-stock`); the product form does not set stock.
- Removing an image (core has no route); a leave-page warning for unsaved edits; filters kept in the URL.
- Any `packages/ui` or `services/core` change. `ImageTile` stays an app-level recipe until ui ships one (request to ui in the lane log).

## Impact
- Code: `apps/admin/src/` only (new `catalog.ts`, `image.tsx`, `categories.tsx`, `product-form.tsx`, their tests, the four catalog routes, fixtures in `fake-core.ts`, regenerated `routeTree.gen.ts`) and `apps/admin/e2e/catalog.spec.ts`. No new dependency, no config change: `imageUrl` is `/api/core/v1/files/...`, which the existing `/api` dev and preview proxies already serve.
- Cross-area contracts relied on: `services/core/openapi.json` through `@shopperstop/ui/api` (`packages/ui/src/api/core.d.ts`: the category, product and image operations and schemas); the `@shopperstop/ui` exports `Badge`, `Button`, `Card`, `Dialog`, `DialogFooter`, `EmptyState`, `ErrorBanner`, `FormField`, `Input`, `PageHeader`, `Price`, `Select`, `Skeleton`, `StatusMessage`, `Table`, `buttonClass`, `cn`; `tokens.css` through the app's Tailwind theme; core's demo seed (D22) for the e2e.
- Base: admin-P2-L2 (`admin-stores`) on main: `src/stores.ts` (`toCents`, `toRupees`), the fake-core helpers and the e2e helper shape. Task 0 rechecks after the rebase.
