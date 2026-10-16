# Brief: web-rider-tracking task 1 (worker)

- LANE-ID: web-P3-L1-T1 (worker log `.claude/lanes/web-P3-L1-T1.md`, format in `.claude/lanes/README.md`); team lead web-P3-L1
- Area: web
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/web-P3-L1`, branch `lane/web-P3-L1-rider-tracking`. Commit there; never push.
- Change: `openspec/changes/web-rider-tracking/`, task 1 "Rider client and tracking card". Read `proposal.md`, `specs/web-app/spec.md`, `design.md` (Decisions 1 to 4), `tasks.md` first.
- Scope paths (edit nothing else):
  - `apps/web/src/api.ts`, `apps/web/src/orders.ts`, `apps/web/src/orders.test.ts`
  - `apps/web/src/order-parts.tsx`, `apps/web/src/order-tracking.tsx`, `apps/web/src/order-tracking.test.tsx`
  - `openspec/changes/web-rider-tracking/tasks.md` (checkboxes 1.1 and 1.2 only)
  - `.claude/lanes/web-P3-L1-T1.md`
  - Not `packages/ui`, not `vite.config.ts`, not `e2e/`, not the history or the countdown (task 2). If anything seems to need a change outside scope, stop and report.
- Scenarios: web-app › "Customer order rider card" › Rider on the way with a position, Rider without a position, No rider card before a rider, Delivered order names the rider from the rider read; "Customer rider last seen" › Last seen wording, Last seen kept current; "Customer order rider read" › Rider read follows the status, Failed rider read keeps the card.

## Commit 1: `test: rider card on the tracking page`

### `src/orders.test.ts`

Add `deliveryOptions, lastSeen` to the `./orders` import. Append:

```ts
// Whole minutes rounded down, then whole hours; a clock ahead of ours is "just now".
test('last seen wording', () => {
  const now = Date.parse('2026-10-13T12:00:00.000Z')
  const at = (seconds: number) => new Date(now - seconds * 1000).toISOString()
  expect(lastSeen(at(30), now)).toBe('Last seen just now')
  expect(lastSeen(at(60), now)).toBe('Last seen 1 minute ago')
  expect(lastSeen(at(59 * 60), now)).toBe('Last seen 59 minutes ago')
  expect(lastSeen(at(60 * 60), now)).toBe('Last seen 1 hour ago')
  expect(lastSeen(at(150 * 60), now)).toBe('Last seen 2 hours ago')
  expect(lastSeen(at(-120), now)).toBe('Last seen just now')
})

// Only from out for delivery on: polled every 10 s while out, read once when delivered, never before.
test('rider read follows the status', () => {
  for (const status of ['placed', 'accepted', 'packing', 'ready', 'cancelled'] as const) {
    expect(deliveryOptions('t', order({ status })).enabled, status).toBe(false)
  }
  const out = deliveryOptions('t', order({ status: 'out_for_delivery' }))
  expect(out.enabled).toBe(true)
  expect(out.refetchInterval).toBe(10_000)
  expect(out.refetchIntervalInBackground).not.toBe(true)
  const delivered = deliveryOptions('t', order({ status: 'delivered' }))
  expect(delivered.enabled).toBe(true)
  expect(delivered.refetchInterval).toBe(false)
  expect(deliveryOptions('', order({ status: 'out_for_delivery' })).enabled).toBe(false)
})
```

### `src/order-tracking.test.tsx`

- Imports: add `deliveryKey, type Delivery` to the `./orders` import.
- Change the `afterEach` to also `vi.unstubAllGlobals()`.
- Under the `accepted` constant add:

```ts
// The rider read, seeded like the order: the mount read fails under jsdom and the seed stays.
function seedDelivery(delivery: Delivery | null) {
  queryClient.setQueryData(deliveryKey('t', id), delivery)
}
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000 - 5_000).toISOString()
const position = (recordedAt: string) => ({ lat: 12.9352, lng: 77.6245, recordedAt })
```

- Append (before the countdown helpers is fine, or at the end):

```ts
test('rider on the way with a position', async () => {
  seed({ status: 'out_for_delivery', riderName: 'Asha' })
  seedDelivery({ riderName: 'Asha', status: 'assigned', location: position(minutesAgo(3)) })
  renderAt(`/orders/${id}`)
  const rider = await screen.findByRole('region', { name: 'Rider' })
  expect(within(rider).getByText('Asha')).toBeInTheDocument()
  expect(within(rider).getByText('Out for delivery')).toBeInTheDocument()
  expect(within(rider).getByText('Last seen 3 minutes ago')).toBeInTheDocument()
  const maps = within(rider).getByRole('link', { name: 'Open in Maps (opens in a new tab)' })
  expect(maps).toHaveAttribute('href', 'https://www.google.com/maps?q=12.9352,77.6245')
  expect(maps).toHaveAttribute('target', '_blank')
  expect(maps).toHaveAttribute('rel', 'noopener')
})

test('rider without a position', async () => {
  seed({ status: 'out_for_delivery', riderName: 'Asha' })
  seedDelivery({ riderName: 'Asha', status: 'assigned' })
  renderAt(`/orders/${id}`)
  const rider = await screen.findByRole('region', { name: 'Rider' })
  expect(within(rider).getByText('Asha')).toBeInTheDocument()
  expect(within(rider).queryByText(/Last seen/)).toBeNull()
  expect(within(rider).queryByRole('link', { name: /Open in Maps/ })).toBeNull()
})

test('no rider card before a rider', async () => {
  const asked: string[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    const path = new URL(request.url).pathname
    asked.push(path)
    if (path.startsWith('/api/rider/')) {
      return new Response(JSON.stringify({ error: { code: 'not_found', message: 'not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new TypeError('fetch failed')
  })
  seed({ status: 'ready' })
  renderAt(`/orders/${id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-DEMOAAAD' })).toBeInTheDocument()
  await waitFor(() => expect(asked).toContain(`/api/core/v1/orders/${id}`))
  expect(screen.queryByRole('region', { name: 'Rider' })).toBeNull()
  expect(asked.filter((path) => path.startsWith('/api/rider/'))).toEqual([])

  cleanup()
  seed({ status: 'out_for_delivery' })
  renderAt(`/orders/${id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-DEMOAAAD' })).toBeInTheDocument()
  await waitFor(() => expect(queryClient.getQueryState(deliveryKey('t', id))?.status).toBe('success'))
  expect(queryClient.getQueryData(deliveryKey('t', id))).toBeNull()
  expect(screen.queryByRole('region', { name: 'Rider' })).toBeNull()
})

test('delivered order names the rider from the rider read', async () => {
  seed({ status: 'delivered' })
  seedDelivery({ riderName: 'Arjun Rao', status: 'delivered' })
  renderAt(`/orders/${id}`)
  const rider = await screen.findByRole('region', { name: 'Rider' })
  expect(within(rider).getByText('Arjun Rao')).toBeInTheDocument()
  expect(within(rider).getByText('Delivered')).toBeInTheDocument()
  expect(within(rider).queryByRole('link', { name: /Open in Maps/ })).toBeNull()
})

test('failed rider read keeps the card', async () => {
  seed({ status: 'out_for_delivery', riderName: 'Asha' })
  seedDelivery({ riderName: 'Asha', status: 'assigned', location: position(minutesAgo(3)) })
  renderAt(`/orders/${id}`)
  const rider = await screen.findByRole('region', { name: 'Rider' })
  await refetchFailed(deliveryKey('t', id))
  expect(within(rider).getByText('Asha')).toBeInTheDocument()
  expect(within(rider).getByText('Last seen 3 minutes ago')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).toBeNull()
})
```

- After the existing `fakeClock` helper (it fakes only `Date`, `setInterval`, `clearInterval`), append:

```ts
test('last seen kept current', async () => {
  fakeClock('2026-10-13T10:13:00.000Z')
  seed({ status: 'out_for_delivery', riderName: 'Asha' })
  seedDelivery({ riderName: 'Asha', status: 'assigned', location: position('2026-10-13T10:10:00.000Z') })
  renderAt(`/orders/${id}`)
  const rider = await screen.findByRole('region', { name: 'Rider' })
  expect(within(rider).getByText('Last seen 3 minutes ago')).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(60_000)
  })
  expect(within(rider).getByText('Last seen 4 minutes ago')).toBeInTheDocument()
})
```

Red on this commit: exactly the eight new tests (the imports `deliveryOptions`, `lastSeen`, `deliveryKey` do not exist yet, so the two `orders.test.ts` tests fail on a missing function and the tracking tests find no "Rider" region). Typecheck fails only on those three missing exports and `Delivery`; lint is green. Write the red list and the typecheck errors in the commit body.

## Commit 2: `feat: rider card on the tracking page`

Exactly design.md:
- Decision 1 in `src/api.ts`: the `RiderPaths` type import, `riderApi` with its comment, `riderApi.use(authMiddleware)`.
- Decision 2 in `src/orders.ts`: the `RiderComponents` type import, `riderApi` added to the `./api` import, `Delivery`, `deliveryKey`, `riderStage`, `deliveryOptions`, `useDelivery`, `lastSeen`, each with its comment.
- Decision 4 in `src/order-parts.tsx`: `useNow`; `Countdown` uses it.
- Decision 3 in `src/order-tracking.tsx`: `RiderCard` as written, rendered between the status `Card` and `<History order={order} />`. Imports: `MapPin` from `lucide-react`; `ButtonLink`, `VisuallyHidden` from `@shopperstop/ui`; `StatusBadge`, `useNow` from `./order-parts`; `riderStage`, `useDelivery`, `lastSeen` from `./orders`.

Do not add:
- a map, an image of a map, a distance, a phone link, the delivery's own `status` text
- any change to `orderOptions`, `pollInterval`, `authMiddleware`, `call`
- an alert or retry for the rider read
- a second middleware or a 401 exception

Tick 1.1 and 1.2 in `tasks.md` as each commit lands.

## Gates

From the worktree root, prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`, after `test -d node_modules || npm ci`:
- `npm run build --workspace packages/ui`
- `npm run lint --workspace apps/web`
- `npm run typecheck --workspace apps/web`
- `npm run test --workspace apps/web -- --run` (run `src/order-tracking.test.tsx` three times: the fake-clock test advances the order poll too)
- `npm run build --workspace apps/web`
- `git status` clean after the build
- `openspec validate web-rider-tracking --strict`

No Playwright and no docker. Commit as the repo's configured author, no trailers. Report the commit hashes, the red list, the gate results and any deviation in your lane log. If a test above cannot pass with design.md's code as written, stop and report; do not change the design.
