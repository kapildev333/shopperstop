# Design: web-cart-write-failure

## Context

- `apps/web/src/cart.ts` › `setLine(storeId, product, quantity): Promise<void>`: guest → `dispatchGuest`; signed in → records the asked count in `asked` (the `Stepper` shows it), queues a `PUT /me/cart/items` through `call()`, and on success caches core's answer. When `answered.cart` is missing (an error, or no body) it only invalidates the cart query and returns; the error `call()` returned is dropped. The `finally` removes the asked count, so the `Stepper` snaps back. This is the silent failure.
- `call()` in `apps/web/src/api.ts` answers core's envelope error, or `unreachable` (`{ code: 'internal', message: 'Could not reach ShopperStop. Try again.' }`) when `fetch` throws; `authMiddleware.onResponse` turns a non-envelope failure into the same `unreachable` envelope (web-failed-answers-without-envelope). So every failure already has a message; nothing new is mapped.
- Callers of `setLine`: `useCartQuantity` (product card and product page), `CartLineRow` in `cart-drawer.tsx` (Stepper and Remove), `checkout.tsx` (Remove on an out-of-stock line).
- Stock: core never refuses a line for stock. It clamps and answers 200 with `clamped: true`, and the drawer shows "Some quantities were lowered to what the store has." (`StatusMessage tone="warning"`). There is no `out_of_stock` answer on `PUT /me/cart/items` (`openspec/specs/cart`; `openapi.json` lists 200, 400, 401). The 400s are `validation` with a field (`productId` "product not available" when a product was deactivated; `quantity`; `storeId`).
- `ErrorBanner` (`packages/ui`) is `role="alert"` with a message and an optional retry; the app already uses it for failed actions (`store-change.tsx` "Could not empty your cart.", order cancel, checkout refusals). `StatusMessage` tones are neutral, success and warning: no error tone.
- `Sheet` is `aria-modal="true"` and portals to `body`; anything outside it is behind its overlay while it is open.

## Decisions

### 1. The message shows under the control that was used

The `ErrorBanner` renders right under the `Stepper` (or Remove) the customer tapped: on the product card, on the product page, on the drawer line.

Why: it is the one place that is on screen at every width at the moment of the failure, because the customer's eye and finger are on it. The other places fail somewhere:
- the cart bar: phone only, and absent while the cart is empty (a failed first "Add" has no bar);
- the header cart button: desktop only, and scrolls away with the banner;
- the drawer: only while open;
- a fixed toast: overlaps the phone bar, sits behind the drawer's modal overlay, needs a dismiss control, and is a new pattern that belongs in `packages/ui` first.

Under the control, the drawer case is inside the modal dialog, so the alert is announced and seen there; the card behind the drawer does not show the drawer's failure (decision 2), so there is no second announcement.

### 2. The failure is component state, returned by `setLine`

`setLine` answers `Promise<ApiError | undefined>`: the error when the write it ran failed and it is still the last one asked for that line, else `undefined`. A tiny hook in `cart.ts` holds it per control:

```ts
// The last failed write made from this control; it goes when the control is used again or unmounts.
export function useLineWrite(storeId: string | undefined, product: CartProduct) {
  const [failure, setFailure] = useState<string>()
  const write = (quantity: number) => {
    if (!storeId) return
    setFailure(undefined)
    void setLine(storeId, product, quantity).then((error) => setFailure(error?.message))
  }
  return [failure, write] as const
}
```

`useCartQuantity(product)` keeps its body and returns `[quantity, write, failure]`, with `write` from `useLineWrite(storeId, product)` (the resolved store, as today). `CartLineRow` uses `useLineWrite(storeId, product)` with the cart's own store for both the `Stepper` and Remove.

Why component state: web-cart Decision 10 keeps cart *data* out of component state; this is not cart data but what this control's last tap did. Component state gives "clears on the next tap" (the `setFailure(undefined)` before the write) and "clears when it leaves the page" (unmount) for free, and shows the message only where the tap was. A module store keyed by line (like `asked`) would show on every control for that line, survive navigation, and need its own clearing rule.

### 3. `setLine`'s failure branch

In the queued body, the existing `if (!answered.cart)` branch keeps its `invalidateQueries` and then returns:

```ts
// A later tap on this line overtook this write: that one answers for the line.
return asked.get(key)?.turn === mine ? (error ?? unreachable) : undefined
```

where `error` is what `call(...)` returned (today discarded). The check runs before `finally` deletes the asked entry, so `turn === mine` means no later tap is queued. `?? unreachable` covers a 2xx with no body; `unreachable` is exported from `api.ts` (its declaration gets `export`, nothing else changes). Every other return in the body (`skip`, success) answers `undefined`; the guest path answers `undefined` after `dispatchGuest`. `checkout.tsx` keeps `void setLine(...)` and is untouched.

### 4. Rendering

`{failure && <ErrorBanner message={failure} />}`, no `onRetry` (the `Stepper` is the retry):
- `product-card.tsx`: after the `Stepper`, inside the `flex flex-col items-start gap-2` div.
- `routes/p.$slug.tsx` › `ProductDetail`: right after the `<div>` holding the `Stepper`, inside the card's `flex flex-col gap-3`.
- `cart-drawer.tsx` › `CartLineRow`: the `<li>` becomes `flex flex-col gap-2 py-3` and its current children move into an inner `<div className="flex items-center gap-3">`; the banner follows that div.

Copy: core's `message` as answered, like every other banner that shows core's error (`splitError`). No new copy.

## Ceilings

- Checkout's Remove (out-of-stock line) still fails silently: it has no `Stepper` and the page has its own refusal banner; add `useLineWrite` there when it matters.
- Core's 400 messages are terse and lowercase ("product not available"); they are shown as answered, consistent with the other banners. Friendlier copy per code is a core or web copy pass, not this change.
- While the message shows, the card grows taller and the grid row reflows (2 columns at 390 px wrap the text over several lines).
- The product page has no test of its own: it uses the same `useCartQuantity` as the card, and only the placement differs.
- A failure on the card while the drawer is open on the same line (impossible by hand: the drawer is modal) would show on the card only.
- A 401 clears the token (middleware) and shows core's `unauthorized` message under the control; the `Stepper` then shows the guest count. Accepted: the customer learns the session ended.

## Tests

Vitest only; jsdom shows all of it (the alert's role and text, the count, mount and unmount). No Playwright: nothing here is layout or real-network behaviour that jsdom cannot see.

| Scenario | File › test |
|---|---|
| Failed write tells the customer | `src/cart.test.tsx` › "failed write tells the customer" |
| Core's refusal is shown | `src/cart-write-failure.test.tsx` › "core's refusal is shown" (new file; `vi.hoisted` stubs `globalThis.fetch` before `api.ts` loads, as `src/auth.test.ts` does, with a 400 envelope) |
| Next tap clears the failure | `src/cart.test.tsx` › "next tap clears the failure" |
| Overtaken change shows no failure | `src/cart.test.tsx` › "overtaken write shows no failure" |
| Failed write in the drawer | `src/cart-drawer.test.tsx` › "failed write in the drawer" |

"Overtaken write shows no failure" taps twice in one tick, so the first write is skipped at the top of its queued body; the `turn === mine` check at failure time (a tap made while the first write is in flight) is verified by reading: under jsdom the failing `fetch` settles too fast to tap between start and failure reliably, and without the check the same control would still end on the last write's result.

Under jsdom a relative `fetch` throws, so "core cannot be reached" needs no stub (the existing "failed write returns to the cart's count" relies on it). The drawer test looks only `within(drawer)`: Home's own load failures are alerts outside it.

## Files

All in `apps/web/`: `src/api.ts`, `src/cart.ts`, `src/product-card.tsx`, `src/routes/p.$slug.tsx`, `src/cart-drawer.tsx`, `src/cart.test.tsx`, `src/cart-drawer.test.tsx`, `src/cart-write-failure.test.tsx` (new).
