Every task below is one worker lane. Common to all:

- LANE-ID `mobile-P4-L4b-T<n>` (the task number), area `mobile`, worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L4b`, branch `lane/mobile-P4-L4b-checkout`, OpenSpec change `openspec/changes/mobile-checkout/` (spec `specs/mobile-app/spec.md`; decisions `design.md`; drawing, copy and interfaces `docs/design/mobile-P4-L4b.md`). Paths below are under `apps/mobile/` unless they start with `openspec/` or `docs/`.
- Workers start only after mobile-P4-L3 (`mobile-cart`) is merged, the manager has merged origin/main into this branch, and task 0 is ticked.
- Read first: the scenarios your task names, `design.md` Decisions, the sections of `docs/design/mobile-P4-L4b.md` your task names, and the web code you port (`apps/web/src/checkout.tsx`; `postOrder`, `cartEmptied`, `placeOrder` in `apps/web/src/orders.ts`; cases in `apps/web/src/checkout*.test.tsx`).
- Testing rules (L1 to L4a lessons): RNTL 14's `render`, `renderHook`, `fireEvent` and `renderRouter` are async and awaited; one navigating `renderRouter` test per file; a map-based `renderRouter` wraps its `Stack` in `QueryClientProvider client={queryClient}` in the `_layout` entry; every file that renders `src/app` mocks the fonts (copy the `jest.mock('@expo-google-fonts/inter', …)` block from `src/orders-tracking-redirect.test.tsx`); assert paths with `router.getPathname()` and `router.getSearchParams()` inside `waitFor`; find groups with `getByRole('radiogroup' | 'group', { name })` or `getByLabelText`; never pass `level` to `getByRole` (check the element's `aria-level`); fake core only with `fakeCore` from `src/fake-core.ts` (never `jest.mock` an app module); non-navigating screen tests render the component inside `QueryClientProvider client={queryClient}` with no router, as `src/orders-tracking.test.tsx` does (every render needs it). Held server writes (L3 T3 and T4): an awaited `fireEvent.press` hangs while its write's answer is held or the network fails, so fire such a press unawaited and assert with `waitFor`; release every held answer before the test ends, or the open `act()` breaks the next test; a press whose handler answers at once is awaited as usual.
- Commits: `test: <scenario>` with the failing test first (run it, paste the failure into your log), then `feat: <what>` (or `fix:`) with the smallest code that passes, then any cleanup with the suite green. Commit by explicit path with `git -c user.name=kapildev333 -c user.email=47056817+kapildev333@users.noreply.github.com commit`, no trailers. Never push, pull, merge, amend, reset or rebase; never `git add -A` or `git add .` (parallel workers share the branch). Tick your boxes here in the `feat:` commit.
- Touch only your scope paths. A change needed elsewhere, a dependency, or a design choice not settled here: stop and report in `.claude/lanes/mobile-P4-L4b-T<n>.md`. Never run `make db`, `make dev`, `make prod-local` or docker. If you start a server, stop it by its own PID or port (`lsof -ti tcp:<port>`), never `pkill` by name (other sessions run core too).
- Gates (every task; paste the last lines into your log):
  `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L4b && npm run build --workspace packages/ui && npm run lint --workspace apps/mobile && npm run typecheck --workspace apps/mobile && npm run test --workspace apps/mobile -- --run && npm run build --workspace apps/mobile && openspec validate mobile-checkout --strict`
  If `node_modules` is absent: `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L4b && npm ci` first.
  One test file while working: `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L4b/apps/mobile && npx jest --ci src/<file>`

Parallel groups (one group's tasks touch disjoint files; a group starts when the one before has landed):
- **0** (team lead): 0.
- **A**: 1, 2.
- **B**: 3.
- **C**: 4.
- **D**: 5.
- **E**: 6 (e2e; needs the manager's e2e slot), then 7 (team lead).

## 0. Reconcile with L3 on main (team lead)

- [x] 0.1 After the manager merges origin/main (L3 merged): check that `src/cart.ts` exports `useCart` (`view`, `isError`, `error`, `refetch`), `cartKey`, `queued`, `useLineWrite`, `openCartSheet` and the store query (`storeOptions` or `useStoreName` caching the whole `Store` under `['store', id]`), that `src/cart-guest.ts` exports `cartView`, `emptyCart`, `CartProduct`, `CartView`, that `src/cart-alert.tsx` exports `CartWriteAlert`, and that the cart sheet's "Proceed to checkout" opens `/checkout`; that L3 exports `queued<T>(work)` and `storeOptions(storeId)` as the manager relayed (then drop the fallbacks in Decisions 4 and 6 and in tasks 1 and 3); that checkout's fees and minimum come only from the server cart (Decision 6, L3 review R1 finding 2); fix this change, `docs/design/mobile-P4-L4b.md` and the briefs where they differ (design.md Decisions 4 and 6 name the fallbacks)
- [x] 0.2 `openspec validate --all --strict` green; commit

## 1. Placing and its outcomes (`src/checkout.ts`) — group A

Scope: `src/checkout.ts`, `src/checkout.test.ts`. `queued` is imported from `src/cart.ts` (L3 exports it); do not edit `src/cart.ts`.
Scenarios: Order placed after a pending cart change; Order number collision retried once.
Starts from: `src/checkout.test.ts` test `Order placed after a pending cart change` (red: module missing): `setToken('t-1')`, `fakeCore` with `PUT /me/cart/items` held (a promise the test resolves; answer a `CartUpdate`), `POST /orders` answering 201 with an order, `GET /me/cart`; call `setQuantity(storeId, product, 2)` from `src/cart.ts` without awaiting, then `placeOrder(homeId)`; assert no `POST /orders` among the calls, release the `PUT`, await the placing, assert one `POST /orders` after the `PUT` with body `{"addressId": homeId}`. Then `Order number collision retried once` (two parts as the scenario: count `POST /orders` calls, check `result.order` then `result.error?.code === 'conflict'`). Then unit tests with no scenario: `order held and cart emptied on success` (`queryClient.getQueryData(orderKey('t-1', id))` is the order, `getQueryData(cartKey('t-1'))` has no items), `outcome of each answer` (one `outcomeOf` call per row of the table in the design file), `refusal copy` (`refusalOf` for each row, store name `Koramangala`), `mark text` (`shortText`: not in stock, quantity 2 of 3, quantity 5 of 3), `block precedence` (`blockReason`: marked over minimum over no address; `undefined` when none).
Build: `src/checkout.ts` per `docs/design/mobile-P4-L4b.md` "The port" and "Module interfaces", design.md Decisions 1, 4 and 5.

- [x] 1.1 `test:` the two scenarios and the unit tests, red
- [x] 1.2 `feat:` `src/checkout.ts`; gates green

## 2. Address card and choice (`src/checkout-address.tsx`) — group A

Scope: `src/checkout-address.tsx`, `src/checkout-address.test.tsx`.
Scenarios: Default address shown; No address yet; Choice sheet lists the addresses; Another address chosen; Address added at checkout.
Starts from: `src/checkout-address.test.tsx` test `Default address shown` (red: module missing). Each test renders a harness in the test file, `function Harness() { const [chosen, setChosen] = useState<string>(); return <AddressCard chosen={chosen} onChoose={setChosen} /> }`, inside `QueryClientProvider`, after `setToken('t-1')` and `fakeCore` with `GET /me/addresses`. The sheets are found by `findByRole('dialog', { name })` or their title text; the radios by `getByRole('radio', { name: 'Deliver to Home' })` with `toBeChecked()` / `not.toBeChecked()`, inside `getByRole('radiogroup', { name: 'Deliver to' })` (if the radiogroup role does not come through in Jest, use `getByLabelText('Deliver to')` and note it in your log). "Address added at checkout": `GET /me/addresses` answers Home first and Home and Work after the `POST /me/addresses` (201) has been received; fill L1's sheet as `src/address-sheet.test.tsx` does (the "Work" chip, "House, flat, floor", "Pincode", "Save address"); assert the "Add address" sheet is gone and "Delivering to Work" shows. Add one test with no scenario: `refused address badge` (`refusedId` set: "Not delivered here" in the card and on that row of the choice sheet only).
Build: design file "Address card" and "Module interfaces" (`chosenAddress`, `addressLine`, `AddressCard`), design.md Decision 3. Do not edit `src/address-sheet.tsx` or `src/addresses.ts`.

- [x] 2.1 `test:` the five scenarios and the badge test, red
- [x] 2.2 `feat:` `src/checkout-address.tsx`; gates green

## 3. Checkout screen, states and route — group B, after 1 and 2

Scope: `src/checkout-screen.tsx`, `src/app/checkout.tsx`, `src/checkout-screen.test.tsx`, `src/checkout-redirect.test.tsx`, `src/checkout-back.test.tsx`.
Scenarios: Checkout summary from the cart; Summary names the cart's store; Cash on delivery and bill; Free delivery at checkout; Empty checkout; Loading and failed checkout; Checkout below the minimum; Minimum from the cart when the pincode is not served; No address blocks placing; Place order shows the amount; Signed-out checkout redirect; Back to cart opens the cart sheet.
Starts from: `src/checkout-screen.test.tsx` test `Checkout summary from the cart` (red: module missing): `<CheckoutScreen />` inside `QueryClientProvider`, signed in, with `GET /me/cart`, `GET /me/addresses` and `GET /stores/<koramangala>` faked. "Summary names the cart's store": also `setPincode('560038')` and `GET /serviceability` answering Indiranagar; assert `queryByText(/Indiranagar/)` is null. "Minimum from the cart when the pincode is not served": `setPincode('560099')` with `GET /serviceability` answering no store (as L2's not-serviceable tests do); the block reads from `view.minOrderCents`, never `useStore()`. "Loading": `GET /me/cart` held. "Failed": the handler throws first, answers after; press "Try again". "Place order shows the amount": the button named "Place order" contains the text ₹135 (`within(button).getByText('₹135')`). Navigating, one per file: `src/checkout-redirect.test.tsx` `Signed-out checkout redirect` with `renderRouter(appDir, { initialUrl: '/checkout' })` as `src/orders-tracking-redirect.test.tsx`; `src/checkout-back.test.tsx` `Back to cart opens the cart sheet` with `renderRouter({ _layout: Layout, index: Stub, checkout: CheckoutRoute }, { initialUrl: '/checkout' })` where `Layout` renders `QueryClientProvider` › `<Stack />` and `<CartSheet />` (L3), signed in with a one-line cart; press "Back to cart"; assert the path is `/` and the "My cart" sheet title shows.
Build: the design file "5 · Checkout" (header, scroll items 2 to 5, the bar with `blockReason` with `marked: false` until task 5, states), `src/app/checkout.tsx`. The "Place order" button renders but its press does nothing yet (task 4 wires it). The store: `useQuery({ ...storeOptions(view.storeId ?? ''), enabled: !!view?.storeId })` with `storeOptions` from `src/cart.ts`; fees, totals and the minimum only from `useCart().view` (the server cart), never `useStore()` (design.md Decision 6).

- [x] 3.1 `test:` the twelve scenarios, red
- [x] 3.2 `feat:` `CheckoutScreen` and the route; gates green

## 4. Placing from the screen and the refusals — group C, after 3

Scope: `src/checkout-screen.tsx`, `src/checkout-place.test.tsx`, `src/checkout-placed.test.tsx`, `src/checkout-emptied.test.tsx`, `src/checkout-unconfirmed.test.tsx`.
Scenarios: Place order sent once; Address not served; Store closed at placement; Placement fails; Choosing another address clears the alert; Core cannot be reached at placement; Order placed; Cart already empty goes to orders; Unconfirmed placement that emptied the cart.
Starts from: `src/checkout-place.test.tsx` test `Place order sent once` (red: the press sends nothing): `POST /orders` held; fire two presses of "Place order" unawaited (common rules); `waitFor` one `POST /orders` and the button `toBeBusy()`; then release the held answer (a 409 `conflict` twice is simplest: no navigation) and `waitFor` the button not busy. Then the refusal scenarios in the same file, each a non-navigating render as task 3 (Work chosen through "Change" for "Address not served"; "Placement fails" is three renders in one test, or three tests named `Placement fails (subtotal)`, `(address)`, `(conflict)`). Navigating, one per file, with `renderRouter({ _layout: Layout, checkout: CheckoutRoute, 'orders/[id]': OrderRoute, orders: Stub }, { initialUrl: '/checkout' })` (`OrderRoute` is the default export of `src/app/orders/[id].tsx`; `Layout` as task 3 without the sheet): `Order placed` (`POST /orders` 201, `GET /orders/<id>` answering the same order; path `/orders/<id>`, heading "Order SS-ABCDEFGH", `getCartSummary().count` 0, one `POST` with Home's id), `Cart already empty goes to orders` (400 `validation` "cart is empty", no field; path `/orders`), `Unconfirmed placement that emptied the cart` (`POST /orders` answers 502 with no body, the next `GET /me/cart` the empty cart; path `/orders`).
Build: the design file "Screen state" and scroll item 1 (the alert), design.md Decisions 5 and 9.

- [x] 4.1 `test:` the nine scenarios, red
- [x] 4.2 `feat:` placing, the alert, the badge and the navigation; gates green

## 5. Out-of-stock marks — group D, after 4

Scope: `src/checkout-screen.tsx`, `src/checkout-out-of-stock.test.tsx`.
Scenarios: Out-of-stock lines marked; Marked line removed; Failed removal at checkout.
Starts from: `src/checkout-out-of-stock.test.tsx` test `Out-of-stock lines marked` (red: no marks): non-navigating render as task 3; `POST /orders` answers 409 `{"error":{"code":"out_of_stock","message":"some products are out of stock","productIds":[taaza, butter]}}`; `GET /me/cart` answers the three lines (Taaza 3 with product `quantity` 2, Butter `inStock` false `quantity` 0, Curd 1). "Marked line removed": `productIds` names Butter only; `PUT /me/cart/items` records its body and answers the cart without Butter (a `CartUpdate`). "Failed removal": `PUT` throws.
Build: the design file lines card (marked line) and "Screen state" (`short`), `blockReason` with `marked`, `useLineWrite` and `CartWriteAlert` from L3 per marked line (a small `MarkedLine` component in the screen file, as web's `ShortLine`).

- [x] 5.1 `test:` the three scenarios, red
- [x] 5.2 `feat:` the marks; gates green

## 6. Checkout e2e against core — group E, after 5

Scope: `e2e/checkout.spec.ts`.
Scenarios: Address added at checkout against core; Order placed against core; Out of stock at checkout against core; Address not served against core.
Starts from: `e2e/checkout.spec.ts` test `Address added at checkout against core` (red until the suite is run against the built screens: write all four first, commit as `test:`, then fix whatever the run shows in `feat:`/`fix:` commits within your scope, or stop and report if the fix is outside it).
Build: copy the helpers from `e2e/orders.spec.ts` and `e2e/cart.spec.ts` (`signedIn`, `guest`, `cartBar`, `cartSheet`, `serverCart`; design.md Decision 11), extending `orderPick` to return the product's `name` and `addAddress` to take a label and pincode; picks 2, 3, 4 and 5 in the scenario order. Copy the stock read, set to 0 and restore-in-`finally` from `apps/web/e2e/checkout.spec.ts`. Signed-in tests preset the token and `shopperstop:pincode` `560034` (`signedIn`); the guest test presets only the pincode. Reach `/checkout` through Home's "View cart" bar and the "My cart" sheet's "Proceed to checkout" link; the guest test finds its product through Home's search field as `e2e/catalog.spec.ts` does. Wait for `getByRole('dialog', { name })` before axe on a sheet. Run axe on every screen, sheet and alert state the scenario names.
Run (with the manager's e2e slot only; ask in your log): `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L4b && make e2e`; paste the mobile summary line.

- [ ] 6.1 `test:` the four scenarios
- [ ] 6.2 `feat:`/`fix:` until `make e2e` is green; gates green

## 7. Acceptance (team lead)

- [ ] 7.1 `/opsx:verify` on `mobile-checkout`: every scenario maps to a passing test of the same name (design.md "Scenario to test"), every task ticked, nothing landed outside the scope lists; gaps reported with the exact test or file
