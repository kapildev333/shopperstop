# mobile-P4-L4b - screen and module data for `mobile-checkout`

Why this file exists: the workers cannot open the design canvas (D36). This file carries artboard 5 Checkout in token names and React Native terms, the copy, and the module interfaces. Behaviour is in `openspec/changes/mobile-checkout/specs/mobile-app/spec.md`, decisions in that change's `design.md`. Where this file and the spec disagree, the spec wins; tell the team lead.

Conventions are those of `docs/design/mobile-P4-L1.md`, `-L2.md`, `-L3.md` and `-L4a.md`: sizes in points at 390 wide; colours are keys of `colors` from `src/ui/tokens.ts`, never a value; text through `Text` from `src/ui/text.tsx` (`variant` `h2` 20/26 700, `h3` 16/22 600, `body` 14/20, `small` 12/16, `button` 14/20 600; `tone`; `heading`; `tabular`); "600" or "700" on a `body` or `small` means `style={{ fontFamily: fontFamily(600) }}`; radius `radius.control` 8, `radius.card` 12; shadow `boxShadow: shadows.card.boxShadow` on cards, `shadows.sheet.boxShadow` on the bar. Every amount is `formatInr` from `@shopperstop/ui/format` with `tabular`. Icons from `lucide-react-native`, hidden from assistive technology (a wrapping `View` with `aria-hidden`, as L2 does).

## The port

`apps/web/src/checkout.tsx` and `postOrder`, `cartEmptied`, `placeOrder` in `apps/web/src/orders.ts` are the reference: copy their logic and comments, change only what this file lists. Web's `useNavigate` becomes expo-router's `useRouter().replace`, web's `openCart` becomes `back(); openCartSheet()`, web's `Badge` marks become text, web's inline address radios become the card and "Choose address" sheet below.

## Module interfaces

```ts
// src/checkout.ts (task 1). No React.
import type { ApiError } from './api'
import type { CartProduct, CartView } from './cart'          // L3 re-exports these from cart-guest
import type { OrderResult } from './orders'                  // L4a
export type Refusal = { message: string; detail?: string; addressId?: string; unconfirmed?: true }
export type Outcome = { to: string } | { refusal: Refusal; productIds?: string[] }
export function postOrder(addressId: string): Promise<OrderResult>
  // web's: POST /orders { addressId } through call(); an ok answer with no order is { code: 'internal', message: 'Core answered without an order.' }
export function cartEmptied(error: ApiError): boolean          // error.code === 'validation' && !error.field
export function placeOrder(addressId: string, send?: typeof postOrder): Promise<OrderResult>
  // web's, unchanged: no token → unauthorized; queued(...) from ./cart; token changed before its turn → unauthorized;
  // send; 'conflict' → send once more; order or cartEmptied → cancelQueries(cartKey) + setQueryData(cartKey(token), cartView(emptyCart))
  // + (order) setQueryData(orderKey(token, id), order) + invalidate ordersKey(token);
  // validation on addressId → invalidate ['addresses']; not_serviceable → nothing; else await invalidateQueries(cartKey(token))
export function refusalOf(error: ApiError | undefined, storeName: string, addressId: string): Refusal
  // out_of_stock → { message: 'Some products are not available in the quantity you chose.', detail: 'Remove them to place your order.' }
  // not_serviceable + field addressId → { message: `${storeName} does not deliver to this address. Choose another address or add one.`, addressId }
  // not_serviceable, no field → { message: `${storeName} is closed right now.` }
  // field subtotal → { message: "Your cart is below the store's minimum order." }
  // internal → { message: 'We could not confirm your order. It may have been placed, so check Your orders before you place it again.', unconfirmed: true }
  // else → { message: 'Could not place your order. Try again.' }
export function outcomeOf(result: OrderResult, cartAfter: CartView | undefined, storeName: string, addressId: string): Outcome
  // result.order → { to: `/orders/${order.id}` }
  // error && cartEmptied(error) → { to: '/orders' }
  // error.code === 'internal' && cartAfter?.items.length === 0 → { to: '/orders' }
  // else → { refusal: refusalOf(error, storeName, addressId), productIds: error?.code === 'out_of_stock' ? error.productIds ?? [] : undefined }
export function shortText(product: CartProduct, quantity: number): string
  // !inStock → 'Out of stock'; product.quantity < quantity → `Only ${product.quantity} left`; else 'Not enough stock'
export function blockReason(input: { marked: boolean; subtotalCents: number; minOrderCents: number; hasAddress: boolean }): string | undefined
  // marked → 'Remove the marked products to continue.'
  // subtotal < min → `Minimum order is ${formatInr(min)}. Add ${formatInr(min - subtotal)} more to place the order.`
  // !hasAddress → 'Add an address to place the order.'; else undefined

// src/checkout-address.tsx (task 2)
import type { Address } from './addresses'                     // L1
export function chosenAddress(list: Address[] | undefined, chosen: string | undefined): Address | undefined
  // the address with id `chosen`, else the default, else the first; undefined for no list or []
export function addressLine(address: Address): string          // [line1, line2, pincode].filter(Boolean).join(', ')
export function AddressCard(props: { chosen?: string; onChoose: (id: string) => void; refusedId?: string }): JSX.Element
  // reads useAddresses() (L1) itself; owns the "Choose address" and "Add address" sheets' open state

// src/checkout-screen.tsx (tasks 3, 4, 5)
export function CheckoutScreen(): JSX.Element                    // no token → <Redirect href="/sign-in?returnTo=%2Fcheckout" />, else the screen

// src/app/checkout.tsx (task 3)
export default function CheckoutRoute() { return <CheckoutScreen /> }
```

From L3 (`src/cart.ts`, `src/cart-guest.ts`, `src/cart-alert.tsx`), as `docs/design/mobile-P4-L3.md` names them: `useCart()` (`view`, `isError`, `error`, `refetch`), `cartKey(token)`, `queued<T>(work)`, `storeOptions(storeId)` (whole `Store` under `['store', id]`), `useLineWrite(storeId, product)` → `[failure, write]`, `openCartSheet()`, `cartView`, `emptyCart`, `CartWriteAlert({ message })`. Not used here: `ReplacedNotice`, `useLineQuantity` (checkout lines show the server cart's quantity). From L1: `useAddresses()`, `AddressSheet({ open, onClose })`, `useBack()` (`src/screen-support.ts`), `useToken()`, `getToken()`, `queryClient`, `call`. From L4a: `orderKey`, `ordersKey`, `OrderResult`. From L2: `ImageTile`, `imageUri` (`src/catalog.ts`).

## Test fakes

As L3: `fakeCore` from `src/fake-core.ts`, `json`, `apiError`; `setToken('t-1')`; an unreachable core is a handler throwing `new TypeError('Network request failed')`; a held answer is a handler returning a promise the test resolves. Koramangala is `00000000-0000-4000-8000-000000000401` (fee 2500, free from 19900, minimum 9900, `promisedMinutes` 10, `isOpen` true, city `Bengaluru`); the screen needs `GET /me/cart`, `GET /me/addresses` (`{ items, page, pageSize, total }` as L1's tests answer it), `GET /stores/00000000-0000-4000-8000-000000000401`, and for placing `POST /orders`. Cart answers carry every field of `Cart` (`storeId` when not empty, `items` with full `StoreProduct`s, the five amounts). Addresses: Home `00000000-0000-4000-8000-000000000301` (`12 80 Feet Rd`, `Koramangala`, `560034`), Work `00000000-0000-4000-8000-000000000302` (`1 Park St`, `560038`). Products: Amul Taaza `…601` (`500 ml`, 2700), Amul Butter `…602` (`100 g`, 5600), Amul Curd `…603` (`400 g`, 3500). An answered order: copy `order()` from `src/orders-tracking.test.tsx` with number `SS-ABCDEFGH`.

## 5 · Checkout (`src/checkout-screen.tsx`)

Root `View role="main"`, `flex: 1`, background `canvas`. `<Head><title>Checkout · ShopperStop</title></Head>` (expo-router/head, as L4a).

### Header

`SafeAreaView edges={['top']}` on `surface`; inner row height 64, `paddingHorizontal: 8`, gap 4, centred, bottom border 1 `line`: `IconButton label="Back to cart" icon={ChevronLeft}` whose press is `back(); openCartSheet()` (`back` = `useBack()`); `Text variant="h2" heading={1}` "Checkout". The header shows in every state (loading, error, empty).

### Scroll

`ScrollView`, `contentContainerStyle` padding 12, gap 12. In order:

1. Alert (while a refusal is held, task 4): `View accessibilityRole="alert"`, background `dangerSoft`, `radius.card`, padding 12, gap 4. `Text` 600 `ink` the message; `Text` `ink` the `detail` when set; when `unconfirmed`, a `Button variant="secondary"` "Your orders" → `router.navigate('/orders')`.
2. Address card (`AddressCard`, task 2), see below.
3. Lines card: `surface`, `radius.card`, padding 12, `shadows.card`, gap 12.
   - `Text variant="h3" heading={2}` "Delivery in <promisedMinutes> minutes", then `Text variant="small" tone="inkMuted"` "From <store name>" (both only once the store has answered).
   - Per line, a row gap 12, centred: `ImageTile uri={imageUri(product.imageUrl)} size={48}`; a column flex 1: `Text` name (2 lines max); `Text variant="small" tone="inkMuted"` "<quantity> × <unitLabel>", or, when the line is marked (task 5), `Text variant="small" tone="danger"` 600 `shortText(product, quantity)`; right: `Text` 600 `tabular` `formatInr(priceCents * quantity)`, or, marked, `Button variant="ghostDanger" size="compact" accessibilityLabel="Remove <name>"` "Remove". Under a marked line, full width, `CartWriteAlert message={failure}`.
4. Payment card: `surface`, `radius.card`, padding 12, `shadows.card`, gap 8.
   - `Text variant="h3" heading={2}` "Payment".
   - Option row: padding 12, `radius.control`, border 1 `accent`, background `accentSoft`, row gap 12, centred: `Banknote` 20 `ink`; column flex 1: `Text` 600 "Cash on delivery", `Text variant="small"` (tone `ink`, design.md Decision 8) "Pay the rider in cash"; `Check` 20 `accent`. Not pressable (one method).
   - `Text variant="small" tone="inkMuted"` "UPI and cards come with the payment service."
5. Bill card: `surface`, `radius.card`, padding 12, `shadows.card`, gap 8. Rows space-between, all `tabular`: "Items total" / `formatInr(subtotalCents)`; "Delivery fee" / `formatInr(deliveryFeeCents)` or "FREE" at 0; last row border top 1 `line`, padding top 8, both `Text variant="h3"` 700 (`fontFamily(700)`): "To pay" / `formatInr(totalCents)`.

### Bar (below the `ScrollView`)

`SafeAreaView edges={['bottom']}` on `surface`, padding 12 16, `boxShadow: shadows.sheet.boxShadow`. One of:
- `blockReason(...)` gives a reason: `View` min height 52, `radius.card`, `canvas`, padding 12, centred; `Text` 600 `ink` centred, the reason.
- Otherwise the button: `Pressable accessibilityRole="button" accessibilityLabel="Place order" accessibilityState={{ busy, disabled: busy }}`, height 52, `radius.card`, `accent`, row space-between, centred, padding horizontal 16. Left `Text` 700 `onAccent` `tabular` `formatInr(totalCents)`; right, a row gap 4: `Text variant="button" tone="onAccent"` "Place order" and `ChevronRight` 16 `onAccent`; while busy, `ActivityIndicator color={colors.onAccent}` in place of that row.

### States (in place of the scroll and the bar; header kept)

Padding 12, gap 12:
- Signed in, no `view` yet: `Skeleton count={3}` (L1, label "Loading").
- No `view` and `isError`: `ErrorBanner error={error} onRetry={() => void refetch()}`.
- A `view` with no lines: `EmptyState` (level 2) `title="Your cart is empty"` `description="Add something from the store to place an order."` and `action` a column gap 8: `Button size="lg"` "Start shopping" → `router.navigate('/')`, `Button variant="secondary" size="lg"` "Your orders" → `router.navigate('/orders')`.

## Address card (`src/checkout-address.tsx`)

Card: `surface`, `radius.card`, padding 12, `shadows.card`, row gap 12, `alignItems: 'flex-start'`.
- Addresses not read yet: `Skeleton count={1}`; failed with nothing held: `ErrorBanner` with `refetch`.
- No address: column gap 8: `Text variant="h3" heading={2}` "No addresses yet", `Text tone="inkMuted"` "Add one to place the order.", `Button variant="secondary"` "Add address" → the address sheet.
- Otherwise: a 40 square `canvas` `radius.control` holding `MapPin` 20 `ink`; a column flex 1, gap 2: a row gap 8 wrapping: `Text variant="h3" heading={2}` "Delivering to <label>" and, when `refusedId` is this address, `Badge variant="warning"` "Not delivered here"; `Text tone="inkMuted"` `addressLine(address)`; then `Button variant="ghost" size="compact" accessibilityLabel="Change address"` "Change" → the choice sheet.

Choice sheet: `Sheet title="Choose address"` (L1). Body gap 12: `View accessibilityRole="radiogroup" accessibilityLabel="Deliver to"`, one row per address: `Pressable accessibilityRole="radio" accessibilityState={{ checked }} accessibilityLabel="Deliver to <label>"`, min height 44, padding 12, `radius.control`, border 1 (`accent` when checked, else `line`), row gap 12: a 20 circle (border 2, `accent` when checked with a 10 `accent` dot inside, else `lineStrong`; hidden from assistive technology); a column flex 1: a row gap 8 with `Text` 600 label, `Badge variant="accent"` "Default" when default, `Badge variant="warning"` "Not delivered here" when refused; `Text variant="small" tone="inkMuted"` `addressLine`. Pressing calls `onChoose(id)` and closes the sheet. After the group, `Button variant="secondary"` "Add address": closes the choice sheet, records the listed ids, opens the address sheet.

Address sheet: L1's `<AddressSheet open={adding} onClose={…} />` (no `address`: add mode). Its `onClose`: close it; then, if `useAddresses().data` holds an id not in the recorded ids, `onChoose(that id)` (design.md Decision 3). The card's "Add address" (no address) records the empty id list the same way.

## Screen state (task 4, task 5)

```ts
const [chosen, setChosen] = useState<string>()
const [busy, setBusy] = useState(false)
const sending = useRef(false)                     // the same-tick guard (L1's "sent once" lesson)
const [refusal, setRefusal] = useState<Refusal>()
const [refused, setRefused] = useState<{ addressId: string; listedAt: number }>()   // web's: badge until the list is read again
const [short, setShort] = useState<Record<string, number>>({})                      // task 5: product id → quantity when refused
```

`place()`: return when `sending.current` or no chosen address; set `sending.current`, busy, clear refusal, refused and short; `const result = await placeOrder(selected.id)`; `const outcome = outcomeOf(result, queryClient.getQueryData(cartKey(token)), storeName ?? 'The store', selected.id)`; `'to' in outcome` → `router.replace(outcome.to)` and return (stay busy); else clear `sending.current` and busy, set the refusal, `refused` when it names an address (with `addresses.dataUpdatedAt`), and (task 5) `short` from `outcome.productIds` and the cart now held. Choosing an address: `setChosen(id)` and drop the refusal when it names an address (web's `choose`). `refusedId` = `refused.addressId` while `refused.listedAt === addresses.dataUpdatedAt`. A line is marked while `short[product.id] === line.quantity`.
