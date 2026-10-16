Every task runs in `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L2` on branch `lane/mobile-P4-L2-serviceability-catalog` (LANE-ID mobile-P4-L2, area mobile, OpenSpec change `mobile-serviceability-catalog`). Read first: this change's `specs/mobile-app/spec.md` (the scenarios named), `design.md` (Decisions binding), `docs/design/mobile-P4-L2.md` (layout, copy, token names, interfaces), and L1's binding decisions in `openspec/changes/archive/2026-10-16-mobile-foundation-accounts/design.md` (or `openspec/changes/mobile-foundation-accounts/design.md` before the rebase): tokens only from `src/ui/tokens.ts`, never a colour value, never the root `@shopperstop/ui`; RNTL 14's `render`, `fireEvent` and `renderRouter` are async and awaited; one navigating `renderRouter` test per file; `jest.mock('@expo-google-fonts/inter', ...)` with `useFonts: () => [true, null]` in every file that renders `src/app` (copy it from `src/shell.test.tsx`).

The worker logs in `.claude/lanes/mobile-P4-L2-T<n>.md`, never runs `make db`, `make dev`, `make prod-local` or docker, never pushes, pulls or merges, and stops and reports on any design choice this change does not settle, on any dependency other than `@react-native-async-storage/async-storage` 2.2.0 (task 6), and on any file outside its scope.

Commits per task, by explicit path, as `git -c user.name=kapildev333 -c user.email=47056817+kapildev333@users.noreply.github.com commit`, no trailers: `test: <scenario or behaviour>` with the failing test (its failure pasted into the log), then `feat: <what>` (or `refactor:` for task 5's moves with the suite green). Tick this file's boxes in the `feat:` commit.

Gates for every task (paste the last lines into the log):

```
export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"
npm run build --workspace packages/ui
npm run lint --workspace apps/mobile
npm run typecheck --workspace apps/mobile
npm run test --workspace apps/mobile -- --run
npm run build --workspace apps/mobile
openspec validate mobile-serviceability-catalog --strict
```

If `node_modules` is absent in the worktree, run `npm ci` from the worktree root first (same PATH line).

Order and parallel groups (parallel tasks touch disjoint files):
- Group A, all at once: 1, 2, 3, 4, 5, 6, 7. Tasks 1 to 4 are the primitives mobile-P4-L4a waits for; land them first.
- Group B, after A: 8 (needs 5, 6) and 9 (needs 1, 2, 4, 5, 7).
- Group C: 10 after 3, 6, 7, 8.
- Group D, in parallel: 11 after 9 and 10; 12, 13 and 14 after 8 and 9.
- Then 15 (e2e, needs the manager's e2e slot), then 16 (team lead).

## 1. Price

Scope: `apps/mobile/src/ui/{price.tsx,price.test.tsx}`.
Behaviour: `docs/design/mobile-P4-L2.md` "Price"; used by the product card and screen (Mobile product card, Mobile product screen) and by L4a.
Starts from: `src/ui/price.test.tsx`: `price in rupees`, `mrp struck through when higher`, `no mrp when equal`, `paise shown`, `large size`.

- [x] 1.1 Red: the test file fails (module absent)
- [x] 1.2 `Price` per the design file, `formatInr` from `@shopperstop/ui/format`
- [x] 1.3 Gates green

## 2. Stepper

Scope: `apps/mobile/src/ui/{stepper.tsx,stepper.test.tsx}`.
Scenario: Stepper counts within the maximum.
Starts from: `src/ui/stepper.test.tsx`: `stepper counts within the maximum` (a test harness holding `value` in `useState`), `out of stock is disabled`, `large add reads Add to cart`.

- [ ] 2.1 Red
- [ ] 2.2 `Stepper` per the design file (`md` and `lg`, `hitSlop` to 44 in `md`)
- [ ] 2.3 Gates green

## 3. Dialog

Scope: `apps/mobile/src/ui/{dialog.tsx,dialog.test.tsx}`.
Scenarios: Dialog named and closed by the platform, Footer keeps the order.
Starts from: `src/ui/dialog.test.tsx`: `dialog named and closed by the platform`, `footer keeps the order`, `closed dialog shows nothing`. API is mobile-P4-L4a's request (design.md Decision 1, Decision 13).

- [x] 3.1 Red
- [x] 3.2 `Dialog` and `DialogFooter` per the design file (`Modal` fade, named by the title, backdrop does not close, `onRequestClose={onClose}`)
- [x] 3.3 Gates green

## 4. StatusMessage and ImageTile

Scope: `apps/mobile/src/ui/{status-message.tsx,status-message.test.tsx,image-tile.tsx,image-tile.test.tsx}`.
Behaviour: design file "StatusMessage" and "ImageTile" (L4a uses both; L2's cards use `ImageTile`).
Starts from: `src/ui/status-message.test.tsx`: `status message is a polite status`, `tones use tokens`; `src/ui/image-tile.test.tsx`: `image from uri`, `placeholder without uri`.

- [ ] 4.1 Red
- [ ] 4.2 Both components
- [ ] 4.3 Gates green

## 5. L1 primitive leftovers

Scope: `apps/mobile/src/ui/{error-banner.tsx,chip.tsx,skeleton.tsx,form-field.tsx,empty-state.tsx,states.test.tsx,form-field.test.tsx}`, `apps/mobile/src/address-sheet.tsx` (pass `tabular` on Pincode only), `apps/mobile/jest.config.js` (lucide mapping only).
Behaviour: design.md Decision 11; design file "Changes to L1 primitives".
Starts from: `src/ui/states.test.tsx`: `skeleton tiles` (`variant="tiles" columns={4} count={8}` renders 8 blocks, labelled "Loading"), `try again is a button` (the retry is L1's `Button`: its style has `minHeight` 44 and `colors.accent` background, and pressing it calls `onRetry`), `empty state level` (`level={1}` gives a level-1 heading); `src/ui/form-field.test.tsx`: `tabular input` (`tabular` puts `fontVariant: ['tabular-nums']` on the input).

- [ ] 5.1 Red: the four new tests
- [ ] 5.2 `feat:` the props and `Button` reuse; `refactor:` `StyleSheet.create` in `error-banner.tsx`, `chip.tsx`, `skeleton.tsx`; `jest.config.js` maps `^lucide-react-native$` to `require.resolve('lucide-react-native/dist/cjs/lucide-react-native.js')`
- [ ] 5.3 Gates green (every L1 test still passes)

## 6. Pincode store

Scope: `apps/mobile/{package.json,jest.setup.ts}`, `apps/mobile/src/{pincode.ts,pincode.test.ts}`, root `package-lock.json` (mechanical, from `npm install`).
Scenarios: Pincode persisted, Pincode restored on load, Chosen pincode wins over a late read, Blocked storage tolerated.
Starts from: `src/pincode.test.ts`: the four scenario names, plus `sheet open state` (`openPincodeSheet`/`closePincodeSheet` flip `usePincodeSheetOpen`). Load the module in `jest.isolateModules` for the read scenarios; make the read late by giving the mocked `getItem` a promise the test resolves; make storage reject with `jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(...)` (and `getItem`).

- [ ] 6.1 `package.json`: add `"@react-native-async-storage/async-storage": "2.2.0"` (Expo 58's pin) to `dependencies`; in the `e2e` script put `EXPO_PUBLIC_RIDER_URL=http://localhost:18081` next to `EXPO_PUBLIC_CORE_URL=http://localhost:18080` (mobile-P4-L4a's request; skip if it is already there); nothing else: the `test` script and `expo-splash-screen` are L5a's (design.md Decision 12), keep them as they are on the branch; `npm install` from the worktree root
- [ ] 6.2 `jest.setup.ts`: `jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))`; after each test `setPincode(undefined)`, `closePincodeSheet()`, `AsyncStorage.clear()`
- [ ] 6.3 Red: `src/pincode.test.ts`
- [ ] 6.4 `src/pincode.ts` per the interfaces in the design file and design.md Decision 2
- [ ] 6.5 Gates green

## 7. Cart counts stub

Scope: `apps/mobile/src/{cart.ts,cart.test.ts}`, `apps/mobile/jest.setup.ts` (one line: `await clearCart()` after each test; run after task 6 lands or rebase onto it, the two touch the same file).
Scenario: Counts belong to one store.
Starts from: `src/cart.test.ts`: `counts belong to one store`, `clear empties the counts` (resolves `undefined`, count 0, no store).

- [ ] 7.1 Red
- [ ] 7.2 `src/cart.ts` per design.md Decision 5 and the interfaces
- [ ] 7.3 Gates green

## 8. Store resolution and notices

Scope: `apps/mobile/src/{serviceability.ts,serviceability-gate.tsx,serviceability-gate.test.tsx,serviceability.test.ts}`.
Scenarios: Not serviceable notice, Closed store notice, Store lookup fails, No pincode notice (the notice half: "Set your pincode" and "Choose pincode" opens the sheet state).
Starts from: `src/serviceability-gate.test.tsx`: render `<StoreGate>{(store) => <Text>open {store.name}</Text>}</StoreGate>` inside `QueryClientProvider`: `not serviceable notice` (`setPincode('110001')`, fake 404 `not_serviceable`: level-2 heading "We don't deliver here yet"; pressing "Change pincode" makes `usePincodeSheetOpen()` true), `closed store notice` (heading "Koramangala store is closed", "Change pincode", link "See your orders"), `store lookup fails` (fetch refused: "You're offline"; fake core then "Try again" shows "open Koramangala"), `no pincode notice` ("Set your pincode", "Choose pincode" opens the sheet), `loading while the pincode is unknown` (label "Loading"); `src/serviceability.test.ts`: `resolvePincode caches the answer` (a following `useStore` makes no second request).

- [ ] 8.1 Red
- [ ] 8.2 `serviceability.ts` and `StoreGate` per design.md Decision 3 and the design file "8 · Not serviceable / closed"
- [ ] 8.3 Gates green

## 9. Catalog queries, product card, paged grid

Scope: `apps/mobile/src/{catalog.ts,catalog-card.tsx,catalog-grid.tsx,catalog.test.ts,catalog-card.test.tsx,catalog-grid.test.tsx}`.
Scenarios: Card links and prices, Add shows the count, Out-of-stock card, Load more while pages remain, End of the list loads the next page.
Starts from: `src/catalog-card.test.tsx`: the three card scenario names (render inside `QueryClientProvider`; the link's `accessibilityLabel` and `href`); `src/catalog-grid.test.tsx`: `load more while pages remain` (fake `GET /stores/s-1/products` answering by `page`), `end of the list loads the next page` (`fireEvent(list, 'endReached')` twice: one `page=2` request), `no load more at the last page`; `src/catalog.test.ts`: `stockLabel`, `findCategory finds a child under its parent`, `imageUri prefixes the core origin`, `picks are the first 12 in stock`.

- [ ] 9.1 Red
- [ ] 9.2 `catalog.ts`, `ProductCard`, `CategoryGrid`, `ProductGrid` per design.md Decisions 8 and 9 and the design file
- [ ] 9.3 Gates green

## 10. Pincode sheet and store change

Scope: `apps/mobile/src/{pincode-sheet.tsx,pincode-sheet.test.tsx,pincode-first-visit.test.tsx,pincode-sign-in.test.tsx,app-focus.ts,app-focus.test.ts}`, `apps/mobile/src/app/_layout.tsx` (mount `<PincodeSheet />` inside the providers, beside the `Stack`; call the focus wiring once).
Scenarios: First visit opens the pincode sheet, Only digits six at most, Invalid pincode refused, Pincode saved from the sheet, Saved address fills the pincode, Sign-in link when signed out, Same store or empty cart, Store change confirmed, Store change kept.
Starts from: `src/pincode-sheet.test.tsx` (render `PincodeSheet` in `QueryClientProvider` after `openPincodeSheet()`): `only digits, six at most`, `invalid pincode refused`, `pincode saved from the sheet`, `saved address fills the pincode` (`setToken`, fake `GET /me/addresses`), `same store or empty cart`, `store change confirmed`, `store change kept` (counts via `setQuantity`, both pincodes faked); `src/pincode-first-visit.test.tsx`: `first visit opens the pincode sheet` (`renderRouter(appDir, { initialUrl: '/' })` with no pincode; wait for the dialog title; the Home placeholder is fine until task 11, which then must keep this test green); `src/pincode-sign-in.test.tsx`: `sign-in link when signed out` (`renderRouter` with `index`, `sign-in` screens and the sheet in the layout; location `/sign-in`, `returnTo` `/`).

- [ ] 10.1 Red
- [ ] 10.2 `PincodeSheet` per design.md Decision 6 and the design file sections 7 and 17; mount in `_layout.tsx`
- [ ] 10.3 `src/app-focus.ts` (mobile-P4-L4a's request, design.md Decision 13): `wireAppFocus()` subscribes `AppState` `change` to `focusManager.setFocused(state === 'active')` unless `Platform.OS === 'web'`, returns the unsubscribe; called from an effect in `_layout.tsx`. Red first: `src/app-focus.test.ts`: `background pauses focus` (emit `background` through `jest.spyOn(AppState, 'addEventListener')`'s captured listener: `focusManager.isFocused()` is false; `active`: true)
- [ ] 10.4 Gates green

## 11. Home and Categories tab

Scope: `apps/mobile/src/app/(tabs)/{index.tsx,categories.tsx}`, `apps/mobile/src/{catalog-home.test.tsx,catalog-home-search.test.tsx,catalog-categories-tab.test.tsx}`, and the L1 tests naming the old heading: `apps/mobile/src/{shell.test.tsx,shell-tabs.test.tsx,account-home.test.tsx,account-sign-out.test.tsx}` (heading and pincode setup only).
Scenarios: Home in the tabs, Header shows the delivery promise, Header control opens the sheet, No pincode notice, Home lists categories and picks, Home sections fail apart, Search field opens search, Categories tab lists parents; keeps Tab switch, Account button opens the account and Unknown path green.
Starts from: `src/catalog-home.test.tsx` (`renderRouter(appDir, { initialUrl: '/' })` after `setPincode('560034')` and fake serviceability, categories, products): `home in the tabs`, `header shows the delivery promise`, `header control opens the sheet`, `no pincode notice`, `home lists categories and picks`, `home sections fail apart` (none of these navigates, so they share the file); navigating tests each in their own file: `src/catalog-home-search.test.tsx`: `search field opens search`; `src/catalog-categories-tab.test.tsx`: `categories tab lists parents`. L1 tests: set a pincode and fake an open store before rendering `/`, and look for the level-1 heading `/^ShopperStop/` instead of "Groceries in minutes" (`account-home.test.tsx` only needs the pincode setup so the sheet does not cover "Account"). Until task 14 lands, `catalog-home-search.test.tsx` passes a stub `search` screen to `renderRouter`'s route map.

- [ ] 11.1 Red
- [ ] 11.2 Home and Categories per design.md Decision 4 and the design file "1 · Home", "Categories tab"; Home opens the sheet once when `loaded && !pincode`
- [ ] 11.3 Gates green (all L1 tests too)

## 12. Category screen

Scope: `apps/mobile/src/app/category/[slug].tsx`, `apps/mobile/src/{catalog-category.test.tsx,catalog-category-tabs.test.tsx}`.
Scenarios: Category tabs, Unknown category.
Starts from: `src/catalog-category-tabs.test.tsx`: `category tabs` (`renderRouter({ 'category/[slug]': Category }, { initialUrl: '/category/dairy-bread-eggs' })`; tabs by `getByRole('tab', { name, selected })`; after pressing "Milk", `toHavePathname('/category/milk')` and a products request with Milk's `categoryId`); `src/catalog-category.test.tsx`: `unknown category`.

- [ ] 12.1 Red
- [ ] 12.2 The screen per design.md Decision 7 and the design file "2 · Category"
- [ ] 12.3 Gates green

## 13. Product screen

Scope: `apps/mobile/src/app/product/[slug].tsx`, `apps/mobile/src/{catalog-product.test.tsx,catalog-product-count.test.tsx}`.
Scenarios: Product with a discount, Plenty in stock, Out of stock product, Unknown product, More in the category, Count follows the product across screens.
Starts from: `src/catalog-product.test.tsx`: the five scenario names (`renderRouter({ 'product/[slug]': Product }, { initialUrl: '/product/amul-curd' })`, each test its own render; none navigates); `src/catalog-product-count.test.tsx`: `count follows the product across screens` (`setQuantity('s-1', <banana id>, 1)` stands for the Home press, then the product screen shows the group "Quantity of Banana Robusta" with 1).

- [ ] 13.1 Red
- [ ] 13.2 The screen per the design file "3 · Product"
- [ ] 13.3 Gates green

## 14. Search screen

Scope: `apps/mobile/src/app/search.tsx`, `apps/mobile/src/{catalog-search.test.tsx,catalog-search-submit.test.tsx}`.
Scenarios: Search submits, No results suggests categories, Clear search.
Starts from: `src/catalog-search-submit.test.tsx`: `search submits` (type " milk ", `fireEvent(box, 'submitEditing')`, `toHaveSearchParams({ q: 'milk' })`, heading "2 products for “milk”"); `src/catalog-search.test.tsx`: `no results suggests categories` (`initialUrl: '/search?q=zzz'`), `clear search`, `no query shows search for products`.

- [ ] 14.1 Red
- [ ] 14.2 The screen per design.md Decision 10 and the design file "13 · Search"
- [ ] 14.3 Gates green

## 15. e2e

Scope: `apps/mobile/e2e/catalog.spec.ts` (new), `apps/mobile/e2e/accounts.spec.ts` (the one "Groceries in minutes" line becomes `getByRole('heading', { level: 1, name: /shopperstop/i })`), `apps/mobile/playwright.config.ts` only if a timeout must change (say why).
Scenarios: Register with a field error (heading line), Pincode resolves against core, Notices against core, Home against core, Browse a category against core, Search and load more against core, Product pages against core, Store change against core.
Starts from: `e2e/catalog.spec.ts` with the seven scenario names, committed red before any fix. Helpers as `apps/web/e2e/browse.spec.ts`: `ensureClosedStore` (admin sign-in, `POST /admin/stores` "E2E Closed" at `560076`, `PUT .../service-areas`; core's URL is `http://localhost:18080`), `expectNoViolations` (AxeBuilder, every rule). Wait for `getByRole('dialog', { name: 'Where should we deliver?' })` before axe or Escape (L1 Decision 8). Each test sets its pincode through the sheet in a fresh context. The out-of-stock product: `GET /api/core/v1/stores/<Koramangala id>/products?pageSize=100` and take the first `inStock: false`. Product scenario: reach Banana Robusta from a search, then `page.goto('/product/<out-of-stock slug>')`; if a direct load of a dynamic route does not hydrate, stop and report (design.md Decision 7).

- [ ] 15.1 Red: the spec committed; `npm run e2e --workspace apps/mobile` output in the log (core env from the Makefile's e2e target; ask the manager for the e2e slot first)
- [ ] 15.2 Fixes inside the scopes of tasks 1 to 14 only, each `fix:` naming the scenario; an axe failure on markup the app does not control stops the worker (no rule switched off)
- [ ] 15.3 `make e2e` exits 0 (with the slot); mobile suite all green

## 16. Acceptance (team lead)

- [ ] 16.1 `/opsx:verify mobile-serviceability-catalog`: every scenario mapped to a passing test (design.md "Scenario to test"), every task ticked, nothing outside the scopes; gates re-run
