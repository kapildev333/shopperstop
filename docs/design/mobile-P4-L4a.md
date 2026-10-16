# mobile-P4-L4a - mobile-orders: design translation for workers

Workers cannot open the design canvas. This file carries what artboards 6 (Order tracking), 15 (Orders history), 16 (Cancel order dialog), 18 (Loading) and 19 (Error) say, in token names, plus the module interfaces. The OpenSpec change `openspec/changes/mobile-orders/` is normative; this file is how to draw it. Colours only from `colors.*` in `src/ui/tokens.ts` (camelCase token names), never hex. Text through `src/ui/text.tsx` (`variant`, `tone`, `heading`, `tabular`); a 600 or 700 weight on a `body` text is `style={{ fontFamily: fontFamily(600) }}`. Spacing in px below is the canvas's.

## 1. Orders tab (artboard 15), `src/app/(tabs)/orders.tsx`

- Root `View role="main"`, `flex: 1`, background `canvas`. `<Head><title>Your orders · ShopperStop</title></Head>` (as L1's placeholder).
- Header (keep L1's): `SafeAreaView edges={['top']}` on `surface`; inner row height 64, `paddingHorizontal: 16`, bottom border 1 `line`; `Text variant="h2" heading={1}` "Your orders".
- List: `ScrollView`, `contentContainerStyle` padding 12, gap 12.
- Card = `Pressable accessibilityRole="link" accessibilityLabel={"View order " + number}`, `surface`, `radius.card`, padding 14, `boxShadow: shadows.card.boxShadow`, gap 10, `minHeight: 44`. `onPress`: `router.push('/orders/' + id)`.
  - Row 1 (`flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'center'`, gap 8): `Text variant="button" tabular` number (14/20 600, `ink`); `Badge variant={statusVariant(status)}` with `statusName(status)`.
  - Row 2 (canvas thumbnails, 44 px squares): not built (design.md Decision 10).
  - Row 3 (row, space-between, centered): `Text tone="inkMuted" tabular` "`placedLabel(placedAt, now)` · `itemCountLabel(order)`" (for example "Today, 10:02 · 4 items"); `Text variant="button" tabular` `formatInr(totalCents)` (600, `ink`).
- After the cards, when `total > items.length`: `Text variant="small" tone="inkMuted"`, centered, "Showing your latest N orders.".
- Empty (`items.length === 0`): centered column, `paddingTop: 120`, using L1's `EmptyState` with `title="No orders yet"`, `description="Your past and current orders show up here."`, `icon` = an 88×88 `View` (`radius.pill`, `surface`, centered, `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`) holding `ReceiptText` size 40 colour `ink`, and `action` = `Button size="lg"` "Start shopping" → `router.navigate('/')`.
- Signed out: `EmptyState title="Sign in to see your orders"` with `action` `Button size="lg"` "Sign in" → `router.push('/sign-in?returnTo=%2Forders')`. No query runs (`enabled: !!token`).
- Loading: `Skeleton count={3}` inside the list padding. Error with nothing held: `ErrorBanner error onRetry={() => void refetch()}` inside the list padding.

## 2. Tracking (artboard 6), `src/orders-tracking.tsx`

Root `View role="main"`, `flex: 1`, background `canvas`; `ScrollView` with `contentContainerStyle={{ paddingBottom: 32 }}`. `<Head><title>{`Order ${number} · ShopperStop`}</title></Head>`.

- Header: `SafeAreaView edges={['top']}` background `brand`; inner padding top 8, sides 8, bottom 24.
  - Row (row, centered, gap 4): `IconButton label="Back" icon={ChevronLeft} tone="onBrand" onPress={useBack()}`; `Text variant="button" tone="onBrand" heading={1} tabular` "Order SS-XXXXXXXX".
  - Block (padding top 8, sides 12, gap 4):
    - Headline `Text variant="display" tone="onBrand"`: `headline(order, now)`.
    - Status `Text tone="onBrand" role="status" accessibilityLiveRegion="polite" style={{ fontFamily: fontFamily(600) }}`: `statusMessage(order)`. One element for every status; never conditionally swapped.
- Cards below: each `Card` (L1) wrapped in a `View` with margins: the first (timeline) `marginTop: -12, marginHorizontal: 12`; the others `marginTop: 12, marginHorizontal: 12`. Order: timeline, rider card (T7 mounts it), products, address.
- Timeline card ("Order status"): `Text variant="h3" heading={2}` "Order status", `marginBottom: 12`. Then one row per `timeline(order)` step: row, gap 12.
  - Rail (width 20, centered, `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`): dot 20×20, `borderRadius: 10`, `borderWidth: 2`; `done`: background `accent`, border `accent`, `Check` size 12 colour `onAccent` strokeWidth 3.5 inside; `current`: background `surface`, border `accent`; `future`: background `surface`, border `lineStrong`. Under the dot (not on the last step) a connector `width: 2, flex: 1, minHeight: 20`, colour `accent` when this step is `done`, else `line`.
  - Text column `paddingBottom: 14`: label `Text` (`current` → `fontFamily(700)`; `future` → `tone="inkMuted"`); time `Text variant="small" tone="inkMuted" tabular` when present; actor line `Text variant="small" tone="inkMuted"` when present ("Picked up by Asha").
- Products card: gap 8. `Text variant="h3" heading={2}` "`productCountLabel(order)` · Cash on delivery". Rows (row, space-between): `Text` "2 × Toned milk" and `Text tabular` `formatInr(priceCents * quantity)`. "Delivery fee" row: amount or "Free". Total row: `borderTopWidth: 1`, `borderTopColor: line`, `paddingTop: 8`, both texts `fontFamily(700)` tabular: "Pay on delivery" while `underWay`, else "Total"; `formatInr(totalCents)`.
- Address card: gap 2. `Text variant="h3" heading={2}`: "Delivering to <label>" while `underWay`, else "Address: <label>". `Text tone="inkMuted"`: `[line1, line2, pincode].filter(Boolean).join(', ')`.
- Cancel (T7): when `canCancel(status)`, `View` `marginTop: 16, marginHorizontal: 12` holding `Button variant="danger" size="lg"` "Cancel order".
- "Need help?": `View` `marginTop: 12, marginHorizontal: 12` holding `Button variant="ghost"` "Need help?" → `router.push('/account')`.
- States (header is a plain white bar like the Orders tab's: `surface`, height 64, bottom border `line`, `IconButton` "Back" + `Text variant="h2" heading={1}`):
  - Loading: title "Your order", then `Skeleton count={3}` with padding 12.
  - Error, nothing held (artboard 19): title "Your order", padding 12, gap 12: `ErrorBanner error onRetry`, then centered `Text tone="inkMuted"` "Your order is safe. We just couldn't load its latest status.".
  - Not found (`data === null`): title "Order not found", padding 12, gap 12: `Text tone="inkMuted"` "This order is not in your account.", `Button size="lg"` "Your orders" → `router.navigate('/orders')`.

## 3. Rider card (no artboard), `src/rider-card.tsx`

Built from the canvas's card pattern. Renders nothing unless `riderStage(order.status)` and a name is known (`order.riderName ?? delivery?.riderName`). `Card` with gap 12:
- Row (row, centered, gap 12): avatar 40×40, `radius.pill`, background `brand`, initial `Text variant="h3" tone="onBrand"`, hidden from accessibility; column (flex 1): `Text variant="small" tone="inkMuted" heading={2}` "Your rider", `Text variant="h3"` name, and when `delivery?.location`: `Text variant="small" tone="inkMuted"` `lastSeen(recordedAt, now)`; then `Badge variant={statusVariant(order.status)}` `statusName(order.status)`.
- When `delivery?.location`: `Button variant="secondary" size="compact" icon={MapPin}` "Open in Maps" → `Linking.openURL(mapsUrl(lat, lng))`.

## 4. Cancel dialog (artboard 16), `src/orders-cancel.tsx`

`CancelOrderDialog({ order, open, onClose })` inside `Dialog` (requested from L2) or, until it exists, `Sheet` (L1), with `title="Cancel this order?"`. Content, gap 16:
- `Text tone="inkMuted"`: "Order SS-XXXXXXXX hasn't been packed yet, so you can still cancel it. Nothing has been charged." (straight apostrophe).
- Reason: `Text style={{ fontFamily: fontFamily(600) }}` "Reason " + nested `Text tone="inkMuted"` "(optional)" (one text node reading "Reason (optional)"); then a wrapping row (`flexDirection: 'row', flexWrap: 'wrap', gap: 8`) of four `Chip`s: "Ordered by mistake", "Want to change items", "Delivery is taking too long", "Other"; `selected={reason === label}`, press toggles (`setReason(reason === label ? undefined : label)`).
- Alert when a refusal is held: `Text tone="danger" accessibilityRole="alert"`.
- Footer (row, gap 12, each child `flex: 1`; `DialogFooter` when it exists): `Button variant="secondary" size="lg"` "Keep order" (`onClose`, clears the alert and reason), then `Button variant="danger" size="lg" loading={busy}` "Cancel order" (confirm).

## 5. Module interfaces

```ts
// src/orders.ts (T1). Copy from apps/web/src/orders.ts where marked "web".
import type { BadgeVariant } from './ui/badge'
export type Order = components['schemas']['Order']            // from '@shopperstop/ui/api'
export type OrderStatus = Order['status']
export type OrderList = components['schemas']['OrderList']
export type OrderResult = { order?: Order; error?: ApiError }
export const ordersKey: (token: string) => readonly ['orders', string]            // web
export const orderKey: (token: string, id: string) => readonly ['order', string, string] // web
export function statusName(s: OrderStatus): string                                 // web
export function statusVariant(s: OrderStatus): BadgeVariant                        // web
export function statusMessage(o: Order): string                                    // web
export function underWay(s: OrderStatus): boolean                                  // web
export function canCancel(s: OrderStatus): boolean                                 // web
export function pollInterval(o: Order | null | undefined): number | false          // web
export function headline(o: Order, now: number): string   // "Arriving in N min" | "Running late" | "Delivered" | "Cancelled"
export function clockTime(iso: string): string            // "09:05", local, getHours/getMinutes padded
export function placedLabel(iso: string, now: number): string // "Today, 10:02" | "12 Oct, 19:40" | "4 Oct 2025, 21:05"
export function itemCountLabel(o: Order): string          // "1 item" | "N items" (sum of quantities)
export function productCountLabel(o: Order): string       // "1 product" | "N products" (lines)
export type Step = { label: string; time?: string; actor?: string; state: 'done' | 'current' | 'future' }
export function timeline(o: Order): Step[]
export function useNow(): number                                                   // web (1 s)
export function useOrders(): UseQueryResult<OrderList>                             // web
export function orderOptions(token: string, id: string)                            // web
export function useOrder(id: string): UseQueryResult<Order | null>                 // web
export function postCancel(id: string, reason?: string): Promise<OrderResult>      // web + reason: body reason ? { reason } : {}
export function cancelOrder(id: string, reason?: string): Promise<OrderResult> // web (without the `send` parameter), passes reason on

// src/rider.ts (T2)
export type Delivery = RiderComponents['schemas']['CustomerDelivery']  // from '@shopperstop/ui/api/rider'
export const riderUrl: string                       // `${process.env.EXPO_PUBLIC_RIDER_URL ?? 'http://localhost:8081'}/api/rider/v1`
export const riderApi                               // createClient<RiderPaths>({ baseUrl: riderUrl, fetch: (r) => globalThis.fetch(r) }) + authMiddleware
export const deliveryKey: (token: string, orderId: string) => readonly ['delivery', string, string]
export function riderStage(s: OrderStatus): boolean // out_for_delivery | delivered
export function deliveryOptions(token: string, orderId: string, status: OrderStatus) // enabled riderStage && token; refetchInterval 10_000 only on out_for_delivery; 404 -> null
export function useDelivery(orderId: string, status: OrderStatus): UseQueryResult<Delivery | null>
export function lastSeen(recordedAt: string, now: number): string  // web
export function mapsUrl(lat: number, lng: number): string           // `https://www.google.com/maps?q=${lat},${lng}`
```

`timeline(o)` rules: not cancelled → the six steps of `['placed','accepted','packing','ready','out_for_delivery','delivered']`; `at` = index of `o.status`; step `i` is `done` when `i < at` or the order is delivered, `current` when `i === at` and not delivered, else `future`; `time` = `clockTime` of the last event whose `toStatus` is that step, for steps not `future`; `actor` per "Mobile timeline names the rider". Cancelled → one step per event, oldest first, label from the same table plus `cancelled: 'Cancelled'`, all `done` except the last, `current`. `rider.ts` does not import `orders.ts` (T1 and T2 run in parallel): it declares its own `OrderStatus` from `@shopperstop/ui/api`.

## 6. Test recipes

- Order fixtures are full `Order` objects (every required field: `id`, `number`, `storeId`, `storeName`, `promisedMinutes`, `status`, `customerName`, `address`, `subtotalCents`, `deliveryFeeCents`, `totalCents`, `paymentMethod: 'cod'`, `placedAt`, `items`, `events`); local times are built as `new Date(2026, 9, 16, 10, 2).toISOString()` so the expected "10:02" holds in any time zone.
- Core routes in `fakeCore` keys: `'GET /orders'`, `` `GET /orders/${id}` ``, `` `POST /orders/${id}/cancel` ``. Rider: `` `GET /api/rider/v1/orders/${id}/delivery` `` (full path; design.md Decision 3). A test that wants core unreachable for a later read swaps `globalThis.fetch` to reject `TypeError('Network request failed')`.
- Await every `render`, `renderRouter` and `fireEvent` (RNTL 14). One navigating `renderRouter` test per file; navigating tests mock `@expo-google-fonts/inter` `useFonts` as `src/account-home.test.tsx` does and pass `${__dirname}/app`.
- Re-reads in a test: `await act(() => queryClient.refetchQueries({ queryKey: [...] }))` rather than waiting 10 s.
- "Headline kept current": render a `Headline` component on its own (props `order`), `jest.useFakeTimers({ now: <fixed> })` before render, `await act(() => jest.advanceTimersByTime(60_000))`, then `jest.useRealTimers()`. No query in that test.
- `Linking.openURL`: `jest.spyOn(Linking, 'openURL').mockResolvedValue(true)`; restore after.
- Body check: `await calls.at(-1)!.clone().json()` from `fakeCore`'s returned list.
