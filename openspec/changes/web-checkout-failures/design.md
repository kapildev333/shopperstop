# Design: web-checkout-failures

## Context

Checked on 2026-10-15 against `origin/main` 19c3b8e: `services/core/openapi.json`, `openspec/specs/orders`, `services/core/internal/order/place.go`, `services/core/internal/cart/cart.go`, `apps/web/src/checkout.tsx`, `apps/web/src/orders.ts`, `apps/web/src/cart.ts`.

- **Core's placement has no idempotency key, and needs none for one cart.** `order.Place` runs in one transaction: `cart.Lines` takes the cart row `FOR UPDATE` (`LockCart`), the order is written, stock taken and the cart emptied before commit. A second `POST /orders` for the same cart waits on that lock and then reads no lines: 400 `validation` "cart is empty", no field. `openapi.json` lists 201, 400, 401, 409 and no idempotency header. So once a placement has committed, a retry cannot place it twice; it answers "cart is empty", which the page already turns into a move to `/orders` (web-checkout-orders Decision 3). The one way a retry places a second order is a cart refilled between the two presses (another tab): that is a new cart, not a double placement.
- **What `internal` means at placement.** `postOrder` answers `{ error }` with code `internal` when `call()` caught a thrown `fetch` (`unreachable`), when the middleware turned a failed answer without the envelope into `unreachable` (web-failed-answers-without-envelope), when core sent its own 500 envelope, and when a 2xx came without an order ("Core answered without an order."). In all of them the request may have reached core and committed. Every other code is a refusal core answered before or instead of committing (`placeOrder` already sends a `conflict` once more).
- `placeOrder` already reads the cart again after `internal` (`await queryClient.invalidateQueries(cartKey)`; web-checkout-orders Decision 21). If core placed the order, that read answers an empty cart and the page today drops to "Your cart is empty"; if core is still unreachable the old cart stays.
- **Remove on checkout.** `checkout.tsx` › `remove` calls `void setLine(view.storeId, line.product, 0)` and drops the answer. `cart.ts` exports `useLineWrite(storeId, product)` → `[failure, write]` (web-cart-write-failure Decision 2): it clears the failure on the next call and on unmount and shows only the last write's failure. It is a hook, so it needs a component per line.

## Decisions

### 1. Checkout's Remove is a per-line component using `useLineWrite`

The marked block inside `SummaryCard`'s `LineRow` becomes a small component in `checkout.tsx`:

```tsx
// A line core refused: why, and Remove through the cart; a failed removal shows under it, like the drawer's.
function ShortLine({ storeId, line }: { storeId?: string; line: CartLine }) {
  const [failure, write] = useLineWrite(storeId, line.product)
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="danger">{shortText(line.product, line.quantity)}</Badge>
        <Button variant="ghost-danger" aria-label={`Remove ${line.product.name}`} onClick={() => write(0)}>
          Remove
        </Button>
      </div>
      {failure && <ErrorBanner message={failure} />}
    </div>
  )
}
```

`SummaryCard` renders `{short[line.product.id] === line.quantity && <ShortLine storeId={view.storeId} line={line} />}`. `CheckoutPage`'s `remove` and `SummaryCard`'s `onRemove` prop go; the `setLine` import becomes `useLineWrite`. `useLineWrite` already does nothing without a store, which replaces `remove`'s `if (view.storeId)`.

Why: the same hook, the same banner under the same kind of control as the drawer line; no new state, no new copy. The failure's own `invalidateQueries` re-reads the cart; if core is still down the line keeps its quantity, stays marked, and the alert stays.

### 2. `internal` at placement is "unconfirmed", not "failed"

`Refusal` gains `unconfirmed?: true`. `refusalOf` answers, before the final `return`:

```ts
// The request may have reached core and committed (design Context): never say it failed.
if (error?.code === 'internal')
  return { message: 'We could not confirm your order. It may have been placed, so check Your orders before you place it again.', unconfirmed: true }
```

`SummaryCard` renders, right after `{refusal && <ErrorBanner message={refusal.message} />}`:

```tsx
{refusal?.unconfirmed && (
  <Link to="/orders" className={buttonClass({ variant: 'secondary' })}>
    Your orders
  </Link>
)}
```

The card's own `flex flex-col gap-4` spaces them. The link is the empty-cart page's "Your orders" (same `Link` + `buttonClass`), so no new pattern and no ui change. `ErrorBanner` takes only a string, so the link sits under it, not inside.

"Place order (COD)" stays enabled. Disabling it would strand a customer whose request never left the browser; a press after a committed placement is answered "cart is empty" and moves to `/orders` (Context). The copy asks them to check first; it does not say "Try again".

### 3. An empty cart after `internal` moves to `/orders`

In `place()`, the `cartEmptied` branch widens:

```ts
// internal, then core's cart came back empty: the order went through.
const emptied = error?.code === 'internal' && queryClient.getQueryData<CartView>(cartKey(token))?.items.length === 0
if (error && (cartEmptied(error) || emptied)) {
```

`placeOrder` awaited the re-read before answering, so the cache holds core's cart (or the old one when the read failed). `/orders` reads the history on mount (no `staleTime`), so the order is its first card. Without this the page would show "Your cart is empty" and lose the alert.

Rejected: an idempotency key on `POST /orders` (a core change, and Context shows one cart cannot be placed twice); polling `GET /orders` after `internal` to find the order (guesswork about which order, more code, and still unreachable when core is down); a dialog (a new interaction for one message).

## Ceilings

- The move to `/orders` after an emptied cart says nothing; the customer sees the history with the order first (same ceiling as web-checkout-orders Decision 3). A cart emptied in another tab without an order lands there too.
- When core stays unreachable, the alert and the link are all the customer gets; `/orders` will fail to load too until core is back. Nothing polls.
- A second press after a committed placement is safe only because core locks and empties the cart in the placement transaction. If core ever keeps the cart after placement, an idempotency key becomes necessary (a core request then).
- A removal that fails while core answers the re-read with a changed quantity unmarks the line, and the alert goes with it (the component unmounts); the line's new state is the answer.
- Two alerts can show at once (the out-of-stock refusal and a failed removal); each is under its own control.

## Tests

Vitest only, `src/checkout.test.tsx`. Core "cannot be reached" is `test-setup.ts`'s default `fetch`; a test that needs core's answer uses `vi.stubGlobal('fetch', …)` with `afterEach(() => vi.unstubAllGlobals())` added to the file. No Playwright: no layout or real-network behaviour jsdom cannot see.

| Scenario | Test |
|---|---|
| Customer cart write failure › Failed removal at checkout | "failed removal at checkout" (new) |
| Customer checkout refusals › Placement fails | "placement fails" (changed: the second answer is `{ code: 'validation', field: 'addressId', message: 'unknown address' }` from the `send` prop, not the real request; green before and after) |
| Customer checkout unconfirmed placement › Core cannot be reached at placement | "core cannot be reached at placement" (new; `send` is the real `postOrder`) |
| Customer checkout unconfirmed placement › Unconfirmed placement that emptied the cart | "unconfirmed placement that emptied the cart" (new; `send` answers `internal`, `fetch` stubbed to answer `GET /me/cart` with the empty cart) |

The other scenarios of the two MODIFIED requirements keep their landed tests unchanged.

## Files

`apps/web/src/checkout.tsx`, `apps/web/src/checkout.test.tsx`.
