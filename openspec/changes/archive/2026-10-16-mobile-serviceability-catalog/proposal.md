## Why

The mobile app (Phase 4, D36 to D42) signs customers in but shows nothing to buy. This change adds the pincode, the store it resolves to, and browsing: the design canvas artboards 7 Pincode sheet, 8 Not serviceable / closed, 1 Home, 2 Category, 3 Product, 13 Search and 17 Change pincode, with the loading and error patterns of 18 and 19. It mirrors `web-app`'s serviceability and catalog requirements (D38) and gives the parallel lanes L4a (orders) and L3 (cart) the shared primitives they need (D42).

## What Changes

- Primitives in `src/ui/`, first so L4a can use them: `Price`, `Stepper`, `Dialog` with `DialogFooter`, `StatusMessage`, `ImageTile`; and the L1 leftovers: `ErrorBanner` reuses `Button`, inline styles move to `StyleSheet`, `Skeleton` gains a tile form, `FormField` takes tabular numbers (pincode fields), `EmptyState` takes a heading level, the Jest lucide mapping uses `require.resolve`.
- `src/pincode.ts`: the pincode in async storage `shopperstop:pincode` (new dependency `@react-native-async-storage/async-storage` 2.2.0, D37) and the pincode sheet's open state; `src/pincode-sheet.tsx`, mounted once in the root layout: the sheet, saved-address choices, and the "Switch to the <store> store?" dialog.
- `src/serviceability.ts`: `GET /serviceability` per pincode; `src/serviceability-gate.tsx`: the store notices (no pincode, loading, not serviceable, closed, failed) every browsing screen shows instead of its content.
- `src/cart.ts`: a stub of the cart hook holding Stepper counts in memory per store (L3 replaces its body; D42).
- `src/catalog.ts` and `src/catalog-*.tsx`: category, product-page and product queries, the product card, the category tile grid and the paged product grid.
- Screens: Home (header with the delivery promise, pincode control, account, search field; "Shop by category"; "Picked for you"), the Categories tab, `/category/<slug>`, `/product/<slug>`, `/search`.
- After core's D44 (#272): the category screen's "In stock" and "Price: low to high" chips as server-side filters, the store's city on Home's pincode button, and L4a's cancel dialog moved from its `Sheet` fallback to `Dialog` (task 15).
- For mobile-P4-L4a: `Dialog` / `DialogFooter` in its requested shape, `EXPO_PUBLIC_RIDER_URL=http://localhost:18081` in the `e2e` script, and TanStack `focusManager` wired to `AppState` in the root layout.
- `e2e/catalog.spec.ts`: pincode, notices, home, category, product, search and store change against core with axe.

Out of scope: the cart sheet, the cart bar, the guest cart in storage, the merge at sign-in and `DELETE /me/cart` (L3, which replaces `src/cart.ts`; the "Could not empty your cart." path is specified here but can only fail once L3's clear calls core); orders (L4a); icon, splash, EAS, `expo-splash-screen` and the `test` script's `node --test` step (L5a); the descending price sort; live search while typing; native device e2e.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-app`: Home's heading and the tabs requirement no longer fix the content of Categories and Orders; the e2e register scenario follows the new heading; ADDED requirements for the pincode, store resolution and notices, the product card, Stepper, cart counts, Home, Categories, Category, paged lists, Search, Product, the store change confirm and dialogs.

## Impact

- Area: mobile. Files: `apps/mobile/**` within the lane's scope (design.md "Files"), this change's folder, `docs/design/mobile-P4-L2.md`, `.claude/lanes/mobile-P4-L2*.md`, and the root `package-lock.json` (mechanical, from `npm install` in task 6).
- Cross-area contracts relied on, unchanged: `services/core/openapi.json` through `@shopperstop/ui/api` (`GET /serviceability`, `GET /stores/{id}/categories`, `GET /stores/{id}/products`, `GET /stores/{id}/products/{slug}`, `GET /me/addresses`; the e2e suite also uses `POST /admin/auth/sign-in`, `POST /admin/stores` and `PUT /admin/stores/{id}/service-areas` to make a closed store, as `apps/web` does); catalog image paths served by `GET /files/{kind}/{name}`; `@shopperstop/ui/tokens`, `@shopperstop/ui/format` (`formatInr`) and `@shopperstop/ui/testing`. No rider route is used.
- Archive order: the MODIFIED requirements need `openspec/specs/mobile-app` (on main since #255); the branch is based on d913577 and must be rebased on main before archive.
