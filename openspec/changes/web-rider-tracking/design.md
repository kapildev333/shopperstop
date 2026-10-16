# Design: web-rider-tracking

## Context

Checked on 2026-10-15 against `origin/main` c20b72b: `services/core/openapi.json`, `services/rider/openapi.json`, `packages/ui/src/api/{core,rider}.d.ts`, `packages/ui/src/{image-tile,choice-group,chip,visually-hidden,button}.tsx`, `openspec/specs/{web-app,orders,deliveries}`, `services/core/internal/seed/seed.go`, `services/rider/internal/seed/seed.go`, the Makefile's `E2E_ENV` and `e2e` target, and `apps/web` (`api.ts`, `orders.ts`, `order-parts.tsx`, `order-tracking.tsx`, `checkout.tsx`, `product-card.tsx`, the tests, `vite.config.ts`, `playwright.config.ts`, `e2e/`).

- **Rider read.** `GET /api/rider/v1/orders/{orderId}/delivery` with the customer's core bearer answers 200 `{riderName, status: assigned|delivered, location?: {lat, lng, recordedAt}}`; `location` only while `assigned` and after the rider put a position. 404 for another customer's order, an order with no delivery, a non-uuid; 401 when core refuses the bearer. A rider's claim is what moves the core order to `out_for_delivery`, so before that status there is never a delivery.
- **Seeds disagree on purpose.** Core's demo order `...0701` (SS-DEMOAAAB) is `delivered` by staff events and has no `rider_name`; the rider seed holds delivery `...0901` for it by Arjun Rao (`...0801`), `delivered`, no location. So against the demo seeds `Order.riderName` is absent and only the rider read names the rider. Hence the name rule below (Decision 3).
- **Middleware.** `api.ts` › `authMiddleware` sets the bearer from `getToken()`, drops the token on any 401, and turns a failed answer without the error envelope into `unreachable`. It is not core-specific and is reused as is.
- **Promise.** `Order.promisedMinutes` and `Order.storeName` are required on every order read (core-P3-L2, frozen at placement); `test-data.ts` › `order()` already carries both (`promisedMinutes: 10`).
- **ui swaps.** `ImageTile` in ui equals the app's copy except: `alt` is required, there is no `w-full`, there is `shrink-0` and a `className`. `ChoiceGroup label value onChange` renders `role="radiogroup"`; `Choice value` renders `role="radio"` with `aria-checked`, roving `tabIndex`, arrow keys that move and choose; styled by `chipClass`, the same classes `Chip` uses. axe-core 4.14 declares no required owned roles for `radiogroup`, so a `<ul>` inside it is allowed.
- **e2e.** `make e2e` resets both seeds, builds every workspace, then runs each workspace's `e2e` with `E2E_ENV` (rider on `:18081`, `shopperstop_rider_e2e`, core URL `:18080`, the rider service token). The web global setup resets only core today.

## Decisions

### 1. One more `openapi-fetch` client, in `api.ts`

```ts
import type { paths as RiderPaths } from '@shopperstop/ui/api/rider'

// The rider service, same origin (/api/rider is proxied like /api/core), with the customer's core token and the same middleware.
export const riderApi = createClient<RiderPaths>({
  baseUrl: `${location.origin}/api/rider/v1`,
  fetch: (request) => globalThis.fetch(request),
})
riderApi.use(authMiddleware)
```

A 401 from the rider service drops the token, as from core: the rider service answers 401 only when core refused that same bearer (its own service-token failures are 502 by the `deliveries` spec). Ceiling: a rider service that wrongly answers 401 signs the customer out; then the client gets its own middleware without the 401 line.

### 2. The read: `deliveryOptions` and `useDelivery` in `orders.ts`

```ts
import type { components as RiderComponents } from '@shopperstop/ui/api/rider'
import { api, call, queryClient, riderApi, type ApiError } from './api'

export type Delivery = RiderComponents['schemas']['CustomerDelivery']
export const deliveryKey = (token: string, orderId: string) => ['delivery', token, orderId] as const

// A rider's claim is what moves an order out for delivery: before that there is no delivery to read.
export function riderStage(status: OrderStatus): boolean {
  return status === 'out_for_delivery' || status === 'delivered'
}

// From out for delivery on: every 10 s with the order while it is out (pollInterval), once when delivered.
// 404 (no rider claimed it, or not this customer's) is null, "no rider"; any other failure throws and keeps what is held.
export function deliveryOptions(token: string, order: Order) {
  return queryOptions({
    queryKey: deliveryKey(token, order.id),
    enabled: !!token && riderStage(order.status),
    refetchInterval: pollInterval(order),
    queryFn: async (): Promise<Delivery | null> => {
      const { data, error, response } = await riderApi.GET('/orders/{orderId}/delivery', {
        params: { path: { orderId: order.id } },
      })
      if (response.status === 404) return null
      if (error || !data) throw error ?? new Error('no answer')
      return data
    },
  })
}

export function useDelivery(order: Order) {
  const token = useToken()
  return useQuery(deliveryOptions(token ?? '', order))
}

// Whole minutes since the position was recorded, rounded down; a clock ahead of ours is "just now".
export function lastSeen(recordedAt: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(recordedAt)) / 60_000)
  if (minutes < 1) return 'Last seen just now'
  if (minutes < 60) return minutes === 1 ? 'Last seen 1 minute ago' : `Last seen ${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  return hours === 1 ? 'Last seen 1 hour ago' : `Last seen ${hours} hours ago`
}
```

Two queries polling at the same 10 s interval, not one combined query: the order read stays exactly as it is (its tests and poll scenarios unchanged), and a rider service that is down never touches the order. Ceiling: the two reads are not in lockstep; for up to 10 s the card's position can be one read older than the status.

### 3. The card: `RiderCard` in `order-tracking.tsx`

```tsx
// From out for delivery on: who carries the order and where they were last seen. Nothing while no rider is known.
function RiderCard({ order }: { order: Order }) {
  const { data: delivery } = useDelivery(order)
  const now = useNow()
  // Core's snapshot first; the rider read names the rider when core has none (the demo seed's delivered order).
  const name = order.riderName ?? delivery?.riderName
  if (!riderStage(order.status) || !name) return null
  const location = delivery?.location
  return (
    <Section title="Rider">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-h3 text-ink">{name}</p>
        <StatusBadge status={order.status} />
      </div>
      {location && (
        <>
          <time dateTime={location.recordedAt} className="text-small text-ink-muted">
            {lastSeen(location.recordedAt, now)}
          </time>
          <div>
            <ButtonLink
              variant="secondary"
              href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
              target="_blank"
              rel="noopener"
            >
              <MapPin size={16} aria-hidden />
              Open in Maps{' '}
              <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
            </ButtonLink>
          </div>
        </>
      )}
    </Section>
  )
}
```

`OrderContent` renders `<RiderCard order={order} />` between the status card and `<History order={order} />`. `MapPin` from `lucide-react`; `ButtonLink`, `VisuallyHidden` from `@shopperstop/ui`; `StatusBadge` and `useNow` from `./order-parts`; `riderStage`, `useDelivery`, `lastSeen` from `./orders`.

- The state is the order's status badge (D28 colours, "Out for delivery" / "Delivered"), not the delivery's `status`: one source with the status message above, no second vocabulary. Ceiling: if the rider service ever had a state core does not (a failed delivery, a hand-over), the card would need it.
- `rel="noopener"` as the brief says (no `noreferrer`: the Maps URL carries nothing private beyond the point itself).
- The visually hidden "(opens in a new tab)" tells screen-reader users the link leaves the tab; the visible text stays "Open in Maps" (the accessible name starts with it).
- No map, no distance, no history (D32 ceilings).

### 4. `useNow` in `order-parts.tsx`

```ts
// Date.now(), refreshed once a second, so a sentence counted from it stays current.
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}
```

`Countdown` becomes `const now = useNow()` plus its `<p>`; its body is otherwise unchanged. Ceiling: the rider card ticks once a second while shown, as the countdown does.

### 5. Rider events in "Status history"

In `History`, under the status name, before the note:

```tsx
{event.actorType === 'rider' && event.actorName && (
  <p className="text-small text-ink">
    {event.toStatus === 'out_for_delivery' ? 'Picked up' : 'Delivered'} by {event.actorName}
  </p>
)}
```

Core lets a rider make only those two moves (403 otherwise), so the else branch is "Delivered".

### 6. The countdown reads the order's promise

`OrderPage` drops `useStore` and the `store` prop; `OrderContent` renders `{underWay(order.status) && <Countdown placedAt={order.placedAt} promisedMinutes={order.promisedMinutes} />}`. The `useStore`/`Store` import goes from `order-tracking.tsx` (checkout keeps its own).

### 7. ui swaps

- `ImageTile`: `product-card.tsx` deletes its `ImageTile` and the `ShoppingBasket` import; every call site imports `ImageTile` from `@shopperstop/ui` and passes `alt=""` (the name is beside it, as before) and `className="w-full"` (the app copy's width; the Home category tile sits in an `items-center` column and would shrink without it). Call sites: `product-card.tsx`, `order-parts.tsx`, `cart-drawer.tsx`, `routes/index.tsx`, `routes/p.$slug.tsx`. No behaviour changes, so no failing test exists for it: a `refactor:` commit with the suite green before and after (the placeholder test in `product-card.test.tsx` keeps covering the tile).
- Checkout: `Chip` goes from the import; `ChoiceGroup`, `Choice` come in. The `<ul>` of addresses is wrapped:

```tsx
<ChoiceGroup label="Deliver to" value={selected?.id} onChange={onChoose}>
  <ul className="flex flex-col">
    {/* … each li unchanged, with the Chip replaced by: */}
    <Choice value={address.id}>Deliver to {address.label}</Choice>
  </ul>
</ChoiceGroup>
```

`selected?.id` is always a listed id or undefined (ChoiceGroup's precondition). Arrow keys now move the choice (ui's behaviour); choosing by arrow calls `onChoose` like a click, so the refusal alert clears the same way.

### 8. Proxy, Playwright, global setup

`vite.config.ts` (the rider key first: Vite tries proxy keys in order and `/api` would match first):

```ts
server: { port: 5173, strictPort: true, proxy: { '/api/rider': 'http://localhost:8081', '/api': 'http://localhost:8080' } },
preview: { port: 15173, strictPort: true, proxy: { '/api/rider': 'http://localhost:18081', '/api': 'http://localhost:18080' } },
```

`playwright.config.ts` adds, after core:

```ts
{
  command: 'go run ./cmd/rider',
  cwd: '../../services/rider',
  url: 'http://localhost:18081/api/rider/v1/healthz',
  reuseExistingServer,
  timeout: 120_000,
},
```

`e2e/global-setup.ts` also refuses a `SHOPPERSTOP_RIDER_DATABASE_URL` that is unset or not `_e2e`, and runs `go run ./cmd/rider-admin migrate` and `seed-demo --reset` in `services/rider` after core's, so a standalone web run has the seeded delivery and no other suite's deliveries. Both checks run before any seed command.

## Cross-area contract (rider-P3-L3's cross-app e2e)

Kept unchanged by this change: the button "Place order (COD)" on `/checkout` and the tracking status sentences "Your order is out for delivery." and "Your order was delivered." (the `StatusMessage`, role `status`; `orders.ts` vocabulary untouched). The rider card is additive. Rider's on-page check finds the card as `getByRole('region', { name: 'Rider', exact: true })` (a `Card` with `role="region"` labelled by its h2 "Rider", via `Section`) and the name inside it as `getByText('<rider name>', { exact: true })`. No test id. Renaming the heading or those texts is a breaking change for rider and needs a request through the area plans.

## Copy and names

| Where | Text or name |
|---|---|
| Card region | "Rider" (h2) |
| Card | rider name (h3 style, `p`), status badge "Out for delivery" / "Delivered" |
| Last seen | "Last seen just now", "Last seen 1 minute ago", "Last seen N minutes ago", "Last seen 1 hour ago", "Last seen N hours ago" in a `<time dateTime=recordedAt>` |
| Maps link | visible "Open in Maps", accessible name "Open in Maps (opens in a new tab)" |
| History | "Picked up by <name>", "Delivered by <name>" |
| Checkout | radio group "Deliver to", radios "Deliver to <label>" |

## Tests (scenario to test)

| Scenario | Test |
|---|---|
| Rider on the way with a position | `order-tracking.test.tsx` "rider on the way with a position" |
| Rider without a position | `order-tracking.test.tsx` "rider without a position" |
| No rider card before a rider | `order-tracking.test.tsx` "no rider card before a rider" |
| Delivered order names the rider from the rider read | `order-tracking.test.tsx` "delivered order names the rider from the rider read" |
| Seeded delivered order against core and rider | `e2e/orders.spec.ts` "seeded delivered order against core and rider" |
| Rider picked up and located against core and rider | `e2e/orders.spec.ts` "rider picked up and located against core and rider" |
| Last seen wording | `orders.test.ts` "last seen wording" |
| Last seen kept current | `order-tracking.test.tsx` "last seen kept current" |
| Rider read follows the status | `orders.test.ts` "rider read follows the status" |
| Failed rider read keeps the card | `order-tracking.test.tsx` "failed rider read keeps the card" |
| Rider events name the rider | `order-tracking.test.tsx` "rider events name the rider" |
| Web preview proxies to core | `e2e/smoke.spec.ts` "web preview proxies to core" (existing) |
| Web preview proxies to rider | `e2e/smoke.spec.ts` "web preview proxies to rider" |
| Customer smoke pages pass axe, Admin preview served | existing |
| Countdown counts down, Countdown after the promise | existing (`Countdown` unchanged) |
| Countdown uses the order's promise | `order-tracking.test.tsx` "countdown uses the order's promise" |
| No countdown once finished | `order-tracking.test.tsx` "no countdown once finished" (changed) |
| Default address chosen, Another address chosen | `checkout.test.tsx` same names (changed to radios) |
| No address yet | existing |
| Address added at checkout | `e2e/checkout.spec.ts` (locator changed to radio, `aria-checked`) |

Vitest seeds the query cache (`queryClient.setQueryData(deliveryKey('t', id), …)`), as the tracking tests seed the order; the mount read fails under jsdom (test-setup's `fetch` throws) and the seed stays. A test that needs an answer stubs `fetch` with `vi.stubGlobal` and matches on the path. The clock is faked only where the text depends on it (`vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })`, as the countdown tests do).

## Simplifications and ceilings

- Card state from the order's status, not the delivery's (Decision 3).
- Two independent 10 s polls (Decision 2).
- Shared 401 handling (Decision 1).
- The name falls back to the rider read only because core's demo seed has no `rider_name` for `...0701`; a request to core to seed it is in the lane report, optional.
- No phone-width layout assertion for the card (the existing layout scenario's list is unchanged); the card uses `Section` and a `md` `ButtonLink` (44 px on phone), the patterns the layout test already covers.
- `orderPick(request, 9)` for the live e2e: indexes 0 to 8 are taken. If page 2 has fewer than ten qualifying products the helper throws with the count; then the worker stops and reports.
- One more `staffHeaders` sign-in in the web suite (core allows 10 per email per hour per process).
