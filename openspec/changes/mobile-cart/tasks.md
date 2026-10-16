Every task below is one worker lane. Common to all:

- LANE-ID `mobile-P4-L3-T<n>` (the task number), area `mobile`, worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L3`, branch `lane/mobile-P4-L3-cart`, OpenSpec change `openspec/changes/mobile-cart/` (spec `specs/mobile-app/spec.md`; decisions `design.md`; drawing and interfaces `docs/design/mobile-P4-L3.md`). Paths below are under `apps/mobile/` unless they start with `openspec/` or `docs/`.
- Workers start only after mobile-P4-L2 is merged and the manager has merged origin/main into this branch, and after task 0.
- Read first: the scenarios your task names, `design.md` Decisions, the sections of `docs/design/mobile-P4-L3.md` your task names, and the web code you port (`apps/web/src/guest-cart.ts`, `apps/web/src/cart.ts`, `apps/web/src/cart-drawer.tsx`; tests in `apps/web/src/*cart*.test.ts*` show the cases).
- Testing rules (L1 and L2 lessons): RNTL 14's `render`, `renderHook`, `fireEvent` and `renderRouter` are async and awaited; one navigating `renderRouter` test per file; a map-based `renderRouter` wraps the screen in `QueryClientProvider client={queryClient}`; every file that renders `src/app` mocks the fonts (`jest.mock('@expo-google-fonts/inter', …)` with `useFonts: () => [true, null]`, copy it from `src/shell.test.tsx`); find groups with `getByRole('group', { name })` or `getByLabelText`; never pass `level` to `getByRole` (check the element's `aria-level`); fake core only with `fakeCore` from `src/fake-core.ts` (never `jest.mock` an app module); async storage is the library's Jest mock from `jest.setup.ts`.
- Commits: `test: <scenario>` with the failing test first (run it, paste the failure into your log), then `feat: <what>` (or `fix:`) with the smallest code that passes, then any cleanup with the suite green. Commit by explicit path with `git -c user.name=kapildev333 -c user.email=47056817+kapildev333@users.noreply.github.com commit`, no trailers. Never push, pull, merge, amend, reset or rebase; never `git add -A` or `git add .` (parallel workers share the branch). Tick your boxes here in the `feat:` commit.
- Touch only your scope paths. A change needed elsewhere, a dependency, or a design choice not settled here: stop and report in `.claude/lanes/mobile-P4-L3-T<n>.md`. Never run `make db`, `make dev`, `make prod-local` or docker.
- Gates (every task; paste the last lines into your log):
  `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L3 && npm run build --workspace packages/ui && npm run lint --workspace apps/mobile && npm run typecheck --workspace apps/mobile && npm run test --workspace apps/mobile -- --run && npm run build --workspace apps/mobile && openspec validate mobile-cart --strict`
  If `node_modules` is absent: `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L3 && npm ci` first.

Parallel groups (one group's tasks touch disjoint files; a group starts when the one before has landed):
- **0** (team lead): 0.
- **A**: 1, 2.
- **B**: 3 (after 1).
- **C**, all at once after 3: 4, 5 (also after 2), 6, 7, 8.
- **D**: 9 (e2e; needs the manager's e2e slot), then 10 (team lead).

## 0. Reconcile with L2 on main (team lead)

- [x] 0.1 After the manager merges origin/main (L2 merged and archived): check that `src/cart.ts`, `src/pincode-sheet.tsx`, `src/catalog-card.tsx`, `src/app/product/[slug].tsx`, the four browsing screens, `src/app/_layout.tsx` and `jest.setup.ts` match what `docs/design/mobile-P4-L3.md` names; fix this change where they differ
- [x] 0.2 Add `## REMOVED Requirements` for "Mobile cart counts before the cart" (Reason: superseded by the cart requirements; Migration: none) to `specs/mobile-app/spec.md` (design.md Decision 11); `openspec validate --all --strict` green; commit

## 1. Guest cart (`src/cart-guest.ts`) — group A

Scope: `src/cart-guest.ts`, `src/cart-guest.test.ts`.
Scenarios: Guest line set and removed; Guest line clamped; Another store replaces the guest cart; Out of stock at another store keeps the guest cart; Guest totals follow the store's fees; Guest cart persisted and restored; Guest change wins over a late read; Guest cart with blocked storage.
Starts from: `src/cart-guest.test.ts` test `guest line set and removed` (red: module missing), then the other scenario names, plus `mergeBodies keeps guest order`, `itemCount and mrpTotalCents`. Port `apps/web/src/guest-cart.ts` per `docs/design/mobile-P4-L3.md` "Module interfaces" and design.md Decision 2. Storage scenarios load the module inside `jest.isolateModules` (as `src/pincode.test.ts` does); a late read is a mocked `getItem` returning a promise the test resolves; blocked storage is `jest.spyOn(AsyncStorage, 'getItem' | 'setItem' | 'removeItem').mockRejectedValue(...)`. Import nothing from `src/cart.ts`.

- [x] 1.1 `test:` the scenarios, red
- [x] 1.2 `feat:` `src/cart-guest.ts`; gates green
- [x] 1.3 Follow-up (manager decision on T1's question, design.md Decision 2): `test:` `clear before the read settles wins` in `src/cart-guest.test.ts` (stored cart holds P, read pending, `clearGuestCart()` on the empty in-memory cart, then resolve the read: the cart is empty and async storage has no `shopperstop:cart`), red; then `fix:` `clearGuestCart()` marks loaded, emits and removes the stored value even when the reducer returns the same empty cart; the no-op rule for `set` stays; gates green

## 2. Sheet footer (`src/ui/sheet.tsx`) — group A

Scope: `src/ui/sheet.tsx`, `src/ui/sheet.test.tsx`.
Scenario: none directly (design.md Decision 5; used by Mobile cart checkout and minimum order).
Starts from: `src/ui/sheet.test.tsx` new test `footer stays below the scroll` (render `<Sheet open title="My cart" footer={<Text>Proceed</Text>}>` with content: "Proceed" is shown, and it is not inside the `ScrollView`: walk `.parent` from the "Proceed" text and find no element whose type is `RCTScrollView`; the content text is inside it). Add `footer?: ReactNode` rendered after the `ScrollView`; nothing else changes; every existing sheet test stays green unchanged.

- [x] 2.1 `test:` red
- [ ] 2.2 `feat:` the prop; gates green

## 3. Cart hooks and writes (`src/cart.ts`) — group B, after 1

Scope: `src/cart.ts`, `src/cart.test.ts`, `src/cart-stepper.test.tsx`, `jest.setup.ts` (one line: `closeCartSheet()` in `afterEach`, next to `await clearCart()`), and the `setQuantity` signature callers only: `src/catalog-card.tsx` and `src/app/product/[slug].tsx` (pass `product` instead of `product.id`; nothing else in them, task 4 changes them next), `src/pincode-sheet.test.tsx` and `src/catalog-product-count.test.tsx` (pass a product object with `inStock: true` and `quantity` 5 instead of an id).
Scenarios: Card adds to the guest cart; Card shows the server cart; Card ignores a cart at another store; Guest taps each count; Quick taps each count; Failed write returns to the cart's count.
Starts from: `src/cart-stepper.test.tsx` test `card adds to the guest cart` (red: the stub never writes async storage), then the other five, each rendering `<ProductCard product={…} storeId={…} />` from `src/catalog-card.tsx` inside `QueryClientProvider` after `setPincode('560034')` and the serviceability fake ("Test fakes" in the design file); quick taps hold every `PUT` answer and release them in order, asserting 2, 3, 2 between presses and that the second `PUT` is sent only after the first answered. Replace `src/cart.test.ts` (L2's stub tests) with: `summary counts the guest cart` (`getCartSummary()` count, storeId, totalCents), `summary reads the cached server cart`, `clear empties the guest cart`, `clear sends DELETE while signed in` (cache becomes the empty cart), `clear returns core's error`, `loadCartSummary fetches the server cart` (and resolves `undefined` when `GET /me/cart` fails), `store name from core` (`useStoreName` gives the name and `queryClient.getQueryData(['store', id])` holds the whole `Store`), `queued runs work in order` (two `queued` calls, the first held: the second starts only after the first settles, also when the first rejects), `sheet open state`. `storeOptions` and `queued` are exported for mobile-P4-L4b (checkout).
Build: `src/cart.ts` per `docs/design/mobile-P4-L3.md` "Module interfaces" and "The port", design.md Decisions 1 and 3, without `mergeGuestCart` (task 6). `useLineWrite` lands here too (task 4 uses it).

- [x] 3.1 `test:` the scenarios and unit tests, red
- [x] 3.2 `feat:` `src/cart.ts`, the signature callers, the `jest.setup.ts` line; every L2 test green; gates green
- [x] 3.3 `test:` `src/catalog-card.test.tsx`: QueryClientProvider around each render and the store resolved in the add test (scope extended by the manager; no assertion changes)

## 4. Write failure under the control — group C, after 3

Scope: `src/cart-alert.tsx`, `src/cart-write-failure.test.tsx`, `src/catalog-card.tsx`, `src/app/product/[slug].tsx` (the hook and one alert line each, per the design file "Write failure alert").
Scenarios: Failed write tells the customer; Core's refusal is shown; Next tap clears the failure; Overtaken change shows no failure.
Starts from: `src/cart-write-failure.test.tsx` test `failed write tells the customer` (red: no alert). Card scenarios render `ProductCard` as task 3 does with `setToken('t-1')` and `GET /me/cart` holding 1 of the product; "Core's refusal is shown" renders the product screen with `renderRouter({ 'product/[slug]': ProductScreen }, { initialUrl: '/product/amul-taaza' })` (wrapper as in `src/catalog-product-count.test.tsx`, not navigating) and `PUT /me/cart/items` answering `apiError(400, 'validation', 'product not available')`; "Overtaken" holds both writes and lets both fail, then counts `getAllByRole('alert')` (1).

- [x] 4.1 `test:` the four scenarios, red
- [x] 4.2 `feat:` `CartWriteAlert` and the two integrations; gates green

## 5. Cart sheet (`src/cart-sheet.tsx`) — group C, after 2 and 3

Scope: `src/cart-sheet.tsx`, `src/cart-sheet.test.tsx`, `src/cart-sheet-proceed.test.tsx`, `src/cart-sheet-proceed-signed-in.test.tsx`, `src/app/_layout.tsx` (mount `<CartSheet />` after `<PincodeSheet />`; one line and the import).
Scenarios: Sheet lines and bill; Free delivery; Out-of-stock line; Below the minimum order; Empty cart; Loading and failed cart; Answer wins over what was sent; Line clamped away; Replaced notice names the old store (sheet half); Replace opens the sheet once; Replaced notice without the old store; Proceed signed out; Proceed signed in.
Starts from: `src/cart-sheet.test.tsx` test `sheet lines and bill` (red: module missing). Non-navigating tests render `<CartSheet />` in `QueryClientProvider` after `openCartSheet()` (signed in with a fake `GET /me/cart` is the simplest way to set any cart, including `replaced` answers via `queryClient.setQueryData(cartKey('t-1'), …)`); "Replace opens the sheet once" starts closed and sets the cached answer three times inside awaited `act`; add one more test `failed write in the sheet` (a line's "Add one" with core unreachable shows "Could not reach ShopperStop. Try again." under it). Navigating, one per file: `proceed signed out` and `proceed signed in` with `renderRouter({ _layout: Layout, index: Stub, 'sign-in': Stub, checkout: Stub }, { initialUrl: '/' })` where `Layout` renders `QueryClientProvider` › `<Stack />` and `<CartSheet />`; assert `toHavePathname('/sign-in')` with `toHaveSearchParams({ returnTo: '/checkout' })`, or `toHavePathname('/checkout')`, and that the sheet closed (`useCartSheetOpen` false: no "My cart" heading). If the `Link` does not navigate in Jest, apply L2 task 10's ordered fallback (wait for the stub's text before opening the sheet), else stop and report.
Drawing: design file "4 · Cart sheet" and "14 · Cart empty". Colour rule from L2's axe run: `inkMuted` text only on `surface` (it fails 4.5:1 on `canvas`); the sheet panel is `surface`, so keep every muted text inside it, never on a `canvas` block.

- [x] 5.1 `test:` the scenarios, red
- [x] 5.2 `feat:` `CartSheet` and the mount; gates green

## 6. Merge at sign-in and the server store change — group C, after 3

Scope: `src/cart.ts` (add `mergeGuestCart` only), `src/auth.ts` (one `await mergeGuestCart()` in `openSession` after `startSession`, and the import), `src/cart-merge.test.ts`, `src/cart-store-change.test.tsx`.
Scenarios: Merge bodies in guest order; Guest cart discarded after merge; Merge dropped when the session changed; Server cart emptied on a store change; Emptying the server cart fails.
Starts from: `src/cart-merge.test.ts` test `merge bodies in guest order` (red: sign-in sends no `PUT`): guest lines set with `setQuantity` while signed out, then `await signIn({ email, password })` from `src/auth.ts` with fake `POST /auth/sign-in` (a `CustomerSession`), `PUT /me/cart/items` (recording bodies), `GET /me/cart`; the recorded bodies in order, and `getCartSummary()` from core's last answer. "Merge dropped": `setToken('t-1')`, hold a `PUT` from a `setQuantity`, call `mergeGuestCart()`, `setToken('t-2')`, release; no merge `PUT` and the guest cart unchanged (put guest lines in through `dispatchGuest` while signed out first). `src/cart-store-change.test.tsx`: render `PincodeSheet` (as `src/pincode-sheet.test.tsx` does) signed in with a cached cart line at Koramangala, `560038` faked to Indiranagar; "Switch store" sends `DELETE /me/cart` (204) and stores the pincode; with `DELETE` throwing, the alert "Could not empty your cart." and the pincode unchanged. These two need no product change if L2's dialog behaves as designed; if one fails for a reason outside `src/cart.ts`, stop and report.

- [x] 6.1 `test:` the five scenarios, red (the store-change pair may already pass once task 3 is in: then commit them as `test:` with a note in the log, no `feat:` needed for them)
- [x] 6.2 `feat:` `mergeGuestCart` and the `auth.ts` line; gates green

## 7. Cart bar (`src/cart-bar.tsx`) — group C, after 3

Scope: `src/cart-bar.tsx`, `src/cart-bar.test.tsx`, `src/cart-bar-screens.test.tsx`, and one mount line plus import in each of `src/app/(tabs)/index.tsx`, `src/app/(tabs)/categories.tsx`, `src/app/category/[slug].tsx`, `src/app/search.tsx` (design file "Cart bar").
Scenarios: Bar follows the cart; Replaced notice names the old store (bar half); Bar on the browsing screens.
Starts from: `src/cart-bar.test.tsx` test `bar follows the cart` (red: module missing): render `<CartBar />` in `QueryClientProvider` with an empty guest cart (no "View cart" button), then set a guest line of 2 × 2700 at Koramangala (fee 2500): "2 items" and "₹79" and a button whose name starts "View cart"; pressing it makes `useCartSheetOpen()` true (read it through a small `renderHook`, or render `<CartSheet />` if task 5 has landed and look for the "My cart" heading; say which in the log). `bar shows the replaced notice`. `src/cart-bar-screens.test.tsx` test `bar on the browsing screens`: with a guest line, render each of the Categories tab, `/category/dairy-bread-eggs`, `/search?q=milk` and `/product/amul-taaza` through map-based `renderRouter` (none navigates; fakes for the reads each needs, copy them from L2's tests) and assert the "View cart" button on the first three and not on the product screen.

- [x] 7.1 `test:` the scenarios, red
- [x] 7.2 `feat:` `CartBar` and the four mounts; gates green

## 8. A store change needs an answer (`src/pincode-sheet.tsx`) — group C, after 3

Scope: `src/pincode-sheet.tsx` (`PincodeForm.next()` and the alert only), `src/cart-pincode-check.test.tsx`.
Scenarios: Failed lookup keeps the cart's pincode; Unread server cart is fetched before comparing; Failed lookup with an empty cart.
Starts from: `src/cart-pincode-check.test.tsx` test `failed lookup keeps the cart's pincode` (red: L2 stores the pincode). Render `PincodeSheet` as `src/pincode-sheet.test.tsx` does after `openPincodeSheet()`; a guest line at Koramangala with `560034` stored; `GET /serviceability` for `560038` throwing. Build per design.md Decision 9 and the design file "Pincode sheet: a store change needs an answer". Keep L2's two guards as they are: the `open` ref (after the awaits, `if (!open.current) return`: a dismissed sheet saves nothing and shows no alert) and the `pending` check on `onSubmitEditing`. Every test in `src/pincode-sheet.test.tsx` stays green unchanged (task 3 only changes its `setQuantity` arguments).

- [x] 8.1 `test:` the three scenarios, red
- [x] 8.2 `feat:` the rule; gates green

## 9. e2e (`e2e/cart.spec.ts`) — group D, after 1 to 8

Scope: `e2e/cart.spec.ts` (new); fixes inside the scopes of tasks 1 to 8 only, each a `fix:` naming the scenario.
Scenarios: Guest cart against core; Quick taps against core; Merge at sign-in against core; Clamp against core; Server store change against core; Replaced notice against core.
Starts from: `e2e/cart.spec.ts` with the six scenario names, committed red before any fix. Helpers: copy `freshShopper`, `signedIn` (it presets `shopperstop:pincode` 560034 in `localStorage` so the first-visit sheet does not open), `staffHeaders`, `expectNoViolations` and the Koramangala id from `e2e/orders.spec.ts`, and `sheet` / `savePincode` from `e2e/catalog.spec.ts`; stock reads and writes, held-back answers (`page.route` on `**/me/cart/items` delaying the first `PUT`) and the restore-in-`finally` pattern from `apps/web/e2e/cart.spec.ts` ("server cart clamps above stock", "quick taps against core"). Pick products with a stock of at least 3 from `GET /stores/<id>/products?pageSize=100` (demo stock is low). Choose the pincode through the sheet in a fresh context; wait for `getByRole('dialog', { name: 'Where should we deliver?' })`, `{ name: 'My cart' }` and `{ name: /^Switch to the/ }` before axe or a press. Reach product screens only in-app (search, then the result). The guest storage key is `localStorage` `shopperstop:cart`. Ask the manager for the e2e slot before running.

- [x] 9.1 `test:` the spec, red; `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L3 && make e2e` output in the log
- [x] 9.2 `fix:` commits until green; an axe failure on markup the app does not control stops the worker (no rule switched off)
- [x] 9.3 `make e2e` exits 0 (same command, with the slot); mobile suite all green

## 10. Acceptance (team lead)

- [ ] 10.1 `/opsx:verify mobile-cart`: every scenario mapped to a passing test (design.md "Scenario to test"), every task ticked, nothing outside the scopes; gates re-run
