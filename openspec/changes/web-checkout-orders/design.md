# Design

## Context

Spec 2 §7 rows `/checkout`, `/orders/{id}`, `/orders`; §4 (placement and the status machine); §13 (the customer flow). PLAN.md D7 (customers cancel only while `placed` or `accepted`; shown stock capped at 10), D13, D25 (409 for `not_serviceable` and `out_of_stock` at placement), D27. Lane web-P2-L4, branch `lane/web-P2-L4-checkout-orders`.

Checked on 2026-10-13 against `services/core/openapi.json`, `packages/ui/src/api/core.d.ts`, `openspec/specs/orders` (on `origin/main`) and `services/core/internal/order/place.go`:

- `POST /orders` `OrderCreate {addressId}` → 201 `Order`. Checks run in this order: cart empty → 400 `validation`, message "cart is empty", no `field`; unknown or foreign address → 400 field `addressId`; address pincode not served by the cart's store → 409 `not_serviceable` field `addressId`; store closed → 409 `not_serviceable`, no field; stock → 409 `out_of_stock` with `productIds` (ascending; cart kept); minimum → 400 field `subtotal`; order-number collision → 409 `conflict`. 401 without a customer session.
- `GET /orders?page=&pageSize=` → `OrderList {items: Order[], page, pageSize, total}`, newest first, `pageSize` default 24. `GET /orders/{id}` → `Order`; 404 for unknown, foreign or malformed ids.
- `POST /orders/{id}/cancel` `OrderCancel {reason?}`: a JSON body is required (`{}` is no reason; an empty body is 400). 200 `Order` while `placed` or `accepted`; 409 `conflict` otherwise.
- `Order {id, number, storeId, status, customerName, customerPhone?, address {label, line1, line2?, pincode}, subtotalCents, deliveryFeeCents, totalCents, paymentMethod: "cod", placedAt, deliveredAt?, cancelledAt?, cancelReason?, items [{productId, name, unitLabel, imageUrl?, priceCents, mrpCents, quantity}], events [{fromStatus?, toStatus, actorType, note?, createdAt}]}`. `status` is one of `placed`, `accepted`, `packing`, `ready`, `out_for_delivery`, `delivered`, `cancelled`. Events are oldest first. Times are UTC RFC 3339. The order carries no store name and no promised minutes: both come from `GET /stores/{storeId}` (`Store {id, name, isOpen, deliveryFeeCents, freeDeliveryAboveCents, minOrderCents, promisedMinutes}`, public).
- Demo seed: customer `demo@shopperstop.local` / `demo12345` with "Home" `560034` (default, `...0301`) and "Work" `560038` (`...0302`); orders `...0701` `SS-DEMOAAAB` delivered (six events), `...0702` `SS-DEMOAAAC` cancelled ("Ordered by mistake"), `...0703` `SS-DEMOAAAD` placed; both stores charge 2500, free from 19900, minimum 9900; Koramangala (`...0401`) promises 10 minutes, Indiranagar (`...0402`) 12; 148 products, so `page=2&pageSize=100` holds 48.

Web code this builds on: `src/cart.ts` (`useCart`, `cartKey`, `setLine(storeId, product, quantity)` taking the product object, the write queue `queued`, not exported today), `src/cart-drawer.tsx` (`openCart`, `CartBar`, the `dl` of totals, `storeKey` and the store read inside `ReplacedNotice`), `src/address-dialog.tsx` (`AddressDialog` with a `submit` prop), `src/routes/account.tsx` (`useAddresses`, the add and edit requests inside `AddressesCard`), `src/api.ts` (`call`, `ApiError`, the 401 middleware), `src/product-card.tsx` (`ImageTile`), `src/test-data.ts` (`renderAt`, `renderInRouter`, `refetchFailed`, builders).

## Goals / Non-Goals

Goals: a signed-in customer turns the server cart into a COD order, sees why when core refuses, follows the order to its end, cancels it while core allows, and finds past orders.

Non-goals: online payment; editing quantities on `/checkout` itself (the drawer does it); a cancel reason; checking each address against the store before the customer presses the button; paging the history; reordering; receipts; any `packages/ui` or core change; the cross-app flow with the admin board (web-P2-L5).

## Files (all under `apps/web/`)

| File | Task | What |
|---|---|---|
| `src/addresses.ts` (new) | 1 | `useAddresses` moved from `routes/account.tsx`; `addAddress(values)` |
| `src/routes/account.tsx` | 1, 2 | imports `useAddresses`, `addAddress` (task 1); "Your orders" link in the header (task 2) |
| `src/catalog.ts` | 1 | `keys.store`, `storeOptions(id)`, `useStore(id)` |
| `src/cart-drawer.tsx` | 1 | `ReplacedNotice` reads `useStore`; `storeKey = keys.store` kept as an export; the totals `dl` becomes the exported `Totals`; `CartBar` returns nothing on `/checkout`; "Proceed to checkout" becomes a `RouterButtonLink to="/checkout"` |
| `src/order-parts.tsx` (new) | 1, 2, 4 | `LineRow` (task 1); `StatusBadge` (task 2); `Countdown` (task 4) |
| `src/checkout.tsx` (new) | 1, 3 | `CheckoutPage` |
| `src/routes/checkout.tsx` (new) | 1 | the guard and `<CheckoutPage />` |
| `src/orders.ts` (new) | 2, 3, 4 | types, keys, status vocabulary, reads (task 2); `postOrder`, `placeOrder` (task 3); `pollInterval`, `arrival`, `postCancel`, `cancelOrder` (task 4) |
| `src/cart.ts` | 3 | `queued` exported, nothing else |
| `src/order-tracking.tsx` (new) | 2, 4 | `OrderPage` |
| `src/routes/orders.$id.tsx` (new) | 2 | the guard and `<OrderPage id />` |
| `src/routes/orders.index.tsx` (new) | 2 | the guard and the history |
| `src/routeTree.gen.ts` | 1, 2 | regenerated by the router plugin; committed |
| `src/test-data.ts` | 1, 2 | builders `address()`, `order()` |
| `src/checkout.test.tsx`, `src/orders.test.ts`, `src/order-tracking.test.tsx`, `src/order-history.test.tsx` (new); `src/cart-drawer.test.tsx`, `src/account.test.tsx` (one test each) | 1 to 4 | see Scenario → test |
| `e2e/shopper.ts` (new), `e2e/checkout.spec.ts` (new), `e2e/orders.spec.ts` (new) | 1 to 4 | see e2e |

Nothing outside `apps/web/` and this change folder. No new dependency.

## Interfaces

### `src/addresses.ts` (task 1)

```ts
export type Address = components['schemas']['Address']
export function useAddresses()   // moved verbatim: key ['addresses', token], first page, data = items
// POSTs /me/addresses ({...values, line2: values.line2 || undefined, isDefault: false}), invalidates ['addresses'] on success.
export async function addAddress(values: AddressValues): Promise<{ address?: Address; error?: ApiError }>
```

`routes/account.tsx` keeps its behaviour: its add branch becomes `(await addAddress(values)).error`. Its tests and `e2e/account.spec.ts` stay green untouched.

### `src/catalog.ts` (task 1)

```ts
keys.store: (id: string) => ['store', id] as const
export function storeOptions(id: string)            // GET /stores/{id}, staleTime 60 s, throws on error
export function useStore(id: string | undefined)    // useQuery({ ...storeOptions(id ?? ''), enabled: !!id })
```

### `src/cart-drawer.tsx` (task 1)

- `export function Totals({ subtotalCents, deliveryFeeCents, totalCents }: { subtotalCents: number; deliveryFeeCents: number; totalCents: number })`: the existing `dl` with "Subtotal", "Delivery fee" (or "Free"), "Total", unchanged markup. The drawer, checkout and the order page render it.
- `CartBar`: `const onCheckout = useLocation({ select: (location) => location.pathname }) === '/checkout'` before any return; `if (onCheckout) return null`. The spacer goes with it.
- "Proceed to checkout" signed in: `<RouterButtonLink size="lg" className="w-full" to="/checkout" onClick={closeCart}>`.

### `src/order-parts.tsx`

```tsx
// One read-only line: image tile, name, unit, "Qty n", line total. Cart lines and order items both fit it.
export function LineRow(props: { name: string; unitLabel: string; imageUrl?: string; priceCents: number; quantity: number; children?: ReactNode })
export function StatusBadge({ status }: { status: OrderStatus })   // <Badge variant={statusVariant(status)}>{statusName(status)}</Badge>
export function Countdown({ placedAt, promisedMinutes }: { placedAt: string; promisedMinutes: number })
```

`LineRow` is an `li`: `ImageTile` in a `w-14 shrink-0` box, then name (`text-body font-semibold text-ink`), unit and `Qty {quantity}` (`text-small text-ink-muted`), `children` (the out-of-stock badge and "Remove" at checkout), and `<Price cents={priceCents * quantity} />` on the right. `flex flex-wrap` so the `children` drop under the text at 390 px instead of leaving the card.

`Countdown` holds `now` in state, starts at `Date.now()`, and sets it from `Date.now()` in a one-second `setInterval` cleared on unmount. It renders `<p className="text-h3 text-ink">{arrival(placedAt, promisedMinutes, now)}</p>`. It is not inside the status region: a minute changing must not be announced.

### `src/orders.ts`

```ts
export type Order = components['schemas']['Order']
export type OrderStatus = Order['status']
export type OrderList = components['schemas']['OrderList']
export type OrderResult = { order?: Order; error?: ApiError }

export const ordersKey = (token: string) => ['orders', token] as const
export const orderKey = (token: string, id: string) => ['order', token, id] as const

export function statusName(status: OrderStatus): string
export function statusVariant(status: OrderStatus): BadgeVariant
export function statusMessage(order: Order): string          // the sentence; cancelled adds " Reason: <cancelReason>" when present
export function underWay(status: OrderStatus): boolean        // not delivered, not cancelled
export function canCancel(status: OrderStatus): boolean       // placed or accepted
export function formatWhen(iso: string): string               // Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export function orderOptions(token: string, id: string)      // GET /orders/{id}; 404 → null; task 4 adds refetchInterval
export function useOrder(id: string)                          // enabled while a token is held
export function useOrders()                                   // GET /orders, first page, data = OrderList

// task 3
export async function postOrder(addressId: string): Promise<OrderResult>     // one POST /orders
export const cartEmptied = (error: ApiError) => error.code === 'validation' && !error.field
export function placeOrder(addressId: string, send = postOrder): Promise<OrderResult>

// task 4
export function pollInterval(order: Order | null | undefined): number | false   // 10_000 while underWay, else false
export function arrival(placedAt: string, promisedMinutes: number, now: number): string
export async function postCancel(id: string): Promise<OrderResult>          // POST /orders/{id}/cancel, body {}
export async function cancelOrder(id: string, send = postCancel): Promise<OrderResult>
```

Vocabulary (one table in the file, used by the badge, the history list and the message):

| Status | Name | Badge | Message |
|---|---|---|---|
| `placed` | Placed | `accent` | Order placed. Waiting for the store to accept it. |
| `accepted` | Accepted | `accent` | The store accepted your order. |
| `packing` | Packing | `accent` | Your order is being packed. |
| `ready` | Ready | `accent` | Your order is packed and ready to leave the store. |
| `out_for_delivery` | Out for delivery | `accent` | Your order is out for delivery. |
| `delivered` | Delivered | `success` | Your order was delivered. |
| `cancelled` | Cancelled | `neutral` | This order was cancelled. |

`postOrder` and `postCancel` follow `auth.ts`'s `openSession`: run the request through `call`, keep `result.data`; answer `{ order }`, `{ error }`, or `{ error: { code: 'internal', message: 'Core answered without an order.' } }` when neither came.

`placeOrder`:

```ts
export function placeOrder(addressId: string, send = postOrder): Promise<OrderResult> {
  const token = getToken()
  if (!token) return Promise.resolve({ error: { code: 'unauthorized', message: 'sign in required' } })
  return queued(async () => {                       // after every cart write already asked for
    if (getToken() !== token) return { error: { code: 'unauthorized', message: 'sign in required' } }
    let result = await send(addressId)
    if (result.error?.code === 'conflict') result = await send(addressId)   // order-number collision: once more
    const { order, error } = result
    if (order || (error && cartEmptied(error))) {
      await queryClient.cancelQueries({ queryKey: cartKey(token) })
      queryClient.setQueryData(cartKey(token), cartView(emptyCart))         // core emptied it in the same transaction
      if (order) queryClient.setQueryData(orderKey(token, order.id), order)
      void queryClient.invalidateQueries({ queryKey: ordersKey(token) })
    } else if (error?.field === 'addressId' && error.code === 'validation') {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] })
    } else if (error?.code !== 'not_serviceable') {
      // out_of_stock, subtotal: the lines as they are now. internal: the order may have gone through (Decision 21).
      await queryClient.invalidateQueries({ queryKey: cartKey(token) })
    }
    return result
  })
}
```

`cancelOrder(id, send)`: `const result = await send(id)`; with an order, `setQueryData(orderKey(token, id), order)` and invalidate `ordersKey(token)`; on `conflict`, `await invalidateQueries({ queryKey: orderKey(token, id) })`; return `result`.

`arrival`: `const left = Date.parse(placedAt) + promisedMinutes * 60_000 - now`; `left <= 0` → "Running late. We are getting your order to you."; else `const n = Math.ceil(left / 60_000)` → "Arriving in 1 minute" or `Arriving in ${n} minutes`.

Reads (`orderOptions`, `useOrders`): the 404 case first where there is one, then `if (error || !data) throw error ?? new Error('no answer')`, the shape task 1 landed in `useAddresses` and `storeOptions`.

`orderOptions` in task 4: `refetchInterval: (query) => pollInterval(query.state.data)`. `refetchIntervalInBackground` is not set (TanStack's default is false: no poll while the tab is hidden) and `refetchOnWindowFocus` is not set (default true: one read when the tab comes back). No `staleTime`: every mount reads.

### `src/checkout.tsx`

```tsx
export function CheckoutPage({ send = postOrder }: { send?: typeof postOrder })
```

State: `chosen?: string` (an address id), `busy: boolean`, `refusal?: { message: string; addressId?: string }`, `short: Record<string, number>` (product id → the line's quantity when core refused it), `adding: boolean` (the dialog).

Reads: `useCart()` (the page is behind the guard, so this is the server cart), `useAddresses()`, `useStore(view?.storeId)`.

Order of the branches: `PageHeader title="Checkout"` always; then `view === undefined` → `isError` ? `ErrorBanner "Could not load your cart."` with retry : `Skeleton variant="list"`; `view.items.length === 0` → `Card` with `EmptyState title="Your cart is empty"` and two router links, "Continue shopping" (`to="/"`, primary) and "Your orders" (`to="/orders"`, secondary); else the two cards in `grid gap-6 lg:grid-cols-2`.

Each card is `<Card role="region" aria-labelledby={headingId} className="flex flex-col gap-4 p-4 sm:p-6">` with an `h2` (`useId`): tests and e2e find a card by `getByRole('region', { name })`.

"Delivery address" card: addresses `undefined` → error ? `ErrorBanner "Could not load your addresses."` : `Skeleton`; empty → `EmptyState title="No addresses yet" description="Add one to place the order."` with the "Add address" button; else `ul` of `li` (label as `h3`, a `Badge variant="accent"` "Default" on the default, lines, pincode in `tabular-nums`, `Badge variant="warning"` "Not delivered here" when `refusal?.addressId === address.id`, and `<Chip selected={address.id === selected?.id} aria-label={`Deliver to ${address.label}`} onClick={() => setChosen(address.id)}>Deliver here</Chip>`), then `<Button variant="secondary">Add address</Button>`. `selected = addresses.find(chosen) ?? addresses.find(isDefault) ?? addresses[0]`. The dialog is `<AddressDialog open={adding} onClose=… submit={async (values) => { const { address, error } = await addAddress(values); if (address) setChosen(address.id); return error }} />`.

"Order summary" card: `From {store.name}` and `Delivery in {store.promisedMinutes} minutes` (both omitted while the store is not known); `ul` of `LineRow` per cart line, with, when `short[line.product.id] === line.quantity`, a `Badge variant="danger"` and `<Button variant="ghost-danger" aria-label={`Remove ${name}`} onClick={() => void setLine(view.storeId, line.product, 0)}>Remove</Button>`; `Totals`; a row "Payment" / "Cash on delivery"; the minimum-order `StatusMessage tone="warning"` while `subtotalCents < minOrderCents`; `refusal && <ErrorBanner message={refusal.message} />`; `<Button size="lg" className="w-full" loading={busy} disabled={!selected || belowMinimum} onClick={place}>Place order (COD)</Button>`; `<Button variant="ghost" onClick={openCart}>Edit cart</Button>`.

Badge text of a marked line: `!product.inStock` → "Out of stock"; `product.quantity < line.quantity` → `Only ${product.quantity} left`; else "Not enough stock" (core's stock is short but above the 10 the site is shown, or the cart could not be read again).

`place`:

```ts
setBusy(true); setRefusal(undefined); setShort({})
const { order, error } = await placeOrder(selected.id, send)
if (order) return navigate({ to: '/orders/$id', params: { id: order.id } })
if (!error || cartEmptied(error)) return navigate({ to: '/orders' })
setBusy(false)
if (error.code === 'out_of_stock') {
  const lines = queryClient.getQueryData<CartView>(cartKey(token))?.items ?? []     // after placeOrder read the cart again
  setShort(Object.fromEntries(lines.filter((l) => error.productIds?.includes(l.product.id)).map((l) => [l.product.id, l.quantity])))
}
setRefusal(refusalOf(error, store?.name ?? 'The store', selected.id))
```

`refusalOf` (in `checkout.tsx`): `out_of_stock` → "Some products are not available in the quantity you chose."; `not_serviceable` with `field === 'addressId'` → `${name} does not deliver to this address. Choose another address or add one.` with `addressId`; `not_serviceable` → `${name} is closed right now.`; `field === 'subtotal'` → "Your cart is below the store's minimum order."; else "Could not place your order. Try again.". Core's own messages are never shown: they are lower-case API text.

### `src/order-tracking.tsx`

```tsx
export function OrderPage({ id, send = postCancel }: { id: string; send?: typeof postCancel })
```

`const { data: order, isError, refetch } = useOrder(id)`; `order === undefined` → `PageHeader title="Order"` and error ? `ErrorBanner "Could not load this order."` with retry : `Skeleton`; `order === null` → `PageHeader title="Order not found"` and a `Card` with `EmptyState` and a link "Your orders" to `/orders`; else:

- `<PageHeader className="tabular-nums" title={`Order ${order.number}`} actions={<RouterButtonLink variant="secondary" to="/orders">All orders</RouterButtonLink>} />`
- status card (`Card`, no heading): `<StatusMessage tone={order.status === 'delivered' ? 'success' : 'neutral'}>{statusMessage(order)}</StatusMessage>`, always at the same position in the tree; `underWay(order.status) && store && <Countdown placedAt={order.placedAt} promisedMinutes={store.promisedMinutes} />` (`store` from `useStore(order.storeId)`); `canCancel(order.status) && <Button variant="ghost-danger" onClick={open}>Cancel order</Button>` (task 4).
- region "Status history": `<ol aria-labelledby={headingId}>`, one `li` per event: `statusName(event.toStatus)`, `<time dateTime={event.createdAt}>{formatWhen(event.createdAt)}</time>`, and `event.note` when present.
- region "Items": `ul` of `LineRow` per item, `Totals`, "Payment" / "Cash on delivery".
- region "Delivery address": label, `line1`, `line2` when present, pincode (`tabular-nums`).
- the cancel dialog, rendered outside the `canCancel` condition so it survives the order changing under it: `<Dialog open={confirming} onClose={close} title="Cancel this order?">` with a sentence "Order {number} will be cancelled and nothing will be delivered.", `cancelError && <ErrorBanner message={cancelError} />`, `<DialogFooter onCancel={close} cancelLabel="Keep order">` holding, only while `canCancel(order.status)`, `<Button loading={busy} onClick={confirm}>Cancel order</Button>`.

`confirm`: `const { order: cancelled, error } = await cancelOrder(id, send)`; with an order, close; else `setCancelError(error?.code === 'conflict' ? 'This order can no longer be cancelled.' : 'Could not cancel the order. Try again.')`. Opening the dialog clears `cancelError`.

### Routes

```tsx
// routes/checkout.tsx
function Checkout() {
  const token = useToken()
  if (!token) return <Navigate to="/sign-in" search={{ returnTo: '/checkout' }} replace />
  return <CheckoutPage />
}
```

`routes/orders.$id.tsx`: the same with `returnTo: `/orders/${id}``, `id` from `Route.useParams()`, then `<OrderPage id={id} />`. `routes/orders.index.tsx`: `returnTo: '/orders'`, then the history: `PageHeader title="Your orders"`; `data === undefined` → error ? `ErrorBanner "Could not load your orders."` with retry : `Skeleton variant="list"`; no items → `Card` with `EmptyState title="No orders yet"` and a "Start shopping" link to `/`; else `ul` of `li` each a `Card` (`flex flex-wrap items-center gap-3 p-4`): number (`h2`, `text-h3 tabular-nums`), `StatusBadge`, `<time>` of `placedAt`, the item count ("1 item" / "N items", the sum of quantities), `<Price cents={totalCents} />`, and `<RouterButtonLink variant="secondary" to="/orders/$id" params={{ id }} aria-label={`View order ${number}`}>View order</RouterButtonLink>`; then, when `total > items.length`, `<StatusMessage>Showing your latest {items.length} orders.</StatusMessage>`.

The page components sit outside `src/routes/` because the route files are code-split (`autoCodeSplitting`) and tests render a page with its `send` prop.

## Decisions

1. **After placing.** `placeOrder` puts the answered order under `orderKey` (the tracking page renders at once, then reads again), sets the cart cache to the empty cart, and invalidates the history. Setting the cart rather than invalidating it: core emptied it in the placement transaction, and an invalidation would leave the old count in the bar and header until the read lands. The guest cart is not involved: `/checkout` is behind sign-in and the merge at sign-in already discarded it. Then `navigate` to `/orders/<id>`. Ceiling: product lists keep the pre-order stock for up to 60 s (the catalog's `staleTime`).
2. **Placing waits for the cart.** `placeOrder` runs inside `cart.ts`'s write queue (`queued`, exported by task 3). A Stepper tap in the drawer followed by "Place order (COD)" would otherwise place the old quantity and then write the new one into a fresh cart. The order then holds what the customer last asked for; the tracking page shows it.
3. **Double submit.** The button is busy (disabled) from the press to the answer, so one tab cannot send twice. A second tab, or a press repeated after a lost answer, gets 400 `validation` with no field. The site reads that as "the cart is already empty", sets the cart cache empty and goes to `/orders`, whose first card is the order if there is one. It does not guess which order it was. Ceiling: when the cart was emptied in another tab without an order, the customer lands on the history with no explanation. Matched on `code` and the absent `field`, never on the message text.
4. **409 `conflict`.** Sent once more inside the same queued job; a second `conflict` is shown as "Could not place your order. Try again.". No back-off: a collision is about one in 10^12.
5. **`out_of_stock`.** `productIds` are product ids; a cart line is `line.product.id`. The marks are kept as `{productId: quantity at refusal}` and a line is marked while its quantity is still that one, so lowering it in the drawer, or removing it, clears its mark without a second state machine. "Remove" is `setLine(view.storeId, line.product, 0)`: the cart's store, the product object, through the queue. Ceilings: no "remove all" (one tap per line); no "set to what is left"; a line the cart read already shows as out of stock is marked only after the customer presses the button; the label can only say "Only N left" when core's stock is below the 10 the site is shown (D7).
6. **The store is the cart's.** Everything on `/checkout` reads `view.storeId`; the stored pincode and `StoreGate` play no part, so a customer browsing Indiranagar with a Koramangala cart checks out the Koramangala cart, named as such.
7. **An address the store does not serve** is found by core, not before: the customer chooses, presses, and gets the alert and the "Not delivered here" badge on that address (kept until the next press). Ceiling: with the demo customer and an Indiranagar cart the default address fails on the first press. Upgrade: resolve each address with `serviceabilityOptions(address.pincode)` and disable the ones at another store. Confirmed by the manager.
8. **Address choice is a `Chip` per address** (`aria-pressed`), because `@shopperstop/ui` has no radio or choice-card. Requested from ui without blocking; confirmed by the manager.
9. **Countdown clock.** `Date.now()` is the only clock; `arrival` takes `now` as an argument. Tests fake the clock at the process boundary with `vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })` and `vi.setSystemTime`; no clock module. The promise is `placedAt` plus the store's current `promisedMinutes`. Ceilings: an admin changing the store's promise moves the countdown of open orders (a snapshot on `Order` is not coming in Phase 2, so this ceiling stays); the customer's device clock is trusted; after the promise the text is fixed, with no "N minutes late".
10. **Polling.** `refetchInterval` as a function of the held order: 10 s while under way, off when delivered, cancelled, not found or not yet answered (a first load that fails shows the alert with "Try again" and does not hammer). TanStack keeps the interval running after a failed poll, so the page recovers by itself. Hidden tab: no poll (`refetchIntervalInBackground` left false), one read on return (`refetchOnWindowFocus` left true). The view checks `order === undefined` before `isError` (web-P2-L6's rule), so a failed poll changes nothing on screen. Ceiling: no "last updated" hint while core is unreachable.
11. **Status announced.** The one `StatusMessage` (role `status`) is always rendered at the same place, so a new status changes its text in place and assistive technology reads it. The countdown and the history list are outside it.
12. **Badge variants.** Under way `accent`, delivered `success`, cancelled `neutral`. Cancelled is not `danger`: status colours mean error, caution and success (CLAUDE.md), and a customer's own cancel is none of them. This is PLAN.md D28 (orchestrator, cross-area; admin's board follows it): never `danger` or `warning` for a status, and the badge always carries the status as text. All seven values of core's enum (`placed`, `accepted`, `packing`, `ready`, `out_for_delivery`, `delivered`, `cancelled`, checked in `core.d.ts`) are in the table.
13. **Cancel.** No reason field: the body is `{}`. The dialog's first button is "Keep order" (`cancelLabel`), since "Cancel" beside "Cancel order" reads as the same action. Every failure keeps the dialog open; on 409 the order is read again, the confirm button goes and only "Keep order" is left. Ceiling: the store sees no reason. Confirmed by the manager.
14. **The cart bar is hidden on `/checkout`** (the page has its own total and one primary action); the header cart button stays, and "Edit cart" opens the drawer on phone. On `/orders` and `/orders/<id>` the bar behaves as everywhere (after placing the cart is empty, so there is none).
15. **Checkout does not re-read the cart on entry**; it uses the cart cache (at most 60 s old). Core prices and checks at placement and the order page shows what was charged. Ceiling: a price changed in the last minute shows in the order, not in the summary.
16. **History is the first page of 24**, with "Showing your latest 24 orders." beyond. Cards, not a `Table`: a table row's link is 20 px tall on a phone; a card holds a 44 px button link. Upgrade: "Load more" with `useInfiniteQuery` as the product feed does. Confirmed by the manager.
17. **Links to `/orders`:** the account page's header ("Your orders"), the tracking page ("All orders"), the empty checkout ("Your orders"). None in the banner: it is full at 390 px.
18. **No `docs/design/web-P2-L4.md`**: this file is enough.
19. **Times** are formatted in the browser's zone with `Intl.DateTimeFormat('en-IN', …)` inside `<time dateTime>`. Tests assert `dateTime`, never the formatted text (it depends on the machine's zone).
21. **A failed answer on a write.** Since web-P2-L8 (#152) `src/api.ts` hands on every failed answer without core's envelope as `{ error: { code: 'internal', … } }`, so "no error" on a failed answer no longer happens and no new code guards against it. Two things still apply here. A write is done only when its answer holds the order (or address): `postOrder`, `postCancel` and `addAddress` answer `{ error }` with code `internal` for an ok answer with no body. And `internal` on `POST /orders` (a 502, a timeout, a lost answer) does not prove the order was not placed: the page shows "Could not place your order. Try again." and `placeOrder` reads the cart again. If the order went through, the cart comes back empty and the page turns into "Your cart is empty" with its "Your orders" link; if the read fails too, the old cart stays and a second press is safe, because core answers 400 "cart is empty" and the page goes to `/orders` (Decision 3), where the order is the first card. An order is never placed twice from one cart. Ceiling: the customer is not told "your order may have been placed".
20. **`ink-muted` text only inside a `Card`** (`ink-muted` on `canvas` fails 4.5:1, admin's axe finding). Text straight on the page is `ink` or a `StatusMessage`.

## As landed

Task 1 (`88c9e82`, `e4d6c45`), ruled on by the team lead:

- The empty checkout's "Your orders" link is a plain `<a href="/orders">` with `buttonClass`, because `/orders` was not a route yet and a typed link fails typecheck. Task 2 switches it to the router link and proves the client-side navigation (test "empty checkout links to orders").
- `useAddresses` and `storeOptions` end `if (error || !data) throw …`. Kept.
- `addAddress` awaits the invalidation of `['addresses']` before it answers, so the new address is in the list when the page chooses it. Kept.
- The empty-cart state has no description line. Kept: the two links say what to do.
- `LineRow`'s `children` is unused until task 3 puts the badge and "Remove" there. Kept.

## Scenario → test

Vitest names are the scenario names in lower case. `(pin)` marks a test expected green on arrival.

| Requirement › Scenario | Test | Task |
|---|---|---|
| Require sign-in › Signed-out checkout redirect | `src/checkout.test.tsx` | 1 |
| Require sign-in › Signed-out order pages redirect | `src/order-tracking.test.tsx` | 2 |
| Checkout page › Checkout summary from the cart; Summary names the cart's store | `src/checkout.test.tsx` | 1 |
| Checkout states › Empty, loading and failed checkout | `src/checkout.test.tsx`; plus "empty checkout links to orders" (the router link, no scenario of its own) | 1; 2 |
| Address choice › Default address chosen; Another address chosen; No address yet | `src/checkout.test.tsx` | 1 |
| Address choice › Address added at checkout | `e2e/checkout.spec.ts` | 1 |
| Minimum order › Checkout below the minimum | `src/checkout.test.tsx` | 1 |
| Cart bar (MODIFIED) › No bar on checkout | `src/cart-drawer.test.tsx` | 1 |
| Cart bar (MODIFIED) › the two existing scenarios | existing tests, untouched | - |
| Places an order › Order placed; Order number collision retried once; Cart already empty goes to orders | `src/checkout.test.tsx` | 3 |
| Places an order › Order placed against core | `e2e/checkout.spec.ts` | 3 |
| Out of stock › Out-of-stock lines marked | `src/checkout.test.tsx` | 3 |
| Out of stock › Out of stock at checkout against core | `e2e/checkout.spec.ts` | 3 |
| Refusals › Address not served; Store closed at placement; Placement fails | `src/checkout.test.tsx` | 3 |
| Refusals › Address not served against core | `e2e/checkout.spec.ts` | 3 |
| Tracking page › Tracking shows the order; Unknown order | `src/order-tracking.test.tsx` | 2 |
| Tracking page › Tracking against core | `e2e/orders.spec.ts` | 2 |
| Status names › Status names and badges | `src/orders.test.ts` | 2 |
| Status message › Status change announced; Cancelled order shows the reason | `src/order-tracking.test.tsx` | 2 |
| Tracking poll › Failed poll keeps the order | `src/order-tracking.test.tsx` | 2 |
| Tracking poll › Poll interval follows the status | `src/orders.test.ts` | 4 |
| Tracking poll › Tracking follows the order against core | `e2e/orders.spec.ts` | 4 |
| Countdown › Countdown counts down; Countdown after the promise; No countdown once finished | `src/order-tracking.test.tsx` | 4 |
| Cancel › Cancel offered while placed or accepted; Order cancelled; Cancel refused | `src/order-tracking.test.tsx` | 4 |
| Cancel › Cancel against core | `e2e/orders.spec.ts` | 4 |
| History › History lists orders | `src/order-history.test.tsx` | 2 |
| History states › No orders yet | `src/order-history.test.tsx` | 2 |
| History › History against core | `e2e/orders.spec.ts` | 2 |
| Order links › Account links to orders | `src/account.test.tsx` | 2 |
| Layout › Checkout and orders on a phone | `e2e/orders.spec.ts` | 4 |

44 scenarios: 33 Vitest, 9 Playwright, 2 existing. One extra Vitest test in task 2 ("empty checkout links to orders").

## Test strategy

Vitest, as in the earlier web lanes: no HTTP mock and no module mock. A view is rendered over seeded caches (`setToken('t')`, then `queryClient.setQueryData` for `cartKey('t')`, `['addresses', 't']`, `keys.store(id)`, `orderKey('t', id)`, `ordersKey('t')`, `['me', 't']`); a read that then goes out fails under jsdom (relative URL), which is what "core cannot be reached" means in a scenario and is also how every tracking test exercises "data before error" (the order key has no `staleTime`, so each mount refetches and fails). `refetchFailed(key)` from `test-data.ts` waits for it.

- Whole-app tests (`renderAt(path)`): the redirects, the summary, the states, the address choice, the minimum, "edit cart" opening the drawer, no bar on checkout, tracking display, status change (`act(() => queryClient.setQueryData(orderKey, next))`, then the same element by identity), history, the account link.
- Tests that need core's answer to a write (`renderInRouter(<CheckoutPage send={fake} />)`, `renderInRouter(<OrderPage id={id} send={fake} />)`): `send` is the one function that performs the POST; the fake returns an `OrderResult` built from core's documented envelope. This is the `submit` prop pattern of `auth-forms` and `address-dialog`. `placeOrder` and `cancelOrder` (retry, cache effects, the queue) run for real around it. The location is read from the router `renderInRouter` returns (`router.state.location.pathname`); that router has no order routes, so nothing is asserted about the page it lands on, only the path and the caches (`queryClient.getQueryData(cartKey('t'))` has no items; `orderKey('t', id)` holds the order).
- "Out-of-stock lines marked": after the refusal `placeOrder` invalidates the cart, the read fails under jsdom and the seeded cart stays, so the badges come from the seeded products (`quantity: 2` with a line of 3; `inStock: false`).
- `Countdown` is rendered alone (`render(<Countdown … />)`, no router, nothing async) under `vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })` with `vi.setSystemTime`; time moves with `act(() => vi.advanceTimersByTime(60_000))`; assertions are synchronous `getByText`. `vi.useRealTimers()` in that file's `afterEach`. `setTimeout` is never faked: Testing Library's `findBy` and the router need it.
- `src/orders.test.ts` is pure: the vocabulary table, `pollInterval` over the seven statuses, `null` and `undefined`, and `orderOptions('t', id).refetchIntervalInBackground` not being `true`.

What only e2e can prove: that `POST /orders`, `POST /orders/{id}/cancel`, `POST /me/addresses` and the "Remove" `PUT` are sent as core accepts them and that their real answers render; the router link from the drawer through sign-in to `/checkout`; the landing on the tracking page after placing; that polling really re-reads and really stops; axe; the 390 px geometry.

### e2e

`e2e/shopper.ts` (helpers, not a spec; Node side only), then `e2e/checkout.spec.ts` and `e2e/orders.spec.ts`. Both specs start with the pincode `beforeEach` the other specs use (`560034`).

```ts
export const koramangala = '00000000-0000-4000-8000-000000000401'
export const tokenKey = 'shopperstop:customer-token'
export function freshEmail(): string
export async function expectNoViolations(page: Page): Promise<void>
export type Shopper = { email: string; password: string; token: string; headers: { Authorization: string } }
export async function freshShopper(request: APIRequestContext, name: string): Promise<Shopper>      // POST /auth/register
export async function addAddress(request, shopper, pincode = '560034', label = 'Home'): Promise<string>   // POST /me/addresses → id
export type Pick = { id: string; name: string; slug: string; priceCents: number; units: number }
export async function orderPick(request, n: number): Promise<Pick>
export async function fillCart(request, shopper, pick): Promise<void>            // PUT /me/cart/items at Koramangala, expects 200 and clamped false
export async function placeByApi(request, shopper, addressId): Promise<{ id: string; number: string }>   // POST /orders, expects 201
export async function signedIn(page: Page, shopper: Shopper): Promise<void>     // addInitScript(([key, token]) => localStorage.setItem(key, token), [tokenKey, shopper.token])
export async function staffHeaders(request): Promise<{ Authorization: string }>  // POST /admin/auth/sign-in as admin@shopperstop.local
```

- **A fresh customer, address and cart per test.** Every test that writes registers its own customer (`freshEmail()`), adds its own address and fills its own cart through the API, so nothing is shared with another test's customer. Only the two read-only tests sign in as the demo customer.
- **No collision on stock.** `orderPick(request, n)` reads `GET /stores/{koramangala}/products?page=2&pageSize=100` (products 101 to 148 by name: no other spec adds, clamps or measures there; `cart.spec.ts`, `browse.spec.ts` and `phone-layout.spec.ts` work in the first 100) and `GET /stores/{koramangala}` for `minOrderCents`, keeps the products with `inStock`, `quantity === 10` (so the real stock is at least 10) and `priceCents >= 2000`, and answers the n-th with `units = Math.ceil(minOrderCents / priceCents)` (at most 5). It fails loudly when there is no n-th. Each test owns one index, so no two tests touch the same product's stock: 0 address added, 1 order placed, 2 out of stock, 3 address not served, 4 tracking follows, 5 cancel, 6 phone. `globalSetup` resets the seed before every run, so a product loses at most 5 of at least 10 units per run.
- **Cancel does not use demo order `...0703`** (cancellable once per reset): the test places its own order with `placeByApi` and cancels that one. The demo orders are only read; the tests assert `...0701` delivered and `...0702` cancelled by status, and `...0703` only by its number and place in the list.
- **Out of stock** sets the stock of its own product to 0 as the seeded admin after the page has loaded, and restores the value it read first in `finally` (the pattern of "server cart clamps above stock").
- **Tracking follows** places its own order, opens its page, counts `GET /orders/<id>` requests with `page.on('request', …)`, moves the order `accepted`, `packing`, `ready`, `out_for_delivery`, `delivered` through `POST /admin/orders/{id}/status` as the seeded admin, waits up to 15 s for "Your order was delivered.", then `page.waitForTimeout(11_000)` and expects the count unchanged. `test.slow()`.
- **Phone** (`test.use({ viewport: { width: 390, height: 844 } })`): boxes with `boundingBox()` as `phone-layout.spec.ts` does; a card is `getByRole('region', { name })` on `/checkout` and the order page, and the `listitem` on `/orders`; `document.documentElement.scrollWidth <= innerWidth`; `toHaveCSS('font-variant-numeric', 'tabular-nums')` on the order heading and on the "Total" amount.
- axe (`expectNoViolations`) on every page, and with each dialog open.

Two rules that bit earlier lanes: inside `page.evaluate`, `page.addInitScript` and `page.waitForFunction` callbacks nothing from the Node side exists (no imported constant, no helper, no closure variable): pass values as the callback's argument. And every Playwright `getByRole(..., { name })` and `getByText` uses `exact: true`; Testing Library has no such option on `getByRole`, where a string name already matches exactly (use a string, not a regex) ("Cancel order" is on the page and in the dialog; "Add address" is a button and a dialog title; "View order SS-DEMOAAAB" and "View cart").

## Risks / Trade-offs

- `navigate({ to: '/orders/$id' })` inside `renderInRouter`'s bare router: TanStack builds the location from the path whether or not a route matches. If a worker finds it does not, they report; they do not add a mock.
- The Figma `Customer web` frames for these three pages were not opened by this lane; the manager's walk-through compares them.
- `Chip` as a single choice is announced as a pressed button, not a radio; acceptable until ui ships a choice control.
- The poll-stop e2e waits 11 s by the clock; it is the only way to see that nothing is sent.
- The branch was cut at `e6d8e4b`; `openspec/specs/orders` reaches it with the rebase on `origin/main` (archive of core-orders, #140). Nothing here edits it.
