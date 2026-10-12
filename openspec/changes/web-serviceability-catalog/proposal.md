# Proposal

## Why
Spec 2 §7: a customer picks a pincode, the site resolves it to the dark store that delivers there, and the customer browses that store: Home (category rail, parent tiles, "Picked for you"), a category with child tabs and paged products, a product page, and search. Today `apps/web` has the shell, the API client and accounts (web-P2-L2) and an "Enter pincode" button that does nothing. The cart (web-P2-L3) and checkout (web-P2-L4) need a resolved store and product pages to add from.

## What Changes
- Pincode store: `localStorage` `shopperstop:pincode`, guarded like the session store, subscribable from React, holding also whether the pincode sheet is open.
- Pincode sheet (`@shopperstop/ui` `Sheet`: bottom on phone, side on desktop): opens on Home when no pincode is stored and from the header pincode control; validates six digits; saving stores the pincode and closes it.
- Store resolution: `GET /serviceability?pincode=` through TanStack Query on every load; the header control reads "Delivery in N minutes" and the pincode once an open store is resolved.
- One store gate on every catalog page: no pincode, not serviceable (404 `not_serviceable`), closed store (`isOpen` false), loading (Skeleton grid) and error (ErrorBanner with Try again) each render a full-page state; only an open store shows the page.
- Brand header search form (every page) going to `/search?q=`.
- Home `/`: category rail and a tile per parent category (`GET /stores/{id}/categories`), "Picked for you" (first 12 in-stock products of the first page of `GET /stores/{id}/products`).
- Category `/c/{slug}`: parent name, child tabs as `Chip`s ("All" plus each child, each a URL), product grid paged with `useInfiniteQuery`, loaded on scroll and by a "Load more" button.
- Search `/search?q=`: results grid paged the same way; no results suggests the parent categories.
- Product `/p/{slug}`: 1:1 image, name, unit, `Price` with MRP and "Save ₹N", stock note ("Only N left", "10+ left", D7), description, `Stepper` (out of stock disables it).
- Product card shared by Home, Category and Search: 1:1 image tile (`object-fit: contain`, placeholder icon when the product has no image), name and unit linking to `/p/{slug}`, `Price`, `Stepper`.
- `Stepper` changes go through one hook, `useCartQuantity(product)`, which here keeps a local count; web-P2-L3 replaces its body with the cart.
- Playwright `e2e/browse.spec.ts` against real core and the demo seed (D22), axe on every page and on the sheet.

Area: web. Capabilities touched: `web-app` (ADDED requirements; MODIFIED "Customer site shell" for the banner's search form and home link). Out of scope: the cart, its drawer and sticky bar, and the confirm dialog that clears the cart when the pincode moves to another store (all web-P2-L3, which wraps `setPincode`); checkout and orders (web-P2-L4); geolocation; recently used pincodes; Figma changes (the Customer web frames for Home with the pincode sheet, not serviceable, loading, error, Category, Product, Search and its empty state exist).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `web-app`: MODIFIED "Customer site shell"; ADDED "Customer pincode choice", "Customer pincode sheet", "Customer store resolution", "Customer store notices", "Customer product card", "Customer home page", "Customer category page", "Customer search", "Customer product page".

## Impact
- Files: `apps/web/**` (listed in design.md), this change folder; root `package-lock.json` only if `npm install` touches it (no new dependency).
- Cross-area contracts relied on:
  - core (`services/core/openapi.json` through `@shopperstop/ui/api`): `GET /serviceability?pincode=` → `Serviceability {store: Store}`, 404 `not_serviceable` (core-P2-L2 `core-stores-serviceability`); `GET /stores/{id}/categories` → `CategoryTree {items: CategoryNode[]}`, `GET /stores/{id}/products?categoryId=&q=&page=&pageSize=` → `StoreProductList {items: StoreProduct[], page, pageSize, total}`, `GET /stores/{id}/products/{slug}` → `StoreProduct`, 404 `not_found` (core-P2-L4 `core-stock-cart`, D24); `StoreProduct.imageUrl` and `Category.imageUrl` as `/api/core/v1/files/<kind>/<name>` paths, `GET /files/{kind}/{name}` and the demo catalog (core-P2-L3 `core-catalog`); `POST /admin/auth/sign-in`, `POST /admin/stores`, `PUT /admin/stores/{id}/service-areas` with the seeded admin (e2e only); `core-admin migrate` and `seed-demo --reset` (D22).
  - ui: `@shopperstop/ui` `Badge`, `Button`, `ButtonLink`, `Card`, `Chip`, `EmptyState`, `ErrorBanner`, `FormField`, `IconButton`, `Input`, `PageHeader`, `Price`, `formatInr`, `Sheet`, `Skeleton`, `Stepper`; `@shopperstop/ui/api` types; tokens. No ui change.
  - platform: `make e2e` environment (core :18080, `shopperstop_core_e2e`, preview 15173).
  - web-P2-L2 (same area, on main): `src/api.ts` (`api`, `queryClient`), `src/session.ts` pattern, the banner's `AccountLink`.

## Requests to other areas
- core: confirm the generated schema names `Serviceability`, `Store`, `CategoryTree`, `CategoryNode`, `StoreProduct`, `StoreProductList`; `pageSize` default 24 and maximum 100 on `GET /stores/{id}/products`; the 404 responses of `/serviceability` and `/stores/{id}/products/{slug}` documented in `openapi.json` (the client reads `response.status`).
