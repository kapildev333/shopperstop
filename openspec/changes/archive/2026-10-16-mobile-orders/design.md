## Context

L1 (`mobile-foundation-accounts`, merged) gave `apps/mobile` its client, session, primitives, tabs and accounts; the Orders tab is a placeholder. The behaviour to mirror is `openspec/specs/web-app` (tracking, history, cancel, rider card), already implemented in `apps/web/src/orders.ts`, `order-tracking.tsx` and `order-parts.tsx`, which the workers copy from. The screens are artboards 6, 15 and 16 of the design canvas (D36), translated for the workers in `docs/design/mobile-P4-L4a.md`, which also holds the module interfaces. L2 runs in parallel and owns every shared file (D42); this change touches none.

### web-app requirements mirrored

| mobile-app requirement | mirrors web-app | differs |
|---|---|---|
| Mobile order history | Customer order history | whole card is the link; canvas layout; placed time wording; no thumbnails (Decision 11) |
| Mobile order placed time | (web prints `Intl` medium date) | canvas wording "Today, 10:02", no `Intl` |
| Mobile order history signed out | Customer checkout and order pages require sign-in | a prompt, not a redirect: a tab that redirects loops on Back (Decision 4) |
| Mobile order history states | Customer order history states | canvas copy; `ErrorBanner` offline/server copy (L1) |
| Mobile order history read again on return | (none: a web page remounts on every visit) | tabs stay mounted (Decision 4) |
| Mobile order tracking screen | Customer order tracking page | canvas order of cards; "Need help?" |
| Mobile order products and address | Customer order tracking page | canvas rows; no Subtotal row; "Pay on delivery" |
| Mobile order tracking states | Customer order tracking page (Unknown order), Customer pages keep data when a refetch fails | artboard 19 copy |
| Mobile order tracking requires sign-in | Customer checkout and order pages require sign-in | none |
| Mobile order status names | Customer order status names | none (D28) |
| Mobile order status message | Customer order status message | lives in the brand header |
| Mobile order headline | Customer order countdown | "N min" short form and "Running late", "Delivered", "Cancelled" headlines (canvas) |
| Mobile order timeline, Mobile cancelled order timeline | Customer order tracking page ("Status history") | six fixed steps with future steps muted (canvas) instead of a list of events |
| Mobile timeline names the rider | Customer status history names the rider | none |
| Mobile order tracking poll | Customer order tracking poll | background pause: Decision 8 |
| Mobile order cancel, Mobile order cancel sent | Customer order cancel | optional reason sent as `reason` (canvas); chips, not radios (Decision 6) |
| Mobile order rider card, Mobile rider last seen | Customer order rider card, Customer rider last seen | "Your rider" heading instead of a region; Maps opened through `Linking` |
| Mobile order rider read | Customer order rider read | absolute URL from `EXPO_PUBLIC_RIDER_URL` (no proxy) |
| Mobile orders end-to-end suite | Customer site end-to-end suite with axe | orders made through core's API; rider card through the seeded `riderName` only (Decision 9) |

## Goals / Non-Goals

**Goals:** history, tracking, cancel and the rider card on the phone, behaving as on web, built from the canvas; every scenario tested; nothing in a shared file.

**Non-Goals:** checkout and placing (L4b); product thumbnails on history cards; paging past 24 orders; a help route; push notifications; native e2e.

## Decisions

### 1. Files

```
apps/mobile/src/
  orders.ts                 types, status vocabulary, wording helpers, queries, cancel (T1)
  orders.test.ts
  rider.ts                  rider client, delivery read, lastSeen, mapsUrl (T2)
  rider.test.ts
  app/(tabs)/orders.tsx     the Orders tab (replaces L1's placeholder) (T3)
  orders-history*.test.tsx
  app/orders/[id].tsx       route: reads `id`, renders <OrderTracking id={id} /> (T4)
  orders-tracking.tsx       OrderTracking, Headline, Timeline (T4)
  orders-tracking*.test.tsx
  rider-card.tsx            RiderCard (T5)
  rider-card.test.tsx
  orders-cancel.tsx         CancelOrderDialog (T6)
  orders-cancel.test.tsx
apps/mobile/e2e/orders.spec.ts (T8)
```

All match the lane's scope (`src/orders*`, `src/rider*`, `src/app/(tabs)/orders.tsx`, `src/app/orders/`, `e2e/orders.spec.ts`). `/orders` resolves to the tab and `/orders/<id>` to the stack route outside the tabs, pushed on the root `Stack` (no layout change). Interfaces are in `docs/design/mobile-P4-L4a.md` §5.

### 2. Logic copied from web, not shared

`orders.ts` is `apps/web/src/orders.ts` without placement and the cart, plus the mobile wording helpers. Sharing through `packages/ui` would be a ui lane for ~100 lines that two apps already diverge on (wording, React Native hooks); copying is the smaller change. Ceiling: a rule change in one app must be made in the other by hand; move the pure helpers to `@shopperstop/ui/format` if a third client appears.

### 3. Rider client

`rider.ts` builds a second `openapi-fetch` client on `${process.env.EXPO_PUBLIC_RIDER_URL ?? 'http://localhost:8081'}/api/rider/v1` with `paths` from `@shopperstop/ui/api/rider` and L1's `authMiddleware` (bearer, envelope rewrite, 401 to the current token ends the session, as web does: the rider service answers 401 only when core does not know the token). The env is read with dot access so Expo inlines it. On a phone, `EXPO_PUBLIC_RIDER_URL=http://<lan-ip>:8081` (README line, request to L5a). Tests fake it with L1's `fakeCore`: its path rewrite strips only `/api/core/v1`, so a rider route is keyed by its full path, `'GET /api/rider/v1/orders/<id>/delivery'`. No change to `fake-core.ts`.

### 4. Orders tab

- Signed out: a prompt with "Sign in" (`router.push('/sign-in?returnTo=%2Forders')`), not `<Redirect>`: a tab that redirects sends Back from sign-in straight to sign-in again.
- Read again on return: tabs stay mounted, so the list would show old statuses after the tracking screen saw new ones. `useFocusEffect` from `expo-router` calls `refetch()` on every focus after the first (a `useRef` skips the first, which the mount's read covers). A failed refetch keeps `data` (L1 Decision 10), so no alert.
- The list is a `ScrollView` of cards, not a `FlatList`: at most 24 cards (the first page, as web). Ceiling: paging and virtualisation when "Load more" arrives.
- The tab uses `useFocusEffect`, so its tests render through `renderRouter` (`initialUrl: '/orders'`); a file whose tests do not navigate may hold several, one navigating test per file (L1 Decision 18).

### 5. Tracking screen

- `OrderTracking({ id })` in `orders-tracking.tsx`; the route file only reads the param. Non-navigating tests render `<OrderTracking id=… />` inside `QueryClientProvider` like L1's account tests; navigating ones use `renderRouter` one per file.
- With no token: `<Redirect href={`/sign-in?returnTo=${encodeURIComponent(`/orders/${id}`)}`} />`, as `account.tsx`.
- `useOrder(id)` is web's `orderOptions` (404 is `null`, the poll from `pollInterval`, no `staleTime`).
- Status message: one `Text` with `role="status"` and `accessibilityLiveRegion="polite"`, rendered for every status so the element stays. The headline sits outside it (a minute changing is not announced). Ceiling: iOS VoiceOver ignores live regions; `AccessibilityInfo.announceForAccessibility` on a status change is the upgrade.
- Headline and "Last seen" read `useNow()` (Date.now() every second, web's hook). Ceiling: a re-render per second while the screen is open; a 15 s tick is enough for minute wording if it ever shows in a profile.
- Times use `getHours()`/`getMinutes()` padded, and month names from a 12-entry array, not `Intl`: deterministic in Jest and on Hermes (L1 risk), and the canvas wording needs no locale. Ceiling: English month names only.

### 6. Cancel dialog

- A `Dialog` primitive (centered card, Cancel first) does not exist in `src/ui/` and is L2's (Change store?). Requested with the API in "Requests" below: `Dialog({ open, title, onClose, children })`, the same props as `Sheet`. T6 uses it if it is on the lane branch when T6 starts; otherwise T6 uses `Sheet` (same props, same `role="dialog"` and title name on the web export) and the swap later is the import line. Either passes the scenarios (they query the dialog by its title and buttons).
- Reason: four `Chip`s (L1 primitive, a button with `selected` state) in a wrapping row under "Reason (optional)"; pressing the selected chip clears it. The canvas draws radios; a radio primitive would be new, and chips are the app's existing single-choice control (address labels). Ceiling: screen readers announce "selected button", not "radio, 1 of 4".
- Confirm is `Button variant="danger"` (outlined, red label), not the canvas's filled red: no filled-danger variant exists, and "Keep order" stays visually distinct (secondary, ink label). Ceiling: add a `destructive` variant in `src/ui/button.tsx` (L2's file) if the owner wants the canvas look.
- One send while pending: the confirm button's `loading` disables it, plus a `useRef` guard as L1 Decision 16.
- `postCancel(id, reason?)` sends `{ reason }` or `{}` (core refuses an empty body); `cancelOrder` is web's (cache the answered order, invalidate the list, re-read on 409).

### 7. Rider card

Web's `RiderCard` in React Native: a `Card` with the heading "Your rider" (level 2), avatar initial on `brand`, name, status `Badge`, "Last seen …" and an "Open in Maps" `Button` (secondary, compact, `MapPin`) calling `Linking.openURL(mapsUrl(lat, lng))`. Tests spy `Linking.openURL` (the device is the process boundary, like the secure store in L1). The canvas has no rider card; its card pattern is used (docs/design §3).

### 8. Poll and the background

TanStack Query's `refetchInterval` pauses only while its `focusManager` says unfocused; on iOS and Android nothing tells it, so it counts the app as always focused. iOS suspends JavaScript in the background, so the poll stops there anyway; Android may poll a little longer. Ceiling accepted; the fix is TanStack's documented `focusManager` + `AppState` wiring in the root layout (L2's file), listed as an optional request.

### 9. e2e

- `e2e/orders.spec.ts` holds its helpers inline (adapted from `apps/web/e2e/shopper.ts`: register, address, `orderPick`, cart line, place, staff sign-in and status moves) against `http://localhost:18080/api/core/v1`, and signs the browser in with `page.addInitScript` writing the token under `shopperstop.customer-token` (L1's key).
- Product picks use indices 0 and 1 of web's `orderPick` rule (stock exactly 10, price at least ₹20, page 2); the suite's global setup reseeds core, so no other mobile file shares that stock today. L4b's checkout e2e should take indices 2 and up.
- The rider service is not started by the mobile Playwright config, so the e2e sees the rider card only through the seeded `riderName` "Arjun Rao" on `SS-DEMOAAAB`, and the rider read fails silently (which is itself the "failed rider read keeps the card" behaviour). Location and Maps are covered by Jest. Ceiling: add the rider web server to `playwright.config.ts` (L2's file) when the §13 flow (L5b) needs a live rider.
- The export bakes `EXPO_PUBLIC_RIDER_URL`; under `make e2e` it must be `http://localhost:18081` (request to L2: `package.json` `e2e` script). With the default 8081, a developer's running `make dev` rider would answer 401 for the e2e token and end the session mid-test.
- Every scenario reaches its order from the Orders tab, never by loading `/orders/<id>` directly. T8 found that `expo serve` answers 404 for a dynamic route on the static export (the export writes a literal `orders/[id].html` and the server has no fallback); manager decision 2026-10-16. The web export is only the e2e target (D42), not a product surface; on a phone the route is reached in-app or by an Expo Router deep link. Ceiling: dynamic routes are not directly loadable on the static export, and native deep links into an order are untested; both go to the backlog (a serve fallback or `generateStaticParams` cannot cover runtime ids; device deep links come with the native e2e ceiling of D37).
- Dialogs: wait for `getByRole('dialog')` before axe (L1 Decision 8).

### 10. Tab bar landmark (manager scope extension, 2026-10-16)

T8's axe run on the Orders tab failed `region`: React Navigation's tab bar renders its labels outside any landmark. The canvas wraps the tab bar in `<nav aria-label="Main">`. `src/app/(tabs)/_layout.tsx` (L2's shared file; the manager extended this lane's scope to this one change and resolves any merge) passes `Tabs` a `tabBar` that wraps the router's own `BottomTabBar` in `<View role="navigation" accessibilityLabel="Main">`. `BottomTabBar` comes from `expo-router/js-tabs`, a public entry of the installed `expo-router`, so no dependency is added; the bar keeps its roles, selected state, safe area and styling. The wrapper is not `accessible` (that would merge the tabs into one element on iOS).

### 11. Canvas deviations

- History badges follow D28 (`accent`, `success`, `neutral`), not the canvas's warning/success/danger fills.
- No product thumbnails on history cards: the served image path needs core's origin, a helper L2 builds for the catalog; follow-up once it is on main.
- The header's second line is the status message (web's sentences, announced), not the canvas's step label, which the timeline already shows.
- No city in the address (core stores none).
- Totals in `ink`, as the canvas draws them; `Price` (L2) is not waited for: amounts are `Text tabular` with `formatInr`. Swap to `Price` when it lands if it differs.

## Requests

- to mobile-P4-L2 (shared files), via the manager:
  1. `src/ui/dialog.tsx`: `Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode })`, a React Native `Modal` (transparent, `animationType="fade"`, `onRequestClose={onClose}`, `accessibilityLabel={title}`) with a backdrop of `ink` at 50 % that does not close it, a centered panel 16 px from the sides (`surface`, `radius.card`, `shadows.sheet.boxShadow`, padding 20, gap 16), the title as `Text variant="h2" heading={2}`, then `children`; and `DialogFooter({ children })`, a row with gap 12 whose children each take `flex: 1`, Cancel first by convention. Needed by T6 (fallback `Sheet`, Decision 6).
  2. `package.json` `e2e` script: add `EXPO_PUBLIC_RIDER_URL=http://localhost:18081` next to `EXPO_PUBLIC_CORE_URL`. Needed before T8.
  3. Optional: `focusManager` + `AppState` wiring in `src/app/_layout.tsx` (Decision 8).
- to mobile-P4-L5a: the README device notes add `EXPO_PUBLIC_RIDER_URL=http://<lan-ip>:8081` beside `EXPO_PUBLIC_CORE_URL`.
- to core, to rider: none. Contract audit below.

## Contract audit (D42)

Every field and route these screens use exists on main: `GET /orders` (`OrderList`: `items[]` of full `Order`, `total`), `GET /orders/{id}` (404 for another customer's), `POST /orders/{id}/cancel` with `OrderCancel.reason` (optional, at most 500) answering 409 `conflict`; `Order.number`, `status`, `promisedMinutes` (the order's own), `placedAt`, `deliveredAt`, `cancelReason`, `riderName`, `deliveryFeeCents`, `totalCents`, `address` (`label`, `line1`, `line2`, `pincode`), `items[]` (`name`, `quantity`, `priceCents`, `imageUrl`), `events[]` (`toStatus`, `actorType`, `actorName`, `createdAt`). Rider `GET /orders/{orderId}/delivery` takes the customer's core bearer (it asks core whether the order is theirs) and answers `CustomerDelivery` (`riderName`, `status`, `location` with `recordedAt`) or 404. Core and rider accept the origins 5176 and 15176 (Makefile dev and e2e). Seed: `SS-DEMOAAAB` carries `riderName` "Arjun Rao" and rider events. Gaps: none. Note: canvas tracking shows a city ("Bengaluru") that core does not store; dropped, not requested.

## Scenario to test

| Scenario | Test file: test name | Task |
|---|---|---|
| Placed time wording; Status names and badges; Headline wording; Poll interval follows the status | `src/orders.test.ts`: the scenario names | 1 |
| Default rider URL; Rider read follows the status; Last seen wording | `src/rider.test.ts`: the scenario names | 2 |
| History lists orders; Signed-out Orders tab; Orders loading; No orders yet; Orders fail to load | `src/orders-history.test.tsx`: the scenario names | 3 |
| Card opens the order | `src/orders-history-open.test.tsx` | 3 |
| Sign in from the Orders tab | `src/orders-history-sign-in.test.tsx` | 3 |
| Start shopping opens Home | `src/orders-history-start.test.tsx` | 3 |
| Statuses current on return | `src/orders-history-return.test.tsx` | 3 |
| Failed read on return keeps the list | `src/orders-history-return-failed.test.tsx` | 3 |
| Tracking shows the order; Finished order labels; Unknown order; Tracking loading; Tracking fails with nothing held; Status change announced in place; Cancelled order shows the reason; Timeline of a packing order; Timeline of a cancelled order; Rider steps name the rider; Failed poll keeps the order; Headline kept current | `src/orders-tracking.test.tsx`: the scenario names | 4 |
| Signed-out tracking redirect | `src/orders-tracking-redirect.test.tsx` | 4 |
| Need help opens the account | `src/orders-tracking-help.test.tsx` | 4 |
| Your orders from an unknown order | `src/orders-tracking-not-found.test.tsx` | 4 |
| Rider on the way with a position; Rider without a position; No rider card before a rider; Delivered order names the rider from the rider read; Failed rider read keeps the card | `src/rider-card.test.tsx`: the scenario names | 5 |
| Cancel dialog contents; Keep order; Order cancelled without a reason; Cancel refused | `src/orders-cancel.test.tsx`: the scenario names | 6 |
| Cancel offered while placed or accepted; Order cancelled with a reason | `src/orders-tracking-cancel.test.tsx`: the scenario names | 7 |
| Tab bar in a navigation landmark | `src/tabs-landmark.test.tsx`: `tab bar in a navigation landmark` | 8.0 |
| History and a delivered order against core; Tracking follows the order against core; Cancel against core | `e2e/orders.spec.ts`: the scenario names | 8 |

## Risks / Trade-offs

- [Expo Router: `(tabs)/orders.tsx` beside `orders/[id].tsx`] -> expected to resolve `/orders` to the tab and `/orders/<id>` to the stack route; T3's "Card opens the order" proves it. If it does not, the worker stops and reports (fallback: the tracking route under `order/[id]`, a spec change).
- [Static export of a dynamic route] -> not directly loadable (Decision 9); accepted as a ceiling.
- [Rider 401 ends the core session] -> only with a misconfigured rider URL; request 2 closes it for e2e.
- [Fake timers with TanStack Query] -> only `Headline` is tested under fake timers, rendered alone with props, no query (T4 brief).
- [Parallel with L2] -> no shared file is edited; if L2 restyles `Card`, `Badge` or `ErrorBanner`, these screens follow without change.

## Acceptance (9.1, 2026-10-16)

`/opsx:verify` at `8c7a160` (origin/main merged in), after the manager's `npm ci`:
- Gates: ui build, mobile lint, typecheck exit 0; `npm run test --workspace apps/mobile -- --run` 41 suites, 154 tests passed; `npm run build --workspace apps/mobile` exit 0; `openspec validate --all --strict` 20 passed. `make e2e` per T8 (exit 0: admin 15, mobile 7, rider 7, web 45); the manager re-runs it in 9.2.
- Scenarios: all 47 map to a test of the same name in the file this table names (checked by script against the `test`/`it` names).
- Tasks: 1 to 8.2 ticked.
- Scope: everything is inside the lane's paths except the two manager-approved extensions: `apps/mobile/package.json` `e2e` script, one line adding `EXPO_PUBLIC_RIDER_URL=http://localhost:18081` (`d4a613f`, the text requested from L2), and `src/app/(tabs)/_layout.tsx` the `tabBar` landmark wrapper only (`32e1626`, Decision 10) with its test `src/tabs-landmark.test.tsx`.
- Cancel uses the `Sheet` fallback (`src/orders-cancel.tsx` imports `Sheet as Dialog`), Decision 6.

## Deferred

- Swap `Sheet` for `Dialog` in `src/orders-cancel.tsx` once L2's `src/ui/dialog.tsx` is on main (the one import line; same props).
- History thumbnails (artboard 15) once L2's catalog image URL helper is on main (Decision 11).
- Direct load of `/orders/<id>` on the static web export (404, Decision 9): backlog.
- Native deep links into an order: untested; with D37's native e2e ceiling, backlog.
- Optional: TanStack `focusManager` + `AppState` wiring in the root layout so the poll pauses in the Android background (Decision 8).
- iOS VoiceOver does not announce the status live region; `AccessibilityInfo.announceForAccessibility` is the upgrade (Decision 5).
