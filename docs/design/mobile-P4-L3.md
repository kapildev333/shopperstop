# mobile-P4-L3 - screen and module data for `mobile-cart`

Why this file exists: the workers cannot open the design canvas (D36). This file carries what they need from artboards 4 Cart sheet, 14 Cart empty and the cart bar of 1 Home and 2 Category, in token names and React Native terms, plus the module interfaces. Behaviour is in `openspec/changes/mobile-cart/specs/mobile-app/spec.md`, decisions in that change's `design.md`. Where this file and the spec disagree, the spec wins; tell the team lead.

Conventions are `docs/design/mobile-P4-L1.md`'s and `docs/design/mobile-P4-L2.md`'s: sizes in points at 390 wide; colours are keys of `colors` from `src/ui/tokens.ts`, never a value; type names are `Text` variants (`h2` 20/26 700, `h3` 16/22 600, `body` 14/20, `small` 12/16, `button` 14/20 600); "600" on a `body` or `small` means `style={{ fontFamily: fontFamily(600) }}`; radius `radius.control` 8, `radius.card` 12, `radius.pill`; shadow `boxShadow: shadows.sheet.boxShadow`. Every style in `StyleSheet.create`. Amounts use `formatInr` from `@shopperstop/ui/format` and `tabular`. The canvas draws image placeholders in a grey that is not a token: `ImageTile` handles it.

Icons (`lucide-react-native`): Timer `Timer` (20), empty cart `ShoppingBag` (44), bar chevron `ChevronRight` (16). All hidden from assistive technology (`aria-hidden` on a wrapping `View`, as L2 does).

## The port

`apps/web/src/guest-cart.ts` and `apps/web/src/cart.ts` are the reference: copy their logic and comments, then change only what is listed here. The web `localStorage` calls become async storage, `useServiceability(usePincode().pincode)` becomes L2's `useStore()`, and the web `CartView` and `CartProduct` types are kept as they are.

## Module interfaces

```ts
// src/cart-guest.ts  (task 1; pure logic and the guest store; imports nothing from src/cart.ts)
export type CartProduct = { id: string; name: string; slug: string; unitLabel: string; priceCents: number; mrpCents: number; imageUrl?: string; inStock: boolean; quantity: number }
export type CartLine = { product: CartProduct; quantity: number }
export type GuestCart = { storeId?: string; items: CartLine[] }
export type CartFees = { deliveryFeeCents: number; freeDeliveryAboveCents: number; minOrderCents: number }
export type CartView = GuestCart & { subtotalCents: number; deliveryFeeCents: number; totalCents: number; minOrderCents: number; shortfallCents: number; clamped?: boolean; replaced?: boolean; replacedStoreId?: string }
export type CartAction = { type: 'set'; storeId: string; product: CartProduct; quantity: number } | { type: 'clear' }
export const guestCartKey = 'shopperstop:cart'
export const lineCap = 20
export const emptyCart: GuestCart
export function maxQuantity(product: CartProduct): number            // inStock ? min(quantity, 20) : 0
export function cartReducer(state: GuestCart, action: CartAction): GuestCart   // web's, unchanged
export function cartView(cart: GuestCart, fees?: CartFees): CartView           // web's, unchanged
export function mrpTotalCents(items: CartLine[]): number              // sum of mrpCents * quantity
export function itemCount(items: CartLine[]): number                  // sum of quantities
export function mergeBodies(cart: GuestCart): { storeId: string; productId: string; quantity: number }[]
export function getGuestCart(): GuestCart
export function loadGuestCart(): Promise<GuestCart>                   // starts the one read on the first call, resolves after it settles; later calls return the same promise
export function useGuestCart(): GuestCart                            // calls loadGuestCart() once from an effect; server snapshot emptyCart
export function dispatchGuest(action: CartAction): void               // only when the action changes the cart: memory now and loaded = true (a late read is dropped); then setItem / removeItem, rejections swallowed. A no-op leaves the read to load
export function clearGuestCart(): void                                // always: empty cart, loaded = true, emit, removeItem, even when memory is already empty (a late read is dropped)

// src/cart.ts  (task 3; L2's names kept, bodies replaced)
export type { CartProduct, CartView } from './cart-guest'
export type CartSummary = { count: number; storeId?: string; totalCents: number }
export const cartKey: (token: string) => readonly ['cart', string]
export function cartOptions(token: string)                           // web's: GET /me/cart, staleTime 60 s, throws error.error (the ApiError, like L1's queries)
export function useCart(): { view?: CartView; isPending: boolean; isError: boolean; error: unknown; refetch: () => void; signedIn: boolean }
export function useQuantity(productId: string): number                // asked ?? (cart at useStore()'s open or closed store ? line quantity : 0)
export function setQuantity(storeId: string, product: CartProduct, quantity: number): Promise<ApiError | undefined>  // web's setLine
export function useLineWrite(storeId: string | undefined, product: CartProduct): readonly [string | undefined, (quantity: number) => void]  // web's, failure is the message
export function getCartSummary(): CartSummary                         // token ? the cached server cart (count 0 when not cached) : the guest cart
export function useCartSummary(): CartSummary
export function loadCartSummary(): Promise<CartSummary | undefined>  // after the cart's read settles: token ? fetchQuery(cartOptions(token)) : loadGuestCart(); undefined when the server read failed
export function clearCart(): Promise<ApiError | undefined>            // web's
export function mergeGuestCart(): Promise<void>                       // task 6; web's, awaiting loadGuestCart() first
export function storeOptions(storeId: string)                       // queryOptions: GET /stores/{id}, key ['store', id], the whole Store; throws error.error (mobile-P4-L4b reads promisedMinutes from it)
export function useStoreName(storeId: string | undefined): string | undefined  // useQuery({ ...storeOptions(id), enabled: !!id, select: (store) => store.name })
export function queued<T>(work: () => Promise<T>): Promise<T>        // web's write queue, exported as web does (mobile-P4-L4b places the order inside it)
export function openCartSheet(): void
export function closeCartSheet(): void
export function useCartSheetOpen(): boolean

// src/cart-alert.tsx  (task 4)
export function CartWriteAlert(props: { message?: string }): JSX.Element | null
// src/cart-sheet.tsx  (task 5)
export function CartSheet(): JSX.Element
// src/cart-bar.tsx  (task 7)
export function CartBar(props: { edge?: boolean }): JSX.Element | null
// src/ui/sheet.tsx  (task 2): Sheet gains `footer?: ReactNode`
```

`useQuantity` and `useCart` price the guest cart with the store from `useStore()` (`open` or `closed` state's `store`), else no fees. `getCartSummary()` is synchronous for L2's pincode sheet: with a token it reads `queryClient.getQueryData(cartKey(token))`.

## Test fakes

As L2: `fakeCore` from `src/fake-core.ts` with keys `"PUT /me/cart/items"`, `"GET /me/cart"`, `"DELETE /me/cart"`, `"GET /stores/<id>"`, `"GET /serviceability"`; `setPincode('560034')` and `GET /serviceability` answering Koramangala (`id` `00000000-0000-4000-8000-000000000401`, fee 2500, free from 19900, minimum 9900, `promisedMinutes` 10) before rendering anything that resolves the store; `setToken('t-1')` for the signed-in case. A held-back answer is a handler returning a promise the test resolves. An unreachable core is a handler that throws `new TypeError('Network request failed')`. Server cart answers have every field of `Cart` (`items`, the five amounts, `storeId` when not empty); `PUT` answers add `replaced` and `clamped`.

## 4 · Cart sheet (`src/cart-sheet.tsx`, mounted in `src/app/_layout.tsx` after `<PincodeSheet />`)

L1's `Sheet` titled "My cart" (the title is the sheet's level-2 heading), `open={useCartSheetOpen()}`, `onClose={closeCartSheet}`. The body is mounted only while open.

Body, column, gap 12, padding top 12:

1. Notices, each L2 `StatusMessage`, when they apply: `warning` "Your cart from <useStoreName(view.replacedStoreId) ?? 'another store'> was replaced. A cart holds products from one store." (while `view.replaced`); `neutral` "Some quantities were lowered to what the store has." (while `view.clamped`).
2. Lines card (only with lines): border 1 `line`, `radius.card`, padding 12, gap 12.
   - Header row (only when `useStore()` gives an open store whose `id` is the cart's `storeId`), gap 12, centred: a 40 square `canvas` `radius.control` holding `Timer` 20 `ink`; a column: "Delivery in <promisedMinutes> minutes" (`h3`), "Shipment of <itemCount> items" (`small` `inkMuted`; "1 item" for one).
   - Per line, row gap 12, centred: `ImageTile` size 56 (`imageUri(product.imageUrl)` from `src/catalog.ts`); a column flex 1: name (`body`, 2 lines), unit (`small` `inkMuted`), `Price cents={priceCents * quantity}` (no MRP); then the `Stepper` `md` (`label` name, `value` = the line's `useQuantity`, `max` = `maxQuantity(product)`, `onChange` = `useLineWrite(view.storeId, product)`'s write). Out of stock (`maxQuantity` 0): the `Stepper` shows "Out of stock", and below it a `Button variant="ghostDanger" size="compact" accessibilityLabel="Remove <name>"` "Remove" that writes 0. Under the line, full width, `CartWriteAlert` with the line's failure.
3. Nudge (while `shortfallCents > 0`): `StatusMessage tone="warning"` "Add <formatInr(shortfallCents)> more for free delivery."
4. Bill card: border 1 `line`, `radius.card`, padding 12, gap 8, all amounts `tabular`:
   - "Bill details" `h3`, heading level 3, margin bottom 4.
   - Row space-between: "Items total"; right a row gap 6: when `mrpTotalCents(items) > subtotalCents` the MRP total (`body` `inkMuted`, line-through, `accessibilityLabel` "MRP ₹114"), then the subtotal (`body`).
   - Row: "Delivery fee"; `formatInr(deliveryFeeCents)` or "FREE" at 0.
   - Row, border top 1 `line`, padding top 8, `h3` both sides: "Grand total"; `formatInr(totalCents)`.
5. Note: `small` `inkMuted`, padding horizontal 4: "Orders cannot be cancelled once packing starts."

Footer (the `Sheet`'s new `footer`, only with lines), padding top 12:
- `subtotalCents >= minOrderCents`: a `Link` (`asChild`) to `/checkout` with a token, else `{ pathname: '/sign-in', params: { returnTo: '/checkout' } }`, around a `Pressable` `accessibilityRole="link"` `accessibilityLabel="Proceed to checkout"` whose `onPress` calls `closeCartSheet()` (the pattern of L2's pincode sheet sign-in link): height 52, `radius.card`, `accent`, row space-between, centred, padding horizontal 16; left a column: `formatInr(totalCents)` (`body` 700 `onAccent` tabular) and "TOTAL" (`small` `onAccent`); right "Proceed" (`button` `onAccent`) and `ChevronRight` 16 `onAccent`.
- Below the minimum: a `View` min height 52, `radius.card`, `canvas`, padding 12, centred: "Minimum order is <formatInr(minOrderCents)>. Add <formatInr(minOrderCents - subtotalCents)> more to check out." (`body` 600 `ink`, centred). (The canvas draws it in `inkMuted`; L2's axe run showed `inkMuted` fails 4.5:1 on `canvas`, so `ink`. Muted text goes only on `surface`.)

States, in place of the body: signed in and no `view` yet: `Skeleton count={3}` (label "Loading"); no `view` and `isError`: L1's `ErrorBanner` with `error` and `onRetry` = `refetch`; a `view` with no lines (and the notices above it when set): artboard 14 below.

`replaced` opens the sheet once: `const answer = view?.replaced ? view : undefined; useEffect(() => { if (answer) openCartSheet() }, [answer])` in `CartSheet` (outside the body), as web's `cart-drawer.tsx`.

## 14 · Cart empty (inside the sheet)

L1's `EmptyState` (level 2) with `icon` = a 96 circle `canvas` holding `ShoppingBag` 44 `ink`, `title` "Your cart is empty", `description` "Milk, bread, snacks and more, delivered from the store near you in minutes.", `action` = `Button` primary `lg` "Start shopping" → `closeCartSheet()`. Padding 24 32 40.

## Cart bar (`src/cart-bar.tsx`)

Renders nothing while `useCart().view` has no lines. Otherwise a wrapper (`SafeAreaView edges={['bottom']}` when `edge`, else a `View`), padding 12 16, gap 8:
- `StatusMessage tone="warning"` with the replaced text while `view.replaced` (same text as the sheet).
- The bar: one `Pressable` `accessibilityRole="button"` `accessibilityLabel="View cart, <count text>, <formatInr(totalCents)>"` → `openCartSheet()`; height 56, `radius.card`, `accent`, `boxShadow: shadows.sheet.boxShadow`, row space-between, centred, padding horizontal 16. Left column: "<N> items" / "1 item" (`small` `onAccent` tabular); `formatInr(totalCents)` (`body` 700 `onAccent` tabular). Right row gap 4: "View cart" (`button` `onAccent`), `ChevronRight` 16 `onAccent`.

The canvas floats the bar 12 above the tab bar over the content; here it sits in the screen's column after the content (nothing is hidden behind it). Mounting, one line each plus the import:
- `src/app/(tabs)/index.tsx`: `<CartBar />` after `</ScrollView>`, inside `View role="main"`.
- `src/app/(tabs)/categories.tsx`: `<CartBar />` after `<StoreGate>…</StoreGate>`.
- `src/app/category/[slug].tsx`: `<CartBar edge />` after `<StoreGate>…</StoreGate>`.
- `src/app/search.tsx`: `<CartBar edge />` after `<StoreGate>…</StoreGate>`.
(`edge` adds the bottom safe area on stack screens; the tab bar already holds it on tabs.)

## Write failure alert (`src/cart-alert.tsx`)

`CartWriteAlert({ message })`: nothing without a message; else `Text variant="small" tone="danger" accessibilityRole="alert"` with the message, margin top 4.

Integration, `setQuantity(storeId, product.id, next)` becomes the hook (and the product type is passed whole):
- `src/catalog-card.tsx`: `const [failure, write] = useLineWrite(storeId, product)`; the `Stepper`'s `onChange={write}`; `<CartWriteAlert message={failure} />` after the price-and-stepper row.
- `src/app/product/[slug].tsx`: same; `<CartWriteAlert message={failure} />` inside the bar's price column, after "Inclusive of all taxes".

## Sheet footer (`src/ui/sheet.tsx`)

`footer?: ReactNode`, rendered after the `ScrollView` inside the panel (so it stays put while the content scrolls). Nothing else changes.

## Sign-in merge (`src/auth.ts`)

In `openSession`, after `startSession(opened.session)`: `await mergeGuestCart()`, so the forms navigate back only once the guest lines are on the server. The sign-in copy "Sign in to place your order. Your cart stays as it is." (L1 deferred it, R1 finding 10) stays: the merge keeps the guest's lines.

## Pincode sheet: a store change needs an answer (`src/pincode-sheet.tsx`, task 8)

`PincodeForm.next()` today reads `getCartSummary()` and stores the pincode when the lookup fails. It becomes, in order:
1. `const [answer, cart] = await Promise.all([resolvePincode(value).then((a) => a, () => undefined), loadCartSummary()])`.
2. If `!open.current` (L2's dismissal guard), return. When `!cart || cart.count > 0` and (`!answer` or `!cart`): stop the pending state, keep the sheet open, show under the field an alert `View accessibilityRole="alert"` styled like the dialog's ("Could not empty your cart." box: `dangerSoft`, `radius.control`, padding 12) with `Text tone="danger"` "Could not check this pincode. Try again."; store nothing. The alert goes on the next Continue or field change.
3. Otherwise L2's rule with `cart` instead of `getCartSummary()`: another store with lines opens the dialog; anything else stores and closes.
