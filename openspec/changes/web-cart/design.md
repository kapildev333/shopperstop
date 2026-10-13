# Design

## Context
`apps/web` on main (a303fa2): shell (`src/routes/__root.tsx`), accounts from web-P2-L2 (`src/api.ts`: `api` with the bearer middleware and relative `baseUrl: '/api/core/v1'`, `queryClient` with `retry: false`, `call`, `splitError`, `useMe`; `src/session.ts`: guarded `localStorage` store with `useSyncExternalStore`; `src/auth.ts`: `openSession` → `startSession` for sign-in and register), Vitest route tests over `routeTree` in a memory router, Playwright with `e2e/global-setup.ts` (`migrate`, `seed-demo --reset` on `shopperstop_core_e2e`).

Built on web-P2-L1 `web-serviceability-catalog` (its design.md, not merged yet; tasks 2 and 3 here start only after its task 2 is on main, task 3 after its task 4): `src/pincode.ts` (`getPincode`, `setPincode` closing the sheet, `closePincodeSheet`, `usePincode`), `src/catalog.ts` (`keys.serviceability`, `useServiceability(pincode)` answering `Store | null`, `staleTime` 60 s), `src/pincode-sheet.tsx` (`PincodeSheet`, whose valid submit calls `setPincode(value)`), `src/product-card.tsx` (`ImageTile`, `ProductCard` using `useCartQuantity(product)` and `Stepper max={product.inStock ? product.quantity : 0}`), `src/cart.ts` (the `useCartQuantity` stub), `src/test-data.ts` (`store`, `product`, `renderAt`, `renderInRouter`).

Core routes (core-P2-L4 `core-stock-cart`, merged in #106; checked 2026-10-13 against `services/core/openapi.json`, `packages/ui/src/api/core.d.ts`, `openspec/specs/cart` and `internal/cart/cart.go`): `GET /me/cart` → `Cart {storeId?, items: CartLine[], subtotalCents, deliveryFeeCents, totalCents, minOrderCents, shortfallCents}`, `CartLine {product: StoreProduct, quantity}`; `PUT /me/cart/items` `CartItemSet {storeId, productId, quantity 0..20}` → 200 `CartUpdate` (`Cart` + `replaced`, `clamped`), 400 `validation` (`quantity`, `productId` for an inactive or unknown product at a quantity above 0, `storeId` for an unknown store at any quantity, 0 included); `DELETE /me/cart` → 204, also with no cart; all 401 without a customer token. Core sets absolute quantities; clamps to real stock first (`clamped: true`; a line cut to 0 is absent from `items`, and an existing line of it is removed); deletes an emptied cart (no `storeId`); then, for a store other than the cart's, replaces the cart when the quantity is still above 0 (`replaced: true`, also `clamped: true` when cut) and leaves it exactly as it is when the quantity is 0, asked for or clamped (`replaced: false`). So `clamped: true` does not mean the cart is at the store that was sent or holds the product: only the answer's `storeId` and `items` say. Core keeps deactivated products as lines with `inStock` false, and a cart read does not clamp (a line can show a quantity above its product's `quantity`). `StoreProduct.quantity` is capped at 10; `CartLine.quantity` is 1 to 20. Fees: `fee = subtotal >= freeDeliveryAbove ? 0 : deliveryFee`, `shortfall = max(0, freeDeliveryAbove − subtotal)` (core Decision 7, 8). Demo: Koramangala `...0401` (560034, 10 min) and Indiranagar `...0402` (560038, 12 min), both fee 2500, free from 19900, minimum 9900; stock per store with a zero and a low count every 15 products.

## Goals / Non-Goals
**Goals:** every scenario of the delta (28) has a named test; one cart shape for guest and server so every view has one code path; three sequential worker tasks; no change outside `apps/web`.

**Non-Goals:** the `/checkout` page (web-P2-L4), optimistic server updates, cross-tab sync, refreshing guest product snapshots, a cart page or route, holding stock.

## Files (all under `apps/web/`)
| File | Task | What |
|---|---|---|
| `src/guest-cart.ts`, `src/guest-cart.test.ts` | 1 | types, `maxQuantity`, `cartReducer`, `cartView`, `mergeBodies`, the guest store |
| `src/test-setup.ts` | 1 | `afterEach` also calls `clearGuestCart()` |
| `src/cart.ts` | 2 | replaces web-P2-L1's stub: `cartKey`, `cartOptions`, `useCart`, `useCartQuantity`, `setLine`, `clearCart`, `mergeGuestCart` |
| `src/cart.test.tsx` | 2 | |
| `src/guest-cart.test.ts` | 2 | one pin test added ("out of stock at another store keeps the guest cart"); `guest-cart.ts` already behaves so |
| `src/product-card.test.tsx` (web-P2-L1's) | 2 | only the two lines that resolve a store, if its "add shows the count" does not have them (the real hook does nothing without a resolved store) |
| `src/auth.ts` | 2 | `openSession` awaits `mergeGuestCart()` after `startSession` |
| `e2e/cart.spec.ts` | 2, 3 | 2: merge; 3: drawer, clamp, store change |
| `src/cart-drawer.tsx`, `src/cart-drawer.test.tsx` | 3 | `openCart`, `closeCart`, `useCartOpen`, `CartSheet`, `CartBar`, `CartButton` |
| `src/store-change.tsx`, `src/store-change.test.tsx` | 3 | `changePincode`, `StoreChangeDialog` |
| `src/catalog.ts` | 3 | `serviceabilityOptions(pincode)` extracted from `useServiceability` (same key, `queryFn`, `staleTime`; the hook calls it) |
| `src/pincode-sheet.tsx` | 3 | valid submit calls `void changePincode(value)` instead of `setPincode(value)` |
| `src/routes/__root.tsx` | 3 | `<CartButton />` before `<PincodeButton />` in the banner's right group; `main` gets `pb-24 sm:pb-6`; after `main`: `<CartBar />`, `<CartSheet />`, `<StoreChangeDialog />` |

No new dependency.

## Interfaces

### `src/guest-cart.ts` (task 1, pure apart from the store; no import from `api.ts` or generated types, so it builds before core-P2-L4)
```ts
// Structural subset of core's StoreProduct: the generated type is assignable to it.
export type CartProduct = { id: string; name: string; slug: string; unitLabel: string; priceCents: number; mrpCents: number; imageUrl?: string; inStock: boolean; quantity: number }
export type CartLine = { product: CartProduct; quantity: number }
export type GuestCart = { storeId?: string; items: CartLine[] }
export type CartFees = { deliveryFeeCents: number; freeDeliveryAboveCents: number; minOrderCents: number }
export type CartView = GuestCart & { subtotalCents: number; deliveryFeeCents: number; totalCents: number; minOrderCents: number; shortfallCents: number; clamped?: boolean }
export type CartAction = { type: 'set'; storeId: string; product: CartProduct; quantity: number } | { type: 'clear' }

export const lineCap = 20
export const emptyCart: GuestCart = { items: [] }
export function maxQuantity(p: CartProduct): number          // p.inStock ? Math.min(p.quantity, lineCap) : 0
export function cartReducer(state: GuestCart, action: CartAction): GuestCart
export function cartView(cart: GuestCart, fees?: CartFees): CartView
export function mergeBodies(cart: GuestCart): { storeId: string; productId: string; quantity: number }[]   // [] without storeId
export function itemCount(cart: GuestCart): number           // sum of quantities
// store: key 'shopperstop:cart'
export function getGuestCart(): GuestCart
export function dispatchGuest(action: CartAction): void      // state = cartReducer(state, action); notify; then guarded write (removeItem when empty)
export function clearGuestCart(): void                       // dispatchGuest({ type: 'clear' })
export function useGuestCart(): GuestCart                    // useSyncExternalStore(subscribe, getGuestCart)
```
- `cartReducer` `set`: `q = Math.max(0, Math.min(Math.trunc(quantity), maxQuantity(product)))`. If `state.storeId` is set and differs from `action.storeId`: `q === 0` → return `state`; else start from `emptyCart`. Existing line of `product.id`: `q === 0` → drop it, else replace `{ product, quantity: q }` in place (order kept). New line: append when `q > 0`. No lines left → return `emptyCart`; else `{ storeId: action.storeId, items }`. `clear` → `emptyCart`. Always a new object when anything changed (stable snapshot otherwise).
- `cartView`: no items → every amount 0, no `storeId`. Else `subtotal = Σ priceCents × quantity`; with `fees`: `fee = subtotal >= freeDeliveryAboveCents ? 0 : deliveryFeeCents`, `minOrder = minOrderCents`, `shortfall = Math.max(0, freeDeliveryAboveCents − subtotal)`; without `fees` (no store resolved) all three 0; `total = subtotal + fee`.
- `read()`: guarded `getItem` + `JSON.parse` in one `try`; accept only `{ items: Array }` whose every item has `product.id` string and integer `quantity` 1..20, and a string `storeId` when items exist; anything else → `emptyCart`. Write mirrors `session.ts`: memory first, notify, then guarded `setItem`/`removeItem`.

### `src/cart.ts` (task 2; replaces the stub, keeps `useCartQuantity(product)`)
```ts
type Cart = components['schemas']['Cart']; type StoreProduct = components['schemas']['StoreProduct']
export const cartKey = (token: string) => ['cart', token] as const
export function cartOptions(token: string)   // queryOptions: queryKey cartKey(token), staleTime 60_000, queryFn: GET /me/cart, throw error, return data
export function useCart(): { view?: CartView; isPending: boolean; isError: boolean; refetch: () => void; signedIn: boolean }
  // token = useToken(); guest = useGuestCart(); store = useServiceability(usePincode().pincode).data ?? undefined
  // server = useQuery({ ...cartOptions(token ?? ''), enabled: !!token })
  // signed out: { view: cartView(guest, store), isPending: false, isError: false, refetch: () => {}, signedIn: false }
  // signed in: { view: server.data, isPending: server.isPending, isError: server.isError, refetch: () => void server.refetch(), signedIn: true }
export function useCartQuantity(product: StoreProduct): readonly [number, (next: number) => void]
  // storeId = resolved store's id (useServiceability as above)
  // quantity = view?.storeId === storeId ? (view.items.find(l => l.product.id === product.id)?.quantity ?? 0) : 0
  //   (product ids are the same at every store: a cart at another store must not count here, Decision 15)
  // setter: storeId ? void setLine(storeId, product, next) : no-op
export async function setLine(storeId: string, product: CartProduct, quantity: number): Promise<void>
  // no token → dispatchGuest({ type: 'set', storeId, product, quantity })
  // token → api.PUT('/me/cart/items', { body: { storeId, productId: product.id, quantity } }) inside try:
  //   data → await queryClient.cancelQueries({ queryKey: cartKey(token) }); queryClient.setQueryData(cartKey(token), data)
  //     (the whole CartUpdate: its `items` and `storeId` are the truth, whatever was sent; `clamped` is what the drawer reads;
  //      `replaced` is not used, Decision 15; the cancel keeps a GET still in flight from overwriting the answer)
  //   error or throw → queryClient.invalidateQueries({ queryKey: cartKey(token) })
  // Never derive the cart from the request or from the flags: no "clamped means the line is there at a lower count",
  // no "I sent store B so the cart is at B".
export async function clearCart(): Promise<ApiError | undefined>
  // no token → clearGuestCart(); undefined
  // token → error = await call(() => api.DELETE('/me/cart')); on success setQueryData(cartKey(token), cartView(emptyCart)); return error
export async function mergeGuestCart(): Promise<void>
  // token = getToken(); bodies = mergeBodies(getGuestCart()); nothing to do without both
  // for each body in order: await call(...) capturing data (like auth.ts openSession);
  //   answered → clamped ||= data.clamped; last = data;   error → failed = true (keep going)
  // then clearGuestCart(); await queryClient.cancelQueries({ queryKey: cartKey(token) });
  //   last && !failed ? setQueryData(cartKey(token), { ...last, clamped }) : invalidateQueries({ queryKey: cartKey(token) })
  // `last` is the cart whatever each push did (set, clamped, clamped away, replaced, or left at another store): show it as it is.
```
The server `CartView` is core's `Cart` (or `CartUpdate`) as answered; it is assignable to `CartView` because `StoreProduct` is assignable to `CartProduct`. If the generated types disagree, the worker stops and reports.

### `src/auth.ts` (task 2)
`openSession`: after `startSession(opened.session)`, `await mergeGuestCart()`; then return `undefined`. Navigation (in the routes) happens after `signIn`/`register` resolve, so Home renders the merged cart.

### `src/cart-drawer.tsx` (task 3)
- Open store: module `let open = false`, listeners, `openCart()`, `closeCart()`, `useCartOpen()` (same pattern as `pincode.ts`).
- `countLabel(n)`: `n === 1 ? '1 item' : `${n} items``.
- `CartSheet()`: `<Sheet open={useCartOpen()} onClose={closeCart} title="Your cart">`; body `<div className="flex flex-col gap-4">`:
  | State | Shows |
  |---|---|
  | `isPending` | `Skeleton variant="list" count={3}` |
  | `isError` | `ErrorBanner` "Could not load your cart." `onRetry={refetch}` |
  | no items | the clamp notice (below) when `clamped`; `EmptyState icon={ShoppingCart}` "Your cart is empty", "Add products from the store to see them here.", action `Button variant="secondary" onClick={closeCart}` "Continue shopping" |
  | items | the clamp notice when `clamped`; `<ul className="flex flex-col divide-y divide-line">` of lines; summary; nudge; minimum or checkout |

  Clamp notice: `view.clamped` → `StatusMessage tone="warning"` "Some quantities were lowered to what the store has.", first in the body in both states (core answers an empty cart with `clamped: true` when the only line was cut to 0).
  - Line `<li className="flex items-center gap-3 py-3">`: `<div className="w-14 shrink-0"><ImageTile src={product.imageUrl} /></div>`, `<div className="min-w-0 flex-1"><p className="text-body font-semibold text-ink">{name}</p><p className="text-small text-ink-muted">{unitLabel}</p><Price cents={priceCents} mrpCents={mrpCents} /></div>`, then `<Stepper value={quantity} max={maxQuantity(product)} label={name} onChange={(n) => void setLine(storeId, product, n)} />` and, when `maxQuantity(product) === 0`, `<Button variant="ghost-danger" aria-label={`Remove ${name}`} onClick={() => void setLine(storeId, product, 0)}>Remove</Button>`. `storeId` is `view.storeId` (a cart with lines has one), never the resolved store's: the drawer edits the cart where it is, so its `PUT`s never trigger a replace, and a removal (0) always names the cart's own store, which exists. A line whose quantity is above its `maxQuantity` (stock fell since) shows that quantity with "Add one" disabled.
  - Summary `<dl className="flex flex-col gap-2 text-body text-ink">`, rows `<div className="flex justify-between"><dt>…</dt><dd>…</dd></div>`: "Subtotal" `Price`; "Delivery fee" `Price` or `<span className="font-semibold text-accent">Free</span>` when `deliveryFeeCents === 0`; "Total" `Price` (row `font-semibold`).
  - Nudge: `shortfallCents > 0` → `StatusMessage` "Add {formatInr(shortfallCents)} more for free delivery".
  - Minimum: `subtotalCents < minOrderCents` → `StatusMessage tone="warning"` "Minimum order is {formatInr(min)}. Add {formatInr(min − subtotal)} more to check out." and `Button size="lg" className="w-full" disabled` "Proceed to checkout". Else signed in → `ButtonLink size="lg" className="w-full" href="/checkout" onClick={closeCart}`; signed out → `RouterButtonLink size="lg" className="w-full" to="/sign-in" search={{ returnTo: '/checkout' }} onClick={closeCart}` (`createLink(ButtonLink)` as in `account-link.tsx`).
- `CartBar()`: nothing while `itemCount(view) === 0`; else `<aside aria-label="Cart summary" className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 bg-surface px-4 py-3 shadow-sheet sm:hidden"><div className="flex flex-col"><span className="text-body font-semibold text-ink">{countLabel}</span><Price cents={totalCents} /></div><Button aria-haspopup="dialog" onClick={openCart}>View cart</Button></aside>`.
- `CartButton()`: `<Button variant="secondary" aria-haspopup="dialog" className="hidden sm:inline-flex" onClick={openCart}><ShoppingCart size={16} aria-hidden />{count === 0 ? 'Cart' : <><span>{countLabel}</span>{' '}<span className="tabular-nums">{formatInr(totalCents)}</span></>}</Button>` (name "Cart" or "2 items ₹79"; `formatInr`, not `Price`, so the button keeps one text colour).

### `src/store-change.tsx` (task 3)
```ts
type Pending = { pincode: string; store: Store }
// module store: let pending: Pending | undefined; listeners; usePending()
export async function changePincode(next: string): Promise<void>
  // token = getToken()
  // cart = token ? await queryClient.fetchQuery(cartOptions(token)) : getGuestCart()   (fetch failure → setPincode(next); return)
  // !cart.storeId || cart.items.length === 0 → setPincode(next); return
  // store = await queryClient.fetchQuery(serviceabilityOptions(next))                   (failure → setPincode(next); return)
  // !store || store.id === cart.storeId → setPincode(next); return
  // closePincodeSheet(); pending = { pincode: next, store }; notify
export function StoreChangeDialog()
  // <Dialog open={!!pending} onClose={cancel} title="Change store?">
  //   <p className="mt-2 text-body text-ink">{store.name} delivers to {pincode}. Your cart holds products from another store and will be emptied.</p>
  //   error && <ErrorBanner className="mt-4" message="Could not empty your cart." />
  //   <DialogFooter onCancel={cancel}><Button loading={busy} onClick={confirm}>Empty cart and change</Button></DialogFooter>
  // confirm: busy; error = await clearCart(); error → show it, keep pending; else setPincode(pincode), pending = undefined
  // cancel: pending = undefined, error cleared
```

## Decisions
1. **One cart shape, two backends.** Guest totals are computed in the browser with core's formula from the resolved `Store`, so the drawer, bar and button read one `CartView` whatever the backend. Ceiling: guest totals use the price snapshot taken when the line was set (a repriced or emptied product shows its old price and stock until sign-in, when core recomputes everything); core changing its fee rule means changing `cartView` too.
2. **Guest product snapshots are not refreshed.** The guest line keeps the `StoreProduct` it was set with; refreshing would mean a request per line or a by-ids route core does not have. Consequence: an out-of-stock line in practice only appears in a server cart; the merge at sign-in clamps stale guest lines to real stock.
3. **Set, not add, everywhere.** The reducer, the server and the merge all set absolute quantities (core's semantics). At sign-in the guest quantity wins per line; server lines the guest cart does not name stay when both carts are at the same store; when the guest cart is at another store, the first push that store has stock for replaces the server cart (core `replaced: true`); a push it has none of leaves the server cart alone (`clamped: true, replaced: false`), so if the store has none of any guest line the customer keeps the old server cart at its old store and the guest cart is still discarded (Decision 4). The merge needs no branch for any of this: it pushes every line and shows the last answer. That is the reading of "pushed to the server with `PUT /me/cart/items` per line" (Spec 2 §7).
4. **The guest cart is discarded after the merge even if a push failed** (orchestrator, D13). After a failed push the cache is refetched instead of set, because a request that timed out may still have been applied. Ceiling: lines whose push failed (network, or 400 for a product deactivated since) are lost; a guest cart is cheap to rebuild and a half-merged local cart would be invisible once signed in.
5. **Stepper maximum is the displayed stock** (`quantity`, at most 10 by D7), with the 20-per-line cap as a guard. Lifting it to 20 for "10+" products would change web-P2-L1's card requirement ("maximum is its quantity"), so it stays (orchestrator, D13: no raise to 20). Ceiling: a customer cannot put more than 10 of one product in the cart even when the store holds more.
6. **No optimistic server updates.** A server Stepper shows the new count when `PUT` answers. Ceiling: two clicks faster than a round trip send the same quantity twice (the second is a no-op); add `onMutate` when a slow network makes it visible.
7. **The clamp notice rides on the cached `CartUpdate`.** `setLine` stores the whole `PUT` answer, so `clamped` is in the cache until the next answer or a refetch; no extra state. The merge sets `clamped` when any push clamped. The flag only switches the notice on: nothing else is derived from it, since core also sets it when it left a cart at another store untouched. The copy stays true there too (the asked line was lowered to 0).
8. **Store change is intercepted before the pincode is stored.** `changePincode` resolves the new pincode first (pre-warming the serviceability cache), and only asks when the store differs and the cart has lines. A not-serviceable pincode or a failed lookup stores the pincode at once and leaves the cart alone (the page shows its notice; the cart still names the old store until the next change). The pincode sheet closes before the dialog opens, so two modals never trap focus at once.
9. **Confirming uses `DELETE /me/cart`** (orchestrator, D13), not the implicit replace on the next add, because Spec 2 §7 says the cart is cleared after the confirm, and because core's replace is no longer certain: an add the new store has no stock for leaves the old cart standing.
10. **Drawer and store-change state are module stores** like `pincode.ts`'s sheet flag, because the banner button, the bottom bar and the sheet live in different parts of `__root.tsx`.
11. **`/checkout` is a plain `ButtonLink href`** (full page load) while the route does not exist: a router `Link` to an unregistered path does not type-check. web-P2-L4 switches it to `RouterButtonLink to="/checkout"` when it adds the route (`ponytail:` comment in the file). Signed out, the link goes to `/sign-in?returnTo=%2Fcheckout`; until web-P2-L4 lands, signing in from there lands on "Page not found" (accepted, orchestrator D13).
12. **Bar and header button both render; CSS picks one** (`sm:hidden` and `hidden sm:inline-flex`). `main` keeps `pb-24` on phone so the fixed bar never covers the last row. Ceiling: the bar also shows on `/checkout` until web-P2-L4 hides it there.
13. **Vitest without HTTP mocks.** Server carts are seeded with `setToken('t')` and `queryClient.setQueryData(cartKey('t'), cart)` (`staleTime` 60 s, no refetch); "core unreachable" is the relative `baseUrl` failing under jsdom (as in web-P2-L1). Everything that needs core's answers (merge, clamp, removal, `DELETE`) has a Playwright test.
14. **E2e customers are fresh** (registered through `page.request.post('/api/core/v1/auth/register')` with a unique email, token put in `localStorage` by `addInitScript` where the test does not sign in through the UI), so tests never share a server cart with each other or with web-P2-L2's demo-customer tests. The clamp test changes stock with the seeded admin (`admin@shopperstop.local` / `admin12345`) on a product it picks from `GET /stores/{id}/products?pageSize=100` (the last with `inStock` true and `quantity` 10, not `banana-robusta`, which other suites open) and restores it in `finally`. `StoreProduct.quantity` is capped at 10, so the value to restore is the real one, read first from `GET /admin/stores/{id}/stock?q=<name>` (`items[].quantity`); stock is written with `PUT /admin/stores/{id}/stock` `{rows: [{productId, quantity}]}` (204).
15. **A cart at another store than the resolved one is shown as it is, and counts for nothing on the cards.** It happens without a store change in this browser: signing in where the server cart was filled under another pincode (no guest lines, or core kept the old cart because the new store had none of them, Decision 3), or another device. Product ids are the same at every store, so `useCartQuantity` matches a line only while `view.storeId` is the resolved store's; without that a card would show the other store's count, "Add one" would send that count plus one to the resolved store, and "Remove one" to 0 would be a no-op at core (0 for another store changes nothing). The bar, the header button and the drawer still show the cart, and the drawer edits it at its own store. Ceiling, escalated: choosing ADD on a card then sends a positive quantity at the resolved store, and core replaces the old cart (`replaced: true`) with no confirm and no notice from the site; `replaced` is ignored. Saving the pincode again does open "Change store?" (Decision 8 compares with the cart's `storeId`).

## Scenario → test
| Scenario | Test (file › name) | Task |
|---|---|---|
| Guest line set and removed | `src/guest-cart.test.ts` › "guest line set and removed" | 1 |
| Guest line clamped | `src/guest-cart.test.ts` › "guest line clamped" | 1 |
| Another store replaces the guest cart | `src/guest-cart.test.ts` › "another store replaces the guest cart" | 1 |
| Out of stock at another store keeps the guest cart | `src/guest-cart.test.ts` › "out of stock at another store keeps the guest cart" (pin: passes on arrival) | 2 |
| Guest cart persisted and restored | `src/guest-cart.test.ts` › "guest cart persisted and restored" | 1 |
| Guest cart with blocked storage | `src/guest-cart.test.ts` › "guest cart with blocked storage" | 1 |
| Guest totals follow the store's fees | `src/guest-cart.test.ts` › "guest totals follow the store's fees" | 1 |
| Merge bodies in guest order | `src/guest-cart.test.ts` › "merge bodies in guest order" | 1 |
| Card adds to the guest cart | `src/cart.test.tsx` › "card adds to the guest cart" | 2 |
| Card shows the server cart | `src/cart.test.tsx` › "card shows the server cart" | 2 |
| Card ignores a cart at another store | `src/cart.test.tsx` › "card ignores a cart at another store" | 2 |
| Guest cart discarded after merge | `src/cart.test.tsx` › "guest cart discarded after merge" | 2 |
| Guest cart merges against core | `e2e/cart.spec.ts` › "guest cart merges against core" | 2 |
| Drawer lines and totals | `src/cart-drawer.test.tsx` › "drawer lines and totals" | 3 |
| Free delivery | `src/cart-drawer.test.tsx` › "free delivery" | 3 |
| Checkout link signed in and out | `src/cart-drawer.test.tsx` › "checkout link signed in and out" | 3 |
| Out-of-stock line | `src/cart-drawer.test.tsx` › "out-of-stock line" | 3 |
| Empty, loading and failed cart | `src/cart-drawer.test.tsx` › "empty, loading and failed cart" | 3 |
| Below the minimum order | `src/cart-drawer.test.tsx` › "below the minimum order" | 3 |
| Bar and header follow the cart | `src/cart-drawer.test.tsx` › "bar and header follow the cart" | 3 |
| Server cart clamps above stock | `e2e/cart.spec.ts` › "server cart clamps above stock" | 3 |
| Line clamped away | `src/cart-drawer.test.tsx` › "line clamped away" | 3 |
| Cart drawer against core | `e2e/cart.spec.ts` › "cart drawer against core" | 3 |
| Same store or empty cart | `src/store-change.test.tsx` › "same store or empty cart" | 3 |
| Store change against core | `e2e/cart.spec.ts` › "store change against core" | 3 |
| Store change confirmed | `src/store-change.test.tsx` › "store change confirmed" | 3 |
| Store change cancelled | `src/store-change.test.tsx` › "store change cancelled" | 3 |
| Emptying the server cart fails | `src/store-change.test.tsx` › "emptying the server cart fails" | 3 |

## Test strategy
- `guest-cart.test.ts`: reducer and `cartView` as plain functions; module-load scenarios use `vi.resetModules()` and `await import('./guest-cart')` like `session.test.ts`; blocked storage spies on `Storage.prototype` (`getItem`, `setItem`, `removeItem` throwing) like it. Builders: a local `p(overrides)` returning a `CartProduct` (no generated types in task 1).
- `cart.test.tsx`, `cart-drawer.test.tsx`, `store-change.test.tsx`: web-P2-L1's `test-data.ts` (`store()`, `product()`, `renderAt`, `renderInRouter`); a store is resolved with `setPincode('560034')` and `queryClient.setQueryData(keys.serviceability('560034'), store())`; a server cart with `setToken('t')` and `queryClient.setQueryData(cartKey('t'), cart)` (a full `Cart`: `storeId` the resolved store's unless the test is about another store; "line clamped away" seeds `{ ...cartView(emptyCart), clamped: true }`); a guest cart with `dispatchGuest`. `test-data.ts`'s `store()` has `freeDeliveryAboveCents` 0 and `minOrderCents` 0: tests about fees pass the overrides. The drawer is opened with `openCart()` (or the "View cart" button) after `renderAt('/')`; a test adds a `closeCart()` to its cleanup or `test-setup.ts` gets it in task 3. The pincode for the second store is seeded with `keys.serviceability('560038')` → `store({ id: '...0402', name: 'Indiranagar', promisedMinutes: 12 })`, and `changePincode('560038')` is called directly (the sheet's own tests stay web-P2-L1's).
- "Loading" is asserted synchronously right after rendering with a token and no seeded cart (the jsdom request fails only after the first render); "failed" with `findByRole('alert')` afterwards.
- `Price` renders a struck MRP as "MRP ₹29": match totals by the `dd` next to each `dt`, not by bare text.
- e2e (`e2e/cart.spec.ts`): pincode via `addInitScript` storing `560034` (and the token when the test starts signed in); product Steppers found by role names (`/^Add /` on Home's "Picked for you" cards, then "Add one <name>"); inside the open drawer, queries are scoped to `page.getByRole('dialog', { name: 'Your cart' })` because the cards behind it carry the same names; `new AxeBuilder({ page }).analyze()` → `[]` on every page, open sheet and dialog. The phone test uses `test.use({ viewport: { width: 390, height: 844 } })` in its own `describe`. The demo stock has low counts (1 to 4, one product in 15): a test that sets a product to 2 takes its names from `GET /api/core/v1/stores/00000000-0000-4000-8000-000000000401/products?pageSize=24` (`inStock` and `quantity >= 2`, the first two; "Picked for you" is the first 12 in stock of that page), not the first cards blindly.

## Risks / Trade-offs
- [web-P2-L1 lands with different names or files] → task 2 and 3 workers follow what is on main and note it in the lane log; a behaviour difference stops them.
- [The site infers the cart from what it sent] → it never does: every `PUT` answer is cached whole, and the card matches on the answer's `storeId` (Decision 15); "card ignores a cart at another store" and "line clamped away" pin it.
- [web-P2-L1's `product-card.test.tsx` › "add shows the count" renders a card with no resolved store] → with the real hook ADD does nothing there; task 2 adds the store lines to that test (in scope) or web-P2-L1 writes it with them (request in the lane log).
- [Two lanes edit `__root.tsx`, `test-setup.ts`, `catalog.ts`, `pincode-sheet.tsx`] → this lane's tasks start after web-P2-L1's matching tasks are on main, and rebase before each start.
- [e2e stock edits race other suites] → the clamp test edits one product no other suite names and restores it; `make e2e` runs one suite at a time.
