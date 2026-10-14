# Design

## Context
`apps/web` on main (a303fa2): shell (`src/routes/__root.tsx`), accounts from web-P2-L2 (`src/api.ts`: `api` with the bearer middleware and relative `baseUrl: '/api/core/v1'`, `queryClient` with `retry: false`, `call`, `splitError`, `useMe`; `src/session.ts`: guarded `localStorage` store with `useSyncExternalStore`; `src/auth.ts`: `openSession` → `startSession` for sign-in and register), Vitest route tests over `routeTree` in a memory router, Playwright with `e2e/global-setup.ts` (`migrate`, `seed-demo --reset` on `shopperstop_core_e2e`).

Built on web-P2-L1 `web-serviceability-catalog` (merged, #119; re-read on the branch 2026-10-13: `setPincode` also closes the sheet and has one app caller, `PincodeForm`; `useServiceability`'s `queryFn` is inline; `useCartQuantity` has two call sites, the card and `/p/$slug`): `src/pincode.ts` (`getPincode`, `setPincode` closing the sheet, `closePincodeSheet`, `usePincode`), `src/catalog.ts` (`keys.serviceability`, `useServiceability(pincode)` answering `Store | null`, `staleTime` 60 s), `src/pincode-sheet.tsx` (`PincodeSheet`, whose valid submit calls `setPincode(value)`), `src/product-card.tsx` (`ImageTile`, `ProductCard` using `useCartQuantity(product)` and `Stepper max={product.inStock ? product.quantity : 0}`), `src/cart.ts` (the `useCartQuantity` stub), `src/test-data.ts` (`store`, `product`, `renderAt`, `renderInRouter`).

Core routes (core-P2-L4 `core-stock-cart`, merged in #106; checked 2026-10-13 against `services/core/openapi.json`, `packages/ui/src/api/core.d.ts`, `openspec/specs/cart` and `internal/cart/cart.go`): `GET /me/cart` → `Cart {storeId?, items: CartLine[], subtotalCents, deliveryFeeCents, totalCents, minOrderCents, shortfallCents}`, `CartLine {product: StoreProduct, quantity}`; `PUT /me/cart/items` `CartItemSet {storeId, productId, quantity 0..20}` → 200 `CartUpdate` (`Cart` + `replaced`, `clamped`), 400 `validation` (`quantity`, `productId` for an inactive or unknown product at a quantity above 0, `storeId` for an unknown store at any quantity, 0 included); `DELETE /me/cart` → 204, also with no cart; all 401 without a customer token. Core sets absolute quantities; clamps to real stock first (`clamped: true`; a line cut to 0 is absent from `items`, and an existing line of it is removed); deletes an emptied cart (no `storeId`); then, for a store other than the cart's, replaces the cart when the quantity is still above 0 (`replaced: true`, also `clamped: true` when cut) and leaves it exactly as it is when the quantity is 0, asked for or clamped (`replaced: false`). So `clamped: true` does not mean the cart is at the store that was sent or holds the product: only the answer's `storeId` and `items` say. Core keeps deactivated products as lines with `inStock` false, and a cart read does not clamp (a line can show a quantity above its product's `quantity`). `StoreProduct.quantity` is capped at 10; `CartLine.quantity` is 1 to 20. Fees: `fee = subtotal >= freeDeliveryAbove ? 0 : deliveryFee`, `shortfall = max(0, freeDeliveryAbove − subtotal)` (core Decision 7, 8). Demo: Koramangala `...0401` (560034, 10 min) and Indiranagar `...0402` (560038, 12 min), both fee 2500, free from 19900, minimum 9900; stock per store with a zero and a low count every 15 products.

## Goals / Non-Goals
**Goals:** every scenario of the delta (39) has a named test; one cart shape for guest and server so every view has one code path; sequential worker tasks 1, 2, 2b, 3a, 3b; no change outside `apps/web`.

**Non-Goals:** the `/checkout` page (web-P2-L4), optimistic lines and totals (Decision 6), cross-tab sync, refreshing guest product snapshots, a cart page or route, holding stock.

## Files (all under `apps/web/`)
| File | Task | What |
|---|---|---|
| `src/guest-cart.ts`, `src/guest-cart.test.ts` | 1 | types, `maxQuantity`, `cartReducer`, `cartView`, `mergeBodies`, the guest store |
| `src/test-setup.ts` | 1 | `afterEach` also calls `clearGuestCart()` |
| `src/cart.ts` | 2 | replaces web-P2-L1's stub: `cartKey`, `cartOptions`, `useCart`, `useCartQuantity`, `setLine`, `clearCart`, `mergeGuestCart` |
| `src/cart.test.tsx` | 2, 2b | 2b: "guest taps each count", "quick taps each count", "failed write returns to the cart's count" |
| `src/cart.ts` | 2b | the write queue: `asked`, `queued`, `useAsked`; `setLine`, `clearCart` and `mergeGuestCart` run through it; `useCartQuantity` reads `useAsked` first |
| `src/guest-cart.ts` | 2 | type only: `CartView` gains `replaced?: boolean; replacedStoreId?: string` |
| `src/guest-cart.test.ts` | 2 | one pin test added ("out of stock at another store keeps the guest cart"); `guest-cart.ts` already behaves so |
| `src/product-card.test.tsx` (web-P2-L1's) | 2 | only the two lines that resolve a store, if its "add shows the count" does not have them (the real hook does nothing without a resolved store) |
| `src/auth.ts` | 2 | `openSession` awaits `mergeGuestCart()` after `startSession` |
| `e2e/cart.spec.ts` | 2, 2b, 3a, 3b | 2: merge; 2b: quick taps; 3a: drawer, clamp; 3b: store change, replaced notice (card and merge) |
| `e2e/browse.spec.ts` (web-P2-L1's) | 3a | "product pages against core" also visits `/p/no-such-product` (folded in by the manager; no scenario of this change, Decision 16) |
| `src/cart-drawer.tsx`, `src/cart-drawer.test.tsx` | 3a, 3b | 3a: `openCart`, `closeCart`, `useCartOpen`, `CartSheet`, `CartLineRow`, `CartBar`, `CartButton`; 3b: `storeKey`, `ReplacedNotice` and its two places |
| `src/store-change.tsx`, `src/store-change.test.tsx` | 3b | `changePincode`, `cancelStoreChange`, `StoreChangeDialog` |
| `src/catalog.ts` | 3b | `serviceabilityOptions(pincode)` lifted out of `useServiceability` (same key, `queryFn`, `staleTime`); the hook becomes `useQuery({ ...serviceabilityOptions(pincode ?? ''), enabled: !!pincode })` |
| `src/pincode-sheet.tsx` | 3b | `PincodeForm` only (the one app caller of `setPincode`): a valid submit awaits `changePincode(value)` with the button `loading` meanwhile |
| `src/routes/__root.tsx` | 3a, 3b | 3a: `<CartButton />` before `<PincodeButton />` in the banner's right group; after `main`: `<CartBar />`, `<CartSheet />`. 3b: `<StoreChangeDialog />` after them. `main`'s classes do not change (the bar brings its own spacer) |
| `src/test-setup.ts` | 3a, 3b | `afterEach` also calls `closeCart()` (3a) and `cancelStoreChange()` (3b) |

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
  // token → previous = queryClient.getQueryData<CartView>(cartKey(token))?.storeId   (read before the PUT; undefined while the cart has not loaded)
  //   then api.PUT('/me/cart/items', { body: { storeId, productId: product.id, quantity } }) inside try:
  //   data → await queryClient.cancelQueries({ queryKey: cartKey(token) });
  //          queryClient.setQueryData(cartKey(token), data.replaced ? { ...data, replacedStoreId: previous } : data)
  //     (the whole CartUpdate: its `items` and `storeId` are the truth, whatever was sent; the drawer and bar read `clamped`,
  //      `replaced` and `replacedStoreId`: core does not say where a replaced cart was, so the site keeps the id it held,
  //      Decision 15; the cancel keeps a GET still in flight from overwriting the answer)
  //   error or throw → queryClient.invalidateQueries({ queryKey: cartKey(token) })
  // Never derive the cart from the request or from the flags: no "clamped means the line is there at a lower count",
  // no "I sent store B so the cart is at B".
export async function clearCart(): Promise<ApiError | undefined>
  // no token → clearGuestCart(); undefined
  // token → error = await call(() => api.DELETE('/me/cart')); on success setQueryData(cartKey(token), cartView(emptyCart)); return error
export async function mergeGuestCart(): Promise<void>
  // token = getToken(); bodies = mergeBodies(getGuestCart()); nothing to do without both
  // before = await queryClient.fetchQuery(cartOptions(token)).catch(() => undefined)   (where the server cart is, for the replaced notice)
  // for each body in order: await call(...) capturing data (like auth.ts openSession);
  //   answered → clamped ||= data.clamped; replaced ||= data.replaced; last = data;   error → failed = true (keep going)
  // then clearGuestCart(); await queryClient.cancelQueries({ queryKey: cartKey(token) });
  //   last && !failed ? setQueryData(cartKey(token), { ...last, clamped, replaced, ...(replaced ? { replacedStoreId: before?.storeId } : {}) })
  //                   : invalidateQueries({ queryKey: cartKey(token) })
  // `last` is the cart whatever each push did (set, clamped, clamped away, replaced, or left at another store): show it as it is.
```
#### Write queue (task 2b; Decision 6)
```ts
// `${storeId}:${productId}` → the last quantity asked for that line, while its write is queued or in flight
const asked = new Map<string, { quantity: number; turn: number }>()
let turn = 0
let chain: Promise<unknown> = Promise.resolve()
// listeners + notify, as in session.ts
function queued<T>(work: () => Promise<T>): Promise<T>   // const run = chain.then(work); chain = run.catch(() => {}); return run
export function useAsked(storeId: string | undefined, productId: string): number | undefined
  // useSyncExternalStore(subscribe, () => asked.get(`${storeId}:${productId}`)?.quantity)   (a number or undefined: a stable snapshot)
```
- `setLine` with a token: `const mine = ++turn; asked.set(key, { quantity, turn: mine }); notify()` synchronously, then `return queued(async () => { try { ... } finally { if (asked.get(key)?.turn === mine) { asked.delete(key); notify() } } })`. Inside the `try`, first `if (asked.get(key)?.turn !== mine || getToken() !== token) return` (a later tap on this line has overtaken this write, or the session changed while it waited), then the body above unchanged: `previous` is read here, inside the turn, so it sees every earlier answer. The guest branch is untouched (the reducer is synchronous).
- `clearCart` with a token and `mergeGuestCart`: the existing body wrapped in `queued(...)`, so every write to the cart cache happens in the order it was asked for and answers cannot land out of order.
- `useCartQuantity`: `quantity = useAsked(storeId, product.id) ?? <the cached count as above>`. The drawer's line does the same with `view.storeId` (task 3).
- Turn numbers, not quantities, decide "overtaken" and "mine": taps 2, 3, 2 must still send the last 2 if the first 2 failed.

The server `CartView` is core's `Cart` (or `CartUpdate`) as answered; it is assignable to `CartView` because `StoreProduct` is assignable to `CartProduct`. If the generated types disagree, the worker stops and reports.

### `src/auth.ts` (task 2)
`openSession`: after `startSession(opened.session)`, `await mergeGuestCart()`; then return `undefined`. Navigation (in the routes) happens after `signIn`/`register` resolve, so Home renders the merged cart.

### `src/cart-drawer.tsx` (task 3a; `ReplacedNotice` and its two places are 3b)
Rules for everything in this file: it is mounted in `__root.tsx`, outside `StoreGate`, and keeps no cart state in component state (the open flag is a module store, counts come from `useCart` and `useAsked`); `StoreGate` and the pages check `error` before `data`, so anything under the gate can remount after a failed background refetch. The drawer, the bar and the header button hold no link to `/p/...` (a line's name is plain text): `e2e/browse.spec.ts` counts the links in "Picked for you" (12) and `a[href^="/p/"]` on category and search.
- Open store: module `let open = false`, listeners, `openCart()`, `closeCart()`, `useCartOpen()` (same pattern as `pincode.ts`).
- `countLabel(n)`: `n === 1 ? '1 item' : `${n} items``.
- `CartSheet()`: `<Sheet open={useCartOpen()} onClose={closeCart} title="Your cart">`; body `<div className="flex flex-col gap-4">`:
  | State (first match wins; `view` before `isError`, so a cart already shown stays when a refetch after a failed write fails too) | Shows |
  |---|---|
  | no `view`, `isError` | `ErrorBanner` "Could not load your cart." `onRetry={refetch}` |
  | no `view` otherwise (loading) | `Skeleton variant="list" count={3}` |
  | no items | the clamp notice (below) when `clamped`; `EmptyState icon={ShoppingCart}` "Your cart is empty", "Add products from the store to see them here.", action `Button variant="secondary" onClick={closeCart}` "Continue shopping" |
  | items | the clamp notice when `clamped`; `<ul className="flex flex-col divide-y divide-line">` of lines; summary; nudge; minimum or checkout |

  Replaced notice: `view.replaced` → `<ReplacedNotice storeId={view.replacedStoreId} />`, first in the body of the items state, above the clamp notice (task 3b).

  Opening on a replace (task 3b, D27): `CartSheet`, which is always mounted, also reads the cart and runs `const replacedAnswer = view?.replaced ? view : undefined; useEffect(() => { if (replacedAnswer) openCart() }, [replacedAnswer])`. The dependency is the cached answer object itself, which changes only when a new answer is cached: the effect fires once per replace, not on re-renders, not after the customer closes the drawer (same object), not for a guest (`replaced` is never set there) and not after a reload (the cache starts empty). No media query: one rule at every width. It lives here, not in `setLine` or `mergeGuestCart`, so `cart.ts` does not import the drawer (which imports `cart.ts`).

  Clamp notice: `view.clamped` → `StatusMessage tone="warning"` "Some quantities were lowered to what the store has.", first in the body in both states (core answers an empty cart with `clamped: true` when the only line was cut to 0).
  - Line `<li className="flex items-center gap-3 py-3">`: `<div className="w-14 shrink-0"><ImageTile src={product.imageUrl} /></div>`, `<div className="min-w-0 flex-1"><p className="text-body font-semibold text-ink">{name}</p><p className="text-small text-ink-muted">{unitLabel}</p><Price cents={priceCents} mrpCents={mrpCents} /></div>`, then `<Stepper value={useAsked(storeId, product.id) ?? quantity} max={maxQuantity(product)} label={name} onChange={(n) => void setLine(storeId, product, n)} />` (the line is its own component, `CartLineRow`, so it can call the hook; without `useAsked` two quick taps in the drawer send the same quantity twice, as on the card) and, when `maxQuantity(product) === 0`, `<Button variant="ghost-danger" aria-label={`Remove ${name}`} onClick={() => void setLine(storeId, product, 0)}>Remove</Button>`. `storeId` is `view.storeId` (a cart with lines has one), never the resolved store's: the drawer edits the cart where it is, so its `PUT`s never trigger a replace, and a removal (0) always names the cart's own store, which exists. A line whose quantity is above its `maxQuantity` (stock fell since) shows that quantity with "Add one" disabled.
  - Summary `<dl className="flex flex-col gap-2 text-body text-ink">`, rows `<div className="flex justify-between"><dt>…</dt><dd>…</dd></div>`: "Subtotal" `Price`; "Delivery fee" `Price` or `<span className="font-semibold text-accent">Free</span>` when `deliveryFeeCents === 0`; "Total" `Price` (row `font-semibold`).
  - Nudge: `shortfallCents > 0` → `StatusMessage` "Add {formatInr(shortfallCents)} more for free delivery".
  - Minimum: `subtotalCents < minOrderCents` → `StatusMessage tone="warning"` "Minimum order is {formatInr(min)}. Add {formatInr(min − subtotal)} more to check out." and `Button size="lg" className="w-full" disabled` "Proceed to checkout". Else signed in → `ButtonLink size="lg" className="w-full" href="/checkout" onClick={closeCart}`; signed out → `RouterButtonLink size="lg" className="w-full" to="/sign-in" search={{ returnTo: '/checkout' }} onClick={closeCart}` (`createLink(ButtonLink)` as in `account-link.tsx`).
- `storeKey = (id: string) => ['store', id] as const`; `ReplacedNotice({ storeId }: { storeId?: string })`: `name = useQuery({ queryKey: storeKey(storeId ?? ''), enabled: !!storeId, staleTime: 60_000, queryFn: GET /stores/{id} → data (throw on error) }).data?.name`; renders `<StatusMessage tone="warning">Your cart from {name ?? 'another store'} was replaced. A cart holds products from one store.</StatusMessage>` (`role="status"` comes with the component; no new recipe). Pending, failed or no id all read "another store".
- `CartBar()`: nothing while `itemCount(view) === 0`; else a fragment of a spacer and the bar: `<div aria-hidden className="h-24 sm:hidden" />` (in the page flow after `main`, so the last row, "Load more" and any Stepper scroll clear of the fixed bar; only while the bar shows) and `<aside aria-label="Cart summary" className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2 bg-surface px-4 py-3 shadow-sheet sm:hidden"><div className="flex items-center justify-between gap-3"><div className="flex flex-col"><span className="text-body font-semibold text-ink">{countLabel}</span><Price cents={totalCents} /></div><Button aria-haspopup="dialog" onClick={openCart}>View cart</Button></div></aside>`. Task 3b puts `{view.replaced && <ReplacedNotice storeId={view.replacedStoreId} />}` first inside the `aside` and makes the spacer `h-40` while it shows.
- `CartButton()`: `<Button variant="secondary" aria-haspopup="dialog" className="max-sm:hidden" onClick={openCart}><ShoppingCart size={16} aria-hidden />{count === 0 ? 'Cart' : <><span>{countLabel}</span>{' '}<span className="tabular-nums">{formatInr(totalCents)}</span></>}</Button>` (name "Cart" or "2 items ₹79"; `formatInr`, not `Price`, so the button keeps one text colour).

### `src/catalog.ts` (task 3b)
```ts
export function serviceabilityOptions(pincode: string)   // queryOptions({ queryKey: keys.serviceability(pincode), staleTime, queryFn: <the body useServiceability has today, unchanged> })
export function useServiceability(pincode: string | undefined)   // useQuery({ ...serviceabilityOptions(pincode ?? ''), enabled: !!pincode })
```
Nothing else in the file changes; `catalog.test.ts` and every page stay green untouched.

### `src/store-change.tsx` (task 3b)
```ts
type Pending = { pincode: string; store: Store }
// module store: let pending: Pending | undefined; listeners; usePending()   (not component state: Decision 10)
export async function changePincode(next: string): Promise<void>
  // token = getToken()
  // no token: cart = getGuestCart(); no lines → setPincode(next); return      (synchronous: nothing awaited before it, so web-P2-L1's sheet tests see the pincode at once)
  // token:    cart = await queryClient.fetchQuery(cartOptions(token))          (fetch failure → setPincode(next); return)
  // !cart.storeId || cart.items.length === 0 → setPincode(next); return
  // store = await queryClient.fetchQuery(serviceabilityOptions(next))          (failure → setPincode(next); return)
  // !store || store.id === cart.storeId → setPincode(next); return             (560034 and 560095 are both Koramangala: only the answer tells)
  // closePincodeSheet(); pending = { pincode: next, store }; notify
export function cancelStoreChange(): void   // pending = undefined; notify   (Cancel, Escape, and test-setup's afterEach)
export function StoreChangeDialog()
  // <Dialog open={!!pending} onClose={cancelStoreChange} title="Change store?">
  //   <p className="mt-2 text-body text-ink">{store.name} delivers to {pincode}. Your cart holds products from another store and will be emptied.</p>
  //   error && <ErrorBanner className="mt-4" message="Could not empty your cart." />
  //   <DialogFooter onCancel={cancelStoreChange}><Button loading={busy} onClick={confirm}>Empty cart and change</Button></DialogFooter>
  // confirm: busy; error = await clearCart(); error → show it, keep pending; else setPincode(pincode), pending = undefined
  // `busy` and `error` live in an inner component rendered only while pending (as PincodeForm is inside its Sheet), so each opening starts clean
```

### `src/pincode-sheet.tsx` (task 3b)
`PincodeForm`'s `onSubmit`, after the pattern check: `setBusy(true); void changePincode(value).finally(() => setBusy(false))`, and the submit `Button` gets `loading={busy}`. `setPincode` is no longer imported here; `changePincode` is now its only app caller besides `StoreChangeDialog`'s confirm. The sheet closes through `setPincode` or `closePincodeSheet` inside `changePincode`, as before.

## Decisions
1. **One cart shape, two backends.** Guest totals are computed in the browser with core's formula from the resolved `Store`, so the drawer, bar and button read one `CartView` whatever the backend. Ceiling: guest totals use the price snapshot taken when the line was set (a repriced or emptied product shows its old price and stock until sign-in, when core recomputes everything); core changing its fee rule means changing `cartView` too.
2. **Guest product snapshots are not refreshed.** The guest line keeps the `StoreProduct` it was set with; refreshing would mean a request per line or a by-ids route core does not have. Consequence: an out-of-stock line in practice only appears in a server cart; the merge at sign-in clamps stale guest lines to real stock.
3. **Set, not add, everywhere.** The reducer, the server and the merge all set absolute quantities (core's semantics). At sign-in the guest quantity wins per line; server lines the guest cart does not name stay when both carts are at the same store; when the guest cart is at another store, the first push that store has stock for replaces the server cart (core `replaced: true`); a push it has none of leaves the server cart alone (`clamped: true, replaced: false`), so if the store has none of any guest line the customer keeps the old server cart at its old store and the guest cart is still discarded (Decision 4). The merge needs no branch for any of this: it pushes every line and shows the last answer. That is the reading of "pushed to the server with `PUT /me/cart/items` per line" (Spec 2 §7).
4. **The guest cart is discarded after the merge even if a push failed** (orchestrator, D13). After a failed push the cache is refetched instead of set, because a request that timed out may still have been applied. Ceiling: lines whose push failed (network, or 400 for a product deactivated since) are lost; a guest cart is cheap to rebuild and a half-merged local cart would be invisible once signed in. A merge that never started is different: when the session changed while it waited in the write queue (signed out, or another account), it sends nothing and leaves the guest cart as it is (confirmed after the task 2b review). D13's discard is about lines that were offered to core; these were not, the pushes would have gone to the wrong session, and the cart shows again as the guest's and merges at the next sign-in.
5. **Stepper maximum is the displayed stock** (`quantity`, at most 10 by D7), with the 20-per-line cap as a guard. Lifting it to 20 for "10+" products would change web-P2-L1's card requirement ("maximum is its quantity"), so it stays (orchestrator, D13: no raise to 20). Ceiling: a customer cannot put more than 10 of one product in the cart even when the store holds more.
6. **A Stepper shows what was asked at once; the cart moves when core answers (rewritten after the task 2 review).** The first cut had no optimistic state at all, on the reasoning that a second click inside a round trip would only repeat the first. That was wrong: the `Stepper` computes `value ± 1` from its `value` prop, so with the value coming from the cache two quick taps on "Add one" sent 2 and 2 (a tap lost), and "Add one, Add one, Remove one" sent 2, 2, 0 and removed the line; two answers could also land out of order and leave the older cart in the cache. A quick double tap is ordinary use on a phone, so: (a) while a write for a line is queued or in flight, its Stepper shows the last quantity asked for (`asked`), so each tap counts from the one before and stops at `max`; (b) every server write (`setLine`, `clearCart`, the merge) runs through one promise chain, one at a time in the order asked, so answers land in order and the cache ends on core's latest; (c) a queued write a later tap on the same line has overtaken is skipped (quantities are absolute, the latest wins), so a burst costs at most two requests per line; (d) when the line's last write settles, `asked` is dropped and the Stepper shows the cache again: the answer's count on success (a clamp shows here), the old count after a failure (the cache is refetched). What stays not optimistic, and why: lines, subtotal, fee, the bar and the header count move only with core's answer, because only core knows the price, the clamp and whether the cart was replaced; guessing them would mean a second totals path and a rollback. Ceilings: the bar and the totals trail the Stepper by a round trip (longer behind a queue on a slow network: one chain for the whole cart, since every answer is the whole cart); a failed write snaps the Stepper back with no message (the drawer shows "Could not load your cart." only if the refetch fails too); a page closed mid-queue loses the writes not yet sent; `asked` is per page, another tab sees the change at its next read. Upgrade path if any of these is reported: TanStack `useMutation` with `onMutate` on the whole cart.
7. **The clamp notice rides on the cached `CartUpdate`.** `setLine` stores the whole `PUT` answer, so `clamped` is in the cache until the next answer or a refetch; no extra state. The merge sets `clamped` when any push clamped. The flag only switches the notice on: nothing else is derived from it, since core also sets it when it left a cart at another store untouched. The copy stays true there too (the asked line was lowered to 0).
8. **Store change is intercepted before the pincode is stored.** `changePincode` resolves the new pincode first (`queryClient.fetchQuery(serviceabilityOptions(next))`, the same key the pages read, so the lookup is made once), and only asks when the answer's store differs from the cart's and the cart has lines. It cannot compare pincodes: two pincodes can be one store (560034 and 560095). A not-serviceable pincode or a failed lookup stores the pincode at once and leaves the cart alone (the page shows its notice; the cart still names the old store until the next change). The pincode sheet closes before the dialog opens, so two modals never trap focus at once. `setPincode` had one app caller, `PincodeForm`; it now calls `changePincode`, which is the only way a customer's pincode changes. Ceilings: the sheet's button spins for the two lookups; the cart read for the comparison is not queued behind pending writes, so a tap still in flight when the pincode is saved is not counted.
9. **Confirming uses `DELETE /me/cart`** (orchestrator, D13), not the implicit replace on the next add, because Spec 2 §7 says the cart is cleared after the confirm, and because core's replace is no longer certain: an add the new store has no stock for leaves the old cart standing.
10. **Drawer and store-change state are module stores** like `pincode.ts`'s sheet flag, because the banner button, the bottom bar and the sheet live in different parts of `__root.tsx`, and because nothing about the cart may live in component state under `StoreGate`: the gate and the pages check `error` before `data`, so a failed background refetch unmounts and remounts the page (web-P2-L1's finding). `CartSheet`, `CartBar`, `CartButton` and `StoreChangeDialog` are mounted in `__root.tsx`, outside the gate; the only component state is the dialog's and the sheet form's `busy`/`error`, both outside it too.
11. **`/checkout` is a plain `ButtonLink href`** (full page load) while the route does not exist: a router `Link` to an unregistered path does not type-check. web-P2-L4 switches it to `RouterButtonLink to="/checkout"` when it adds the route (`ponytail:` comment in the file). Signed out, the link goes to `/sign-in?returnTo=%2Fcheckout`; until web-P2-L4 lands, signing in from there lands on "Page not found" (accepted, orchestrator D13).
12. **Bar and header button both render; CSS picks one** (`sm:hidden` on the bar, `max-sm:hidden` on the header button: `Button`'s base class is `inline-flex`, and in the built stylesheet a base-level `hidden` loses to it, so `hidden sm:inline-flex` would have shown the button on phone; landed in 3a and checked by the reviewer in the built CSS). The bar brings a spacer of its own height into the page flow (`h-24`, `h-40` with the replaced notice), only while it shows, so the fixed bar never covers the last row, "Load more" or a Stepper, and an empty cart leaves no gap; `main` is untouched. Ceilings: the bar also shows on `/checkout` until web-P2-L4 hides it there; the spacer heights are fixed, so a notice that wraps to three lines on a narrow phone can overlap the last row by a line.
13. **Vitest without HTTP mocks.** Server carts are seeded with `setToken('t')` and `queryClient.setQueryData(cartKey('t'), cart)` (`staleTime` 60 s, no refetch); "core unreachable" is the relative `baseUrl` failing under jsdom (as in web-P2-L1). Everything that needs core's answers (merge, clamp, removal, `DELETE`) has a Playwright test. Test ceilings, verified by reading only: `clearCart`'s session guard (a `DELETE` dropped when the session changed while it waited; under jsdom the `DELETE` fails anyway, so nothing observable differs); a successful `clearCart` setting the empty cart in the cache is proven only by e2e "store change against core".
14. **E2e customers are fresh** (registered through `page.request.post('/api/core/v1/auth/register')` with a unique email, token put in `localStorage` by `addInitScript` where the test does not sign in through the UI), so tests never share a server cart with each other or with web-P2-L2's demo-customer tests. The clamp test changes stock with the seeded admin (`admin@shopperstop.local` / `admin12345`) on a product it picks from `GET /stores/{id}/products?pageSize=100` (the last with `inStock` true and `quantity` 10, not `banana-robusta`, which other suites open) and restores it in `finally`. `StoreProduct.quantity` is capped at 10, so the value to restore is the real one, read first from `GET /admin/stores/{id}/stock?q=<name>` (`items[].quantity`); stock is written with `PUT /admin/stores/{id}/stock` `{rows: [{productId, quantity}]}` (204).
15. **A cart at another store than the resolved one is shown as it is, counts for nothing on the cards, and is replaced with a notice, not a confirm (PLAN.md D27).** It happens without a store change in this browser: signing in where the server cart was filled under another pincode (no guest lines, or core kept the old cart because the new store had none of them, Decision 3), or another device. Product ids are the same at every store, so `useCartQuantity` matches a line only while `view.storeId` is the resolved store's; without that a card would show the other store's count, "Add one" would send that count plus one to the resolved store, and "Remove one" to 0 would be a no-op at core. The bar, the header button and the drawer still show the cart, and the drawer edits it at its own store. Choosing ADD on a card, or the merge at sign-in, then sends a positive quantity at the resolved store and core replaces the old cart (`replaced: true`): nothing is asked first, and when the answer lands the cart drawer opens by itself, at every width (manager, within D27: the notice must be seen and announced on desktop too, where the bar is hidden), and the drawer and the bar show `ReplacedNotice` until the next cart change or reload (it rides on the cached answer like the clamp notice, Decision 7). "Change store?" stays for the customer's own pincode change only (Decision 8).
    - **Naming the store.** The contract gives the client the old cart's `storeId` only before the change (`Cart.storeId` from `GET /me/cart`); `CartUpdate` carries the new `storeId` and `replaced`, not the old id and no name. So task 2 keeps the id it held (`replacedStoreId`: the cached cart's in `setLine`, a read before the pushes in the merge) and task 3 asks the public `GET /stores/{id}` for the name. No core change.
    - **Ceilings.** The replaced lines are not recoverable: core has deleted them and the site keeps no copy. The notice reads "another store" when the cart had not loaded before the change, the read before the merge failed, or the name lookup is pending or failed. The drawer opens over whatever the customer was doing: in the middle of browsing after a tap on ADD, or on arriving at Home after a sign-in whose merge replaced a cart; one Close (or Escape) returns them, and it does not reopen for that answer. It opens once per answer, so a customer who closes it without reading sees the notice again only in the bar (phone) or by opening the drawer. The guest cart's own replace (a guest line at another store, reachable only after a pincode whose lookup failed or was not serviceable) shows no notice: the reducer has no flag; add one if it is ever reported.
16. **Task 3 is two tasks, 3a then 3b, and what it does not add.** 3a is everything that shows the cart (drawer, bar, header button, clamp notice, quick taps in the drawer); 3b is everything about another store (store-change confirm, replaced notice). 3b edits three places 3a wrote (`ReplacedNotice` into `CartSheet` and `CartBar`, the dialog into `__root.tsx`), so the order is strict. The product page (`/p/$slug`) is the second call site of `useCartQuantity`; it gets no scenario of its own because the hook is the single source of the count for it and the card, and e2e "server cart clamps above stock" drives the Stepper on the product page ("Add one" there, the count read there), which is the one place a second call site could differ. Folded in by the manager, outside this change's delta: `e2e/browse.spec.ts` › "product pages against core" also opens `/p/no-such-product` and expects the level-1 heading "Product not found" and no axe violations; it is an e2e proof of web-P2-L1's scenario "Unknown product", which no test had core answer 404 for.
17. **3a as landed (so the archive is truthful).** Differences from this file as it stood when 3a was briefed, all kept: (a) the header button's class is `max-sm:hidden` (Decision 12); (b) the drawer's empty state is `!view.storeId || view.items.length === 0`, which also gives the line rows a `storeId` that is a string; (c) there is a third commit between red and feat, `test: drawer tests wait for the router's shell`: a harness fix (the drawer tests awaited nothing before opening the drawer), no behaviour; (d) the clamp e2e reads the admin stock list as `GET /admin/stores/{id}/stock?q=<name>&pageSize=100`, so a name that matches several products still returns its row; (e) the open flag's hook `useCartOpen` is not exported (nothing outside the file needs it). Ceiling noticed in 3a and accepted: a drawer line whose pending count goes to 0 ("Remove one" from 1) shows the Stepper's ADD button until core answers, then the row goes; the same as a card, and choosing ADD meanwhile simply asks for 1 again.

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
| Guest taps each count | `src/cart.test.tsx` › "guest taps each count" (pin: passes on arrival) | 2b |
| Quick taps each count | `src/cart.test.tsx` › "quick taps each count" | 2b |
| Failed write returns to the cart's count | `src/cart.test.tsx` › "failed write returns to the cart's count" | 2b |
| Quick taps against core | `e2e/cart.spec.ts` › "quick taps against core" | 2b |
| Quick taps in the drawer | `src/cart-drawer.test.tsx` › "quick taps in the drawer" | 3a |
| Guest cart discarded after merge | `src/cart.test.tsx` › "guest cart discarded after merge" | 2 |
| Merge dropped when the session changed | `src/cart.test.tsx` › "merge queued behind a session change leaves the guest cart" | 2b (landed) |
| Guest cart merges against core | `e2e/cart.spec.ts` › "guest cart merges against core" | 2 |
| Drawer lines and totals | `src/cart-drawer.test.tsx` › "drawer lines and totals" | 3a |
| Free delivery | `src/cart-drawer.test.tsx` › "free delivery" | 3a |
| Checkout link signed in and out | `src/cart-drawer.test.tsx` › "checkout link signed in and out" | 3a |
| Out-of-stock line | `src/cart-drawer.test.tsx` › "out-of-stock line" | 3a |
| Empty, loading and failed cart | `src/cart-drawer.test.tsx` › "empty, loading and failed cart" | 3a |
| Below the minimum order | `src/cart-drawer.test.tsx` › "below the minimum order" | 3a |
| Bar and header follow the cart | `src/cart-drawer.test.tsx` › "bar and header follow the cart" | 3a |
| Server cart clamps above stock | `e2e/cart.spec.ts` › "server cart clamps above stock" | 3a |
| Line clamped away | `src/cart-drawer.test.tsx` › "line clamped away" | 3a |
| Replaced notice names the old store | `src/cart-drawer.test.tsx` › "replaced notice names the old store" | 3b |
| Replace opens the drawer once | `src/cart-drawer.test.tsx` › "replace opens the drawer once" | 3b |
| Replaced notice without the old store | `src/cart-drawer.test.tsx` › "replaced notice without the old store" | 3b |
| Replaced notice against core | `e2e/cart.spec.ts` › "replaced notice against core" | 3b |
| Merge replaces another store's cart | `e2e/cart.spec.ts` › "merge replaces another store's cart" | 3b |
| Cart drawer against core | `e2e/cart.spec.ts` › "cart drawer against core" | 3a |
| Same store or empty cart | `src/store-change.test.tsx` › "same store or empty cart" | 3b |
| Store change against core | `e2e/cart.spec.ts` › "store change against core" | 3b |
| Store change confirmed | `src/store-change.test.tsx` › "store change confirmed" | 3b |
| Store change cancelled | `src/store-change.test.tsx` › "store change cancelled" | 3b |
| Emptying the server cart fails | `src/store-change.test.tsx` › "emptying the server cart fails" |3b |

## Test strategy
- `guest-cart.test.ts`: reducer and `cartView` as plain functions; module-load scenarios use `vi.resetModules()` and `await import('./guest-cart')` like `session.test.ts`; blocked storage spies on `Storage.prototype` (`getItem`, `setItem`, `removeItem` throwing) like it. Builders: a local `p(overrides)` returning a `CartProduct` (no generated types in task 1).
- `cart.test.tsx`, `cart-drawer.test.tsx`, `store-change.test.tsx`: web-P2-L1's `test-data.ts` (`store()`, `product()`, `renderAt`, `renderInRouter`); a store is resolved with `setPincode('560034')` and `queryClient.setQueryData(keys.serviceability('560034'), store())`; a server cart with `setToken('t')` and `queryClient.setQueryData(cartKey('t'), cart)` (a full `Cart`: `storeId` the resolved store's unless the test is about another store; "line clamped away" seeds `{ ...cartView(emptyCart), clamped: true }`); a guest cart with `dispatchGuest`. The replaced notice is seeded as `{ ...cart, replaced: true, clamped: false, replacedStoreId: '...0401' }` with `queryClient.setQueryData(storeKey('...0401'), store())` for the name, and without `replacedStoreId` for "another store"; "Replace opens the drawer once" needs no HTTP: after `renderAt('/')` with a seeded cart and no dialog, `act(() => queryClient.setQueryData(cartKey('t'), { ...cart, replaced: true, clamped: false }))` and the dialog "Your cart" appears; "Close" removes it; a second `setQueryData` with `replaced: false` leaves it closed. That the flag really arrives from `setLine` and from the merge is proven by e2e "replaced notice against core" and "merge replaces another store's cart", where nothing opens the drawer but the answer. The two notice tests no longer call `openCart()`: the seeded replaced answer opens it. Pin for the 3a review, green on arrival: "clamp notice above the lines" (a cart with a line and `clamped: true`: the notice's `compareDocumentPosition` with the dialog's list says it precedes it). jsdom ignores `sm:hidden`, so the bar and the open drawer both hold it: query inside `getByRole('complementary', { name: 'Cart summary' })` and inside the dialog. `test-data.ts`'s `store()` has `freeDeliveryAboveCents` 0 and `minOrderCents` 0: tests about fees pass the overrides. The drawer is opened with `openCart()` (or the "View cart" button) after `renderAt('/')`; `test-setup.ts` closes it and cancels a pending store change after each test. "Quick taps in the drawer" is `cart.test.tsx` › "quick taps each count" inside the dialog: `fireEvent.click` twice on the dialog's "Add one Amul Taaza" with no `await`, the dialog's group reads 3, then `waitFor` it back at 1 so no write is still queued. Store change: the second store is seeded with `keys.serviceability('560038')` → `store({ id: '...0402', name: 'Indiranagar', promisedMinutes: 12 })`, the same store under another pincode with `keys.serviceability('560095')` → `store()`, and `await changePincode(...)` is called directly after `renderAt('/')`; web-P2-L1's `pincode-sheet.test.tsx` must stay green untouched (its saves run with an empty guest cart, which `changePincode` stores synchronously). "Emptying the server cart fails" needs no setup beyond a seeded server cart: under jsdom the `DELETE` cannot reach core.
- Quick taps (task 2b). Vitest reaches what the Stepper shows, not what is sent: with `setToken('t')` and a seeded cart of 1, `fireEvent.click` (synchronous, no `await` between taps; `userEvent` awaits and lets the failing request settle) on "Add one", "Add one", "Remove one", reading the group after each tap: 2, 3, 2. Under jsdom every `PUT` fails (relative `baseUrl`), the refetch fails too and the query keeps its data, so the group then returns to 1: that is "failed write returns to the cart's count", and both tests end on `await waitFor(...)` for that 1 so no write is still queued when the test ends. That the writes go out in order, that the last quantity wins and that the cache ends on core's latest answer is proven only by e2e "quick taps against core": a fresh signed-in customer (token by `addInitScript`), `page.route('**/api/core/v1/me/cart/items', ...)` that only delays (`setTimeout` 600 ms for the first request, none after, then `route.continue()`: real core answers, nothing is stubbed), four clicks without waiting for the count in between, then `expect(quantityOf(page, name)).toHaveText('2')`, `expect.poll` on `GET /me/cart` with the token for quantity 2, reload, 2 again. Without the queue the held-back first answer lands last and the card ends on 1.
- "Loading" is asserted synchronously right after rendering with a token and no seeded cart (the jsdom request fails only after the first render); "failed" with `findByRole('alert')` afterwards.
- `Price` renders a struck MRP as "MRP ₹29": match totals by the `dd` next to each `dt`, not by bare text.
- e2e (`e2e/cart.spec.ts`): pincode via `addInitScript` storing `560034` (and the token when the test starts signed in); product Steppers found by role names (`/^Add /` on Home's "Picked for you" cards, then "Add one <name>"); inside the open drawer, queries are scoped to `page.getByRole('dialog', { name: 'Your cart' })` because the cards behind it carry the same names; `new AxeBuilder({ page }).analyze()` → `[]` on every page, open sheet and dialog. The phone test uses `test.use({ viewport: { width: 390, height: 844 } })` in its own `describe`. The demo stock has low counts (1 to 4, one product in 15): a test that sets a product to 2 takes its names from `GET /api/core/v1/stores/00000000-0000-4000-8000-000000000401/products?pageSize=24` (`inStock` and `quantity >= 2`, the first two; "Picked for you" is the first 12 in stock of that page), not the first cards blindly. The two replaced-notice tests give a fresh customer a cart at Koramangala with `page.request.put('/api/core/v1/me/cart/items', { headers: { Authorization }, data: { storeId: '...0401', productId: '00000000-0000-4000-8000-000000000601', quantity: 1 } })` (that product has stock at both stores); "replaced notice against core" waits for the bar's "1 item" (the cart has loaded, so the site knows where it is) before choosing "Add". Reuse the helpers already in `e2e/cart.spec.ts` (`freshEmail`, `homePicks`, `twoPicks`, `quantityOf`) and its `beforeEach` pincode; a test at another pincode adds its own `addInitScript` after it. The clamp test's product is the last of `GET /stores/{id}/products?pageSize=100` with `inStock` and `quantity` 10: past the first 24 (so no Home pick of another test) and after the first naturally out-of-stock product by name (which `browse.spec.ts` › "product pages against core" opens), so emptying it for a moment touches no other test even with spec files running in parallel.

## Risks / Trade-offs
- [The merged browsing code differs from this file in a name] → design.md was re-read against the branch on 2026-10-13 (web-P2-L1 merged, #119); a worker who still finds a difference follows the code and notes it in the lane log; a behaviour difference stops them.
- [The site infers the cart from what it sent] → it never does: every `PUT` answer is cached whole, and the card matches on the answer's `storeId` (Decision 15); "card ignores a cart at another store" and "line clamped away" pin it.
- [web-P2-L1's `product-card.test.tsx` › "add shows the count" renders a card with no resolved store] → with the real hook ADD does nothing there; task 2 adds the store lines to that test (in scope) or web-P2-L1 writes it with them (request in the lane log).
- [3b edits files web-P2-L1 owns: `catalog.ts`, `pincode-sheet.tsx`] → the edits are the two named above and nothing else; `catalog.test.ts`, `pincode-sheet.test.tsx`, `store-gate.test.tsx` and `e2e/browse.spec.ts` must pass unchanged (apart from the folded-in visit).
- [e2e stock edits race other suites] → the clamp test edits one product no other suite names and restores it; `make e2e` runs one suite at a time.
