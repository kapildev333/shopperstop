# Brief: web-rider-tracking task 2 (worker)

- LANE-ID: web-P3-L1-T2 (worker log `.claude/lanes/web-P3-L1-T2.md`); team lead web-P3-L1
- Area: web
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/web-P3-L1`, branch `lane/web-P3-L1-rider-tracking`, after task 1 landed. Commit there; never push.
- Change: `openspec/changes/web-rider-tracking/`, task 2 "Rider names in the history, countdown from the order". Read `specs/web-app/spec.md` and `design.md` Decisions 5 and 6 first.
- Scope paths (edit nothing else):
  - `apps/web/src/order-tracking.tsx`, `apps/web/src/order-tracking.test.tsx`
  - `openspec/changes/web-rider-tracking/tasks.md` (checkboxes 2.1 and 2.2 only)
  - `.claude/lanes/web-P3-L1-T2.md`
- Scenarios: web-app › "Customer status history names the rider" › Rider events name the rider; "Customer order countdown" › Countdown uses the order's promise, No countdown once finished.

## Commit 1: `test: rider names in the history and the order's own promise`

In `src/order-tracking.test.tsx`:

1. "rider events name the rider", appended:

```ts
test('rider events name the rider', async () => {
  const at = (minute: number) => `2026-10-13T10:${String(minute).padStart(2, '0')}:00.000Z`
  seed({
    status: 'delivered',
    riderName: 'Asha',
    events: [
      { toStatus: 'placed', actorType: 'customer', createdAt: at(0) },
      { toStatus: 'accepted', actorType: 'staff', createdAt: at(1) },
      { toStatus: 'packing', actorType: 'staff', createdAt: at(2) },
      { toStatus: 'ready', actorType: 'staff', createdAt: at(5) },
      { toStatus: 'out_for_delivery', actorType: 'rider', actorName: 'Asha', createdAt: at(6) },
      { toStatus: 'delivered', actorType: 'rider', actorName: 'Asha', createdAt: at(15) },
    ],
  })
  renderAt(`/orders/${id}`)
  const history = await screen.findByRole('region', { name: 'Status history' })
  const entries = within(history).getAllByRole('listitem')
  expect(entries[4]).toHaveTextContent('Out for delivery')
  expect(within(entries[4]).getByText('Picked up by Asha')).toBeInTheDocument()
  expect(entries[5]).toHaveTextContent('Delivered')
  expect(within(entries[5]).getByText('Delivered by Asha')).toBeInTheDocument()
  expect(within(history).getAllByText(/ by /)).toHaveLength(2)
})
```

2. "countdown uses the order's promise", appended. The store read is seeded with a different promise, so the test proves which one is used:

```ts
test("countdown uses the order's promise", async () => {
  seed({ status: 'placed', placedAt: new Date(Date.now() - 3 * 60_000).toISOString(), promisedMinutes: 20 })
  queryClient.setQueryData(keys.store(koramangala), store({ promisedMinutes: 10 }))
  renderAt(`/orders/${id}`)
  expect(await screen.findByText('Arriving in 17 minutes')).toBeInTheDocument()
})
```

3. "no countdown once finished", changed: replace its body with

```ts
  const placedAt = new Date(Date.now() - 3 * 60_000).toISOString()
  // The control: a placed order shows the countdown from its own promise, no store read needed.
  seed({ status: 'placed', placedAt })
  renderAt(`/orders/${id}`)
  expect(await screen.findByText('Arriving in 7 minutes')).toBeInTheDocument()

  for (const status of ['delivered', 'cancelled'] as const) {
    cleanup()
    seed({ status, placedAt })
    renderAt(`/orders/${id}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-DEMOAAAD' })).toBeInTheDocument()
    expect(screen.queryByText(/Arriving in|Running late/)).toBeNull()
  }
```

and update the comment above it to "The control (a placed order shows the countdown) makes the absence below mean something.". Keep the `keys`, `store` and `koramangala` imports (test 2 uses them).

Red on this commit: exactly these three (1: no "Picked up by Asha"; 2: "Arriving in 7 minutes" instead of 17; 3: no countdown without a store read). Lint and typecheck green. Write the red list in the commit body.

## Commit 2: `feat: rider names in the history and the order's own promise`

Exactly design.md, all in `src/order-tracking.tsx`:
- Decision 5: the rider line in `History`, under the status name and before the note.
- Decision 6: `OrderPage` drops `const store = useStore(order?.storeId)` and its comment, and the `store` prop it passes; `OrderContent` drops its `store` prop and renders `{underWay(order.status) && <Countdown placedAt={order.placedAt} promisedMinutes={order.promisedMinutes} />}`; remove the now unused `useStore` and `Store` import.

Do not add: an actor line for staff, customer or system events; a store read anywhere on the tracking page; any change to `Countdown`, `arrival` or `order-parts.tsx`.

Tick 2.1 and 2.2 in `tasks.md` as each commit lands.

## Gates

As task 1 (`tasks.md` › Gates). No Playwright and no docker. Commit as the repo's configured author, no trailers. Report the hashes, the red list, the gates and any deviation in your lane log; stop and report on any open design choice.
