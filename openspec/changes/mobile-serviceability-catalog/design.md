## Context

`apps/mobile` (L1, #253, archived #255) has the Expo 58 / React Native 0.88 shell, the core client (`src/api.ts`), the session, sign in, register, account and addresses, and the primitives `Text`, `Button`, `IconButton`, `FormField`, `Badge`, `Chip`, `Card`, `Sheet`, `Toggle`, `EmptyState`, `ErrorBanner`, `Skeleton`. Home is a placeholder with the heading "Groceries in minutes"; Categories is empty. L1's decisions (`openspec/changes/archive/2026-10-16-mobile-foundation-accounts/design.md`) stay binding: tokens only from `@shopperstop/ui/tokens` (Decision 7), sheets as `Modal` named by their title (8), `Toggle` not `Switch` (14), document titles (15), one navigating router test per file (18), the loading and error pattern (10).

Workers cannot open the canvas: `docs/design/mobile-P4-L2.md` carries the artboard data in token names, the copy, and the module interfaces.

### web-app requirements mirrored

| mobile-app requirement | mirrors web-app | differs |
|---|---|---|
| Mobile pincode choice | Customer pincode choice | async storage (`localStorage` on the web export) read once, asynchronously: "not yet known" state; a choice made meanwhile wins |
| Mobile pincode sheet | Customer pincode sheet, Customer pincode sheet focus | canvas copy ("Where should we deliver?", "Continue"); digits only; Continue disabled until valid; saved-address choices when signed in; sign-in link when signed out |
| Mobile store resolution | Customer store resolution | promise in the header heading ("ShopperStop in 10 minutes"); "Delivering to <pincode>" button |
| Mobile store notices | Customer store notices | canvas copy; closed notice links to orders; failure uses the L1 error state (offline / server) instead of "Could not check your pincode." |
| Mobile product card | Customer product card, Customer product card layout | stock badge on the card (canvas); link named "<name> <unit>" |
| Mobile Stepper | `Stepper` of `@shopperstop/ui` | large size for the product bar ("Add to cart") |
| Mobile cart counts before the cart | Customer cart behind every Stepper (partly) | in memory until L3 |
| Mobile home | Customer home page | no separate "Categories" navigation (the tab is it); four tiles to a row; "Picked for you" as a horizontal row |
| Mobile categories tab | (none: web has a header navigation) | D38 |
| Mobile category screen | Customer category page | left tab rail instead of chips; `/category/<slug>` instead of `/c/<slug>` |
| Mobile paged product lists | Customer paged product lists | `FlatList` `onEndReached` instead of an intersection observer |
| Mobile search | Customer search | own screen with the box in its header; heading counts results |
| Mobile product screen | Customer product page | breadcrumb, "N% off" instead of "Save ₹N", "Product details", "More in", bottom price bar (canvas); `/product/<slug>` |
| Mobile store change confirm | Customer store change confirm, Customer store change outcome | canvas copy ("Switch to the <store> store?", "Keep cart" / "Switch store"); clear is the L2 stub |
| Mobile dialogs | `Dialog` + `DialogFooter` of `@shopperstop/ui` | `Modal`, fade, no backdrop dismissal; pending state belongs to the caller |

## Goals / Non-Goals

**Goals:** primitives L4a and L3 need, first; pincode, store and notices; Home, Categories, Category, Product, Search; the change-store confirm against a stub cart; e2e with axe.

**Non-Goals:** cart sheet, cart bar, guest cart storage, merge, server cart (L3); orders (L4a); release config (L5a); category filters and city (contract, below); live search.

## Decisions

### 1. Primitives first, in `src/ui/`

`Price`, `Stepper`, `Dialog`, `StatusMessage` and `ImageTile` mirror the `@shopperstop/ui` components of the same names (interfaces in `docs/design/mobile-P4-L2.md`). They are tasks 1 to 4, parallel and first, so L4a (orders) can take them as soon as they land on this branch's PR; L4a never edits `src/ui/` (D42). `Dialog({ open, title, onClose, children })` and `DialogFooter({ children })` take L4a's requested shape (its `design.md` Requests 1): the dialog only frames; each caller puts its text, alert and `Button`s inside, cancel first in the footer, and owns any pending state. A danger confirm uses the existing outlined danger `Button` (as "Sign out" does), not the canvas's filled red: there is no `onDanger` token. L4a's cancel reasons (artboard 16 radios) can use `Chip` rows; no radio primitive is built here (ceiling: add one in `src/ui/` when a lane asks).

### 2. Pincode store: module state, async storage

`src/pincode.ts` mirrors `session.ts`: a module-level value with `useSyncExternalStore`. Async storage is asynchronous, so the store has `loaded`: the first `usePincode()` starts one read; until it settles the pincode is "not yet known" (screens show the loading state, Home does not open the sheet). A `setPincode` before the read settles wins (the read result is dropped). All storage calls sit in `try`/`catch` and never reject outward. On the web export async storage uses `localStorage`; the static render in Node never calls it (the read starts from a hook, in the client).

The sheet's open state lives in the same module (`openPincodeSheet`, `closePincodeSheet`, `usePincodeSheetOpen`) so any screen's control or notice button can open the one sheet that the root layout mounts.

### 3. Store resolution as a query

`useStore()` in `src/serviceability.ts` reads `['serviceability', pincode]`; the query function answers `{ store }` on 200 and `{ notServiceable: true }` on 404 `not_serviceable` (an answer, not an error), and throws `error.error` otherwise, as L1's queries do. It returns one discriminated state (`loading`, `none`, `open`, `closed`, `notServiceable`, `error`). Held data survives a failed refetch (L1 Decision 10). `resolvePincode(pincode)` is `queryClient.fetchQuery` on the same key, used by the sheet so the screen that opens next already has the answer.

`StoreGate` (`src/serviceability-gate.tsx`) takes a render function `(store) => content` and renders the notices otherwise. Each screen keeps its own header outside the gate.

### 4. Home heading

The header's level-1 heading is a `Text` with `accessibilityLabel` "ShopperStop in <N> minutes" holding the two visual lines (the eyebrow "SHOPPERSTOP IN" with `textTransform: 'uppercase'`, and "<N> minutes" in `display`), so the name is the same in Jest and on the web export whatever the line break or text transform. Without an open store the heading is "ShopperStop" (eyebrow only, artboard 8). Notice titles are level-2 headings, so every screen has exactly one level-1 heading. The L1 tests and e2e line that look for "Groceries in minutes" move to the new heading (task 11 and task 15).

The canvas's Home row "Dairy, bread & eggs · see all" is replaced by web's "Picked for you" (first 12 in stock of page one), which the area plan names; the row shape (horizontal, 148 wide cards) is the canvas's.

### 5. Cart stub

`src/cart.ts` (L3's file from then on) holds `{ storeId, quantities }` in memory with `useSyncExternalStore`: `useQuantity(productId)`, `setQuantity(storeId, productId, n)` (a different `storeId` first drops every count, as core's `PUT /me/cart/items` replaces a cart from another store), `useCartSummary()` / `getCartSummary()` (`count` = sum of quantities, `storeId`), and `clearCart(): Promise<ApiError | undefined>` (empties, resolves `undefined`). Nothing is persisted. L3 replaces the bodies and keeps the names, so the screens do not change. Ceiling: counts vanish on reload until L3.

No cart bar in L2: the area plan gives "the sticky cart bar on every browsing screen" to L3, and a bar whose "View cart" opens nothing would be a dead control.

### 6. Store change confirm

`PincodeSheet` (`src/pincode-sheet.tsx`) on Continue: `resolvePincode(value)`; when the answer has a store whose `id` differs from `getCartSummary().storeId` and `count > 0`, it closes the sheet and opens the `Dialog`; otherwise (same store, no counts, not serviceable, failed lookup) it stores the pincode and closes. The sheet is passive: Home opens it on first visit (task 11); the sheet never opens itself. Its sign-in link is an expo-router `Link` whose press also closes the sheet; the mount stays in the root layout beside the `Stack`, so the sheet covers stack screens (Category, Product, Search) as well as the tabs (task 10's ordered fallback if Jest cannot see the navigation). The old store's name is the one the current pincode resolves to in the query cache, else "another store". "Switch store" shows `loading` and the dialog ignores close while `clearCart()` is pending (a ref guards a second press); it awaits `clearCart()`; a returned error shows the alert "Could not empty your cart." in the dialog and keeps the pincode. The failure branch cannot be exercised before L3 (the stub never fails), so it is built but left untested here; L3 adds its test with `DELETE /me/cart` (Risks).

### 7. Routes

`src/app/category/[slug].tsx`, `src/app/product/[slug].tsx`, `src/app/search.tsx`, pushed onto the root `Stack` from the tabs. The category tab rail changes the slug with `router.setParams({ slug })` (no history pile-up); search submits with `router.setParams({ q })`. "More in" pushes a new product screen. Back uses L1's `useBack`.

Tabs on the category rail are `role="tab"` with `aria-selected` inside a `role="tablist"` named "Subcategories": a selected button is not valid ARIA (`aria-selected` is not allowed on `button`, axe `aria-allowed-attr`), and React Native has no `aria-pressed`.

The web export is `output: "static"`, and a direct load of `/product/<slug>` or `/category/<slug>` answers 404: `expo serve` has no fallback for dynamic routes (found by mobile-P4-L4a). As in L4a, the e2e suite reaches them only by in-app navigation. Ceiling: no deep link to a product or category on the static web export; native apps and in-app navigation are unaffected. No cheap app-side fix: `generateStaticParams` would need core's catalog at build time, and a server fallback belongs to the hosting (Caddy rewrite) when the web export is ever served for real.

### 8. Paged grid

`ProductGrid` (`src/catalog-grid.tsx`) is a `FlatList` with `numColumns={2}` over `useInfiniteQuery` (`pageSize` 24; next page while `page * pageSize < total`), `onEndReached` calling `fetchNextPage` only when `hasNextPage && !isFetchingNextPage`, and a footer "Load more" `Button` (secondary, `loading` while fetching). Before the first page: `Skeleton` tiles; first page failed: `ErrorBanner`. Empty first page: `EmptyState` "No products here yet" (category) or the search empty state (the screen passes it).

### 9. Images

`imageUrl` is a path (`/api/core/v1/files/...`); `imageUri(path)` in `src/catalog.ts` prefixes core's origin (`coreUrl` without `/api/core/v1`). `ImageTile` renders `Image` with `resizeMode="contain"`, hidden from assistive technology, or a `ShoppingBasket` placeholder on `canvas`. One image per product: the canvas's carousel dots are left out.

### 10. Search on submit

The box queries on submit (`onSubmitEditing`, `returnKeyType="search"`), as web's form does. Ceiling: no results while typing; add a 300 ms debounced `setParams` when asked.

### 11. L1 leftovers folded in

Task 5: `ErrorBanner`'s "Try again" is a `Button` (primary, md); `error-banner.tsx`, `chip.tsx`, `skeleton.tsx` move to `StyleSheet.create` and `spacing`; `Skeleton` gets `variant: 'rows' | 'tiles'` with `columns`; `FormField` gets `tabular` (`fontVariant: ['tabular-nums']` on the input) and the address sheet's Pincode uses it; `EmptyState` gets `level` (default 2; search uses 1); `jest.config.js` maps lucide through `require.resolve('lucide-react-native/dist/cjs/lucide-react-native.js')`. The placeholder inline styles in `(tabs)/index.tsx` and `(tabs)/categories.tsx` go away with tasks 11's rewrite.

### 12. package.json shared with L5a

L5a (release config) lands first and owns two `package.json` edits: `expo-splash-screen` 58.0.10 (D43) and the `test` script that also runs `node --test` over `scripts/*.test.mjs`. This change adds only `@react-native-async-storage/async-storage` 2.2.0 (task 6) and keeps both of L5a's edits as they are on main after the manager's rebase.

### 13. Requests from mobile-P4-L4a taken here

- `Dialog` / `DialogFooter` in L4a's shape (Decision 1, task 3).
- The `e2e` script exports `EXPO_PUBLIC_RIDER_URL=http://localhost:18081` beside `EXPO_PUBLIC_CORE_URL` (task 6), for L4a's rider card. If L4a reaches its e2e first, the manager may land that one line in L4a instead; task 6 then keeps it as it is.
- `focusManager` wired to `AppState` in the root layout (task 10): on iOS and Android TanStack Query has no window focus, so queries refetch on return only with this (`AppState` `change` → `focusManager.setFocused(state === 'active')`, skipped on web, which has its own focus events).

## Contract audit (core and rider openapi, 2026-10-16)

Every field these screens show exists: `Store` (`id`, `name`, `isOpen`, `promisedMinutes`), `CategoryTree` / `CategoryNode` (`name`, `slug`, `imageUrl`, `children`, `parentId`), `StoreProductList` (`items`, `page`, `pageSize`, `total`), `StoreProduct` (`name`, `slug`, `unitLabel`, `priceCents`, `mrpCents`, `imageUrl`, `inStock`, `quantity` capped at 10, `categoryId`, `brand`, `description`), `Address` (`label`, `pincode`). No rider route is needed. Gaps, none blocking (the screens leave the element out):

1. Artboard 2 filter chips "In stock" and "Price: low to high": `GET /stores/{id}/products` has no `inStock` filter and no `sort` (it orders by name). Filtering or sorting the loaded pages on the phone would be wrong across pages. Request to core (optional): `inStock=true` and `sort=price` on that route.
2. Artboard 1 pincode line "Home · 560034, Bengaluru": no store or serviceability field carries a city or locality. The app shows "Delivering to 560034". Request to core (optional): a `city` (or `area`) on `Store`.
3. Artboard 3 image carousel: `StoreProduct` has one `imageUrl`. Not requested (one image is the catalog's model); dots left out.

## Files

All inside `apps/mobile/` plus this change, `docs/design/mobile-P4-L2.md`, the lane logs and the root `package-lock.json`:

- `package.json` (async storage, the rider URL in `e2e`), `jest.config.js`, `jest.setup.ts`
- `src/ui/{price,stepper,dialog,status-message,image-tile}.tsx` and tests; `src/ui/{error-banner,chip,skeleton,form-field,empty-state}.tsx` and their tests
- `src/address-sheet.tsx` (one prop: `tabular` on Pincode)
- `src/pincode.ts`, `src/pincode-sheet.tsx`, `src/serviceability.ts`, `src/serviceability-gate.tsx`, `src/cart.ts`, `src/catalog.ts`, `src/catalog-card.tsx`, `src/catalog-grid.tsx`, and their tests (`src/pincode*.test.ts(x)`, `src/serviceability*.test.tsx`, `src/cart.test.ts`, `src/catalog*.test.tsx`)
- `src/app/_layout.tsx` (mount `PincodeSheet`, `focusManager` and `AppState`), `src/app/(tabs)/index.tsx`, `src/app/(tabs)/categories.tsx`, `src/app/category/[slug].tsx`, `src/app/product/[slug].tsx`, `src/app/search.tsx`
- L1 tests that name the old heading: `src/shell.test.tsx`, `src/shell-tabs.test.tsx`, `src/account-home.test.tsx`, `src/account-sign-out.test.tsx`; `e2e/accounts.spec.ts` (one line); new `e2e/catalog.spec.ts`

## Scenario to test

| Scenario | Test file: test name | Task |
|---|---|---|
| Stepper counts within the maximum | `src/ui/stepper.test.tsx`: `stepper counts within the maximum` | 2 |
| Dialog named and closed by the platform; Footer keeps the order | `src/ui/dialog.test.tsx`: the scenario names | 3 |
| Pincode persisted; Pincode restored on load; Chosen pincode wins over a late read; Blocked storage tolerated | `src/pincode.test.ts`: the scenario names | 6 |
| Counts belong to one store | `src/cart.test.ts`: `counts belong to one store` | 7 |
| Not serviceable notice; Closed store notice; Store lookup fails; No pincode notice (notice half) | `src/serviceability-gate.test.tsx`: the scenario names | 8 |
| Card links and prices; Add shows the count; Out-of-stock card | `src/catalog-card.test.tsx`: the scenario names | 9 |
| Load more while pages remain; End of the list loads the next page | `src/catalog-grid.test.tsx`: the scenario names | 9 |
| First visit opens the pincode sheet | `src/pincode-first-visit.test.tsx`: `first visit opens the pincode sheet` | 11 |
| Only digits, six at most; Invalid pincode refused; Pincode saved from the sheet; Saved address fills the pincode; Same store or empty cart; Store change confirmed; Store change kept | `src/pincode-sheet.test.tsx`: the scenario names | 10 |
| Sign-in link when signed out | `src/pincode-sign-in.test.tsx`: `sign-in link when signed out` | 10 |
| Home in the tabs; Header shows the delivery promise; Header control opens the sheet; No pincode notice; Home lists categories and picks; Home sections fail apart | `src/catalog-home.test.tsx`: the scenario names | 11 |
| Tab switch; Account button opens the account; (unknown path) | `src/shell-tabs.test.tsx`, `src/account-home.test.tsx`, `src/shell.test.tsx`: updated to the new heading | 11 |
| Search field opens search | `src/catalog-home-search.test.tsx`: `search field opens search` | 11 |
| Categories tab lists parents | `src/catalog-categories-tab.test.tsx`: `categories tab lists parents` | 11 |
| Category tabs | `src/catalog-category-tabs.test.tsx`: `category tabs` | 12 |
| Unknown category | `src/catalog-category.test.tsx`: `unknown category` | 12 |
| Product with a discount; Plenty in stock; Out of stock product; Unknown product; More in the category | `src/catalog-product.test.tsx`: the scenario names | 13 |
| Count follows the product across screens | `src/catalog-product-count.test.tsx`: `count follows the product across screens` | 13 |
| Search submits | `src/catalog-search-submit.test.tsx`: `search submits` | 14 |
| No results suggests categories; Clear search | `src/catalog-search.test.tsx`: the scenario names | 14 |
| Register with a field error (heading line) | `e2e/accounts.spec.ts`: `register with a field error` | 15 |
| Pincode resolves against core; Notices against core; Home against core; Browse a category against core; Search and load more against core; Product pages against core; Store change against core | `e2e/catalog.spec.ts`: the scenario names | 15 |

Tasks 1, 4 and 5 test primitives and cleanups no scenario names directly; their tests are listed in tasks.md.

## Risks / Trade-offs

- [axe on the tab rail] `role="tab"` without `aria-controls` / a `tabpanel` is valid ARIA; if axe still objects on react-native-web markup, task 15 stops and reports (no rule switched off).
- [Modal over the tabs in Jest] RNTL hides elements behind an open `Modal` with `accessibilityViewIsModal`; tests that query Home with no pincode find the sheet, and tests that query the tabs set a pincode first (`setPincode` before render, serviceability faked).
- [Static export and dynamic routes] Decision 7: in-app navigation only in e2e (ceiling).
- [axe `region` on the tab bar] mobile-P4-L4a gives the tab bar a navigation landmark named "Main" in `src/app/(tabs)/_layout.tsx` and lands first; L2 merges main before task 11 and does not edit that file.
- [Hermes `Intl`] `formatInr` uses `Intl.NumberFormat('en-IN')`; Hermes on Expo 58 ships `Intl`, but the manager's device walk checks "₹1,234.50" for 123450 (L1 risk carried over). Ceiling: a hand-written grouping in `Price` if a device shows "₹1234.50".
- [Store change failure untested] The "Could not empty your cart." branch exists in `PincodeSheet` but the stub's clear never fails; L3 adds the test with `DELETE /me/cart` answered 500.
- [Touch areas] Stepper and ADD are 36 tall per the canvas; `hitSlop` brings them to 44. On the web export `hitSlop` is ignored; 36 is above axe's 24 px `target-size`.
- [Parallel lanes] L5a lands `package.json` (expo-splash-screen) and its lock before task 6; task 6's `npm install` runs on top of it after the manager's rebase. L4a imports the task 1 to 4 primitives only after they are on main or in its own rebase.
