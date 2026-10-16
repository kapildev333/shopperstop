import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { queryClient } from './api'
import { keys } from './catalog'
import { Countdown } from './order-parts'
import { OrderPage } from './order-tracking'
import { deliveryKey, orderKey, type Delivery, type Order, type OrderResult } from './orders'
import { setToken } from './session'
import { order, refetchFailed, renderAt, renderInRouter, store } from './test-data'

const id = '00000000-0000-4000-8000-000000000703'
const koramangala = '00000000-0000-4000-8000-000000000401'

// Only the clock is faked here, and only in the countdown tests (Testing Library's findBy and the router need setTimeout).
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const placed = { toStatus: 'placed' as const, actorType: 'customer' as const, createdAt: '2026-10-13T10:00:00.000Z' }
const accepted = { toStatus: 'accepted' as const, actorType: 'staff' as const, createdAt: '2026-10-13T10:20:00.000Z' }

// The rider read, seeded like the order: the mount read fails under jsdom and the seed stays.
function seedDelivery(delivery: Delivery | null) {
  queryClient.setQueryData(deliveryKey('t', id), delivery)
}
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000 - 5_000).toISOString()
const position = (recordedAt: string) => ({ lat: 12.9352, lng: 77.6245, recordedAt })

// Signed in, with the order seeded (no HTTP). The order key has no staleTime, so the page's mount read fails under jsdom and the seed stays.
function seed(overrides: Partial<Order> | null = {}) {
  setToken('t')
  queryClient.setQueryData(orderKey('t', id), overrides === null ? null : order(overrides))
}

// The value beside a summary label: the dd after its dt.
function row(region: HTMLElement, label: string) {
  return within(region).getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement
}

test('signed-out order pages redirect', async () => {
  const history = renderAt('/orders')
  expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  expect(history.state.location.href).toBe('/sign-in?returnTo=%2Forders')

  cleanup()
  const tracking = renderAt(`/orders/${id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  expect(tracking.state.location.href).toBe(`/sign-in?returnTo=%2Forders%2F${id}`)
})

test('tracking shows the order', async () => {
  seed({ status: 'accepted', events: [placed, accepted] })
  renderAt(`/orders/${id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-DEMOAAAD' })).toBeInTheDocument()

  const history = screen.getByRole('region', { name: 'Status history' })
  expect(within(history).getAllByRole('listitem')).toHaveLength(2)
  expect(within(history).getByText('Placed')).toBeInTheDocument()
  expect(within(history).getByText('Accepted')).toBeInTheDocument()
  const times = Array.from(history.querySelectorAll('time'), (time) => time.dateTime)
  expect(times).toEqual([placed.createdAt, accepted.createdAt])

  const items = screen.getByRole('region', { name: 'Items' })
  const line = within(items).getByRole('listitem')
  expect(within(line).getByText('Banana Robusta')).toBeInTheDocument()
  expect(within(line).getByText('Qty 1')).toBeInTheDocument()
  expect(within(line).getByText('₹70')).toBeInTheDocument()
  expect(row(items, 'Total')).toHaveTextContent('₹95')
  expect(within(items).getByText('Cash on delivery')).toBeInTheDocument()

  const address = screen.getByRole('region', { name: 'Delivery address' })
  expect(within(address).getByText('Home')).toBeInTheDocument()
  expect(within(address).getByText('12 80 Feet Rd, Koramangala')).toBeInTheDocument()
  expect(within(address).getByText('560034')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'All orders' })).toHaveAttribute('href', '/orders')
})

test('unknown order', async () => {
  seed(null)
  renderAt(`/orders/${id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Order not found' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Your orders' })).toHaveAttribute('href', '/orders')
})

test('status change announced', async () => {
  seed({ status: 'placed' })
  renderAt(`/orders/${id}`)
  expect(await screen.findByText('Order placed. Waiting for the store to accept it.')).toBeInTheDocument()
  const status = screen.getByRole('status')

  act(() => {
    queryClient.setQueryData(orderKey('t', id), order({ status: 'accepted', events: [placed, accepted] }))
  })
  // TanStack delivers observer updates on a timer, so the text is awaited; the element must be the same one.
  await waitFor(() => expect(status).toHaveTextContent('The store accepted your order.'))
  expect(screen.getByRole('status')).toBe(status)
})

test('cancelled order shows the reason', async () => {
  seed({ status: 'cancelled', cancelReason: 'Ordered by mistake' })
  renderAt(`/orders/${id}`)
  expect(await screen.findByText('This order was cancelled. Reason: Ordered by mistake')).toBeInTheDocument()

  cleanup()
  seed({ status: 'cancelled' })
  renderAt(`/orders/${id}`)
  expect(await screen.findByText('This order was cancelled.')).toBeInTheDocument()
})

test('failed poll keeps the order', async () => {
  seed({ status: 'placed' })
  renderAt(`/orders/${id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-DEMOAAAD' })).toBeInTheDocument()

  await refetchFailed(orderKey('t', id))
  expect(screen.getByRole('heading', { level: 1, name: 'Order SS-DEMOAAAD' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Order placed. Waiting for the store to accept it.')
  expect(screen.queryByRole('alert')).toBeNull()
})

// The clock is faked at the process boundary for these two: Date, setInterval and clearInterval only.
function fakeClock(now: string) {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date(now))
}

test('countdown counts down', () => {
  fakeClock('2026-10-13T10:03:00.000Z')
  render(<Countdown placedAt="2026-10-13T10:00:00.000Z" promisedMinutes={10} />)
  expect(screen.getByText('Arriving in 7 minutes')).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(60_000)
  })
  expect(screen.getByText('Arriving in 6 minutes')).toBeInTheDocument()

  cleanup()
  vi.setSystemTime(new Date('2026-10-13T10:09:30.000Z'))
  render(<Countdown placedAt="2026-10-13T10:00:00.000Z" promisedMinutes={10} />)
  expect(screen.getByText('Arriving in 1 minute')).toBeInTheDocument()
})

test('countdown after the promise', () => {
  fakeClock('2026-10-13T10:10:00.000Z')
  render(<Countdown placedAt="2026-10-13T10:00:00.000Z" promisedMinutes={10} />)
  expect(screen.getByText('Running late. We are getting your order to you.')).toBeInTheDocument()
  expect(screen.queryByText(/Arriving in/)).toBeNull()

  cleanup()
  render(<Countdown placedAt="2026-10-13T07:10:00.000Z" promisedMinutes={10} />)
  expect(screen.getByText('Running late. We are getting your order to you.')).toBeInTheDocument()
  expect(screen.queryByText(/Arriving in/)).toBeNull()
})

// The control (a placed order with its store known shows the countdown) makes the absence below mean something.
test('no countdown once finished', async () => {
  const placedAt = new Date(Date.now() - 3 * 60_000).toISOString()
  seed({ status: 'placed', placedAt })
  queryClient.setQueryData(keys.store(koramangala), store())
  renderAt(`/orders/${id}`)
  expect(await screen.findByText('Arriving in 7 minutes')).toBeInTheDocument()

  cleanup()
  seed({ status: 'delivered', placedAt })
  renderAt(`/orders/${id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-DEMOAAAD' })).toBeInTheDocument()
  expect(screen.queryByText(/Arriving in|Running late/)).toBeNull()

  cleanup()
  queryClient.removeQueries({ queryKey: keys.store(koramangala) })
  seed({ status: 'placed', placedAt })
  renderAt(`/orders/${id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-DEMOAAAD' })).toBeInTheDocument()
  expect(screen.queryByText(/Arriving in|Running late/)).toBeNull()
})

test('cancel offered while placed or accepted', async () => {
  for (const status of ['placed', 'accepted'] as const) {
    seed({ status })
    renderAt(`/orders/${id}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-DEMOAAAD' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument()
    cleanup()
  }

  seed({ status: 'packing' })
  renderAt(`/orders/${id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-DEMOAAAD' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull()
})

// A send prop answers one cancel per call, in order; it records each order id asked for.
function canceller(...answers: OrderResult[]) {
  const asked: string[] = []
  const send = async (orderId: string) => {
    asked.push(orderId)
    return answers[asked.length - 1]
  }
  return { send, asked }
}

test('order cancelled', async () => {
  seed({ status: 'placed' })
  const cancelled = order({ status: 'cancelled' })
  const { send, asked } = canceller({ order: cancelled })
  renderInRouter(<OrderPage id={id} send={send} />)

  await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }))
  const dialog = screen.getByRole('dialog', { name: 'Cancel this order?' })
  expect(within(dialog).getAllByRole('button')[0]).toHaveTextContent('Keep order')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(asked).toEqual([id])
  expect(await screen.findByText('This order was cancelled.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull()
})

test('cancel refused', async () => {
  seed({ status: 'placed' })
  const { send, asked } = canceller(
    { error: { code: 'conflict', message: 'order is packing' } },
    { error: { code: 'internal', message: 'Could not reach ShopperStop. Try again.' } },
  )
  renderInRouter(<OrderPage id={id} send={send} />)

  await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }))
  const dialog = screen.getByRole('dialog', { name: 'Cancel this order?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('This order can no longer be cancelled.')

  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }))
  await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Could not cancel the order. Try again.'))
  expect(screen.getByRole('dialog', { name: 'Cancel this order?' })).toBe(dialog)
  expect(asked).toEqual([id, id])
})

// A refused cancel shows the order core now holds: the page reads the order again (the seam writes the cache first).
test('refused cancel reads the order again', async () => {
  seed({ status: 'placed' })
  const conflict: OrderResult = { error: { code: 'conflict', message: 'order is packing' } }
  const send = async () => {
    queryClient.setQueryData(orderKey('t', id), order({ status: 'packing' }))
    return conflict
  }
  renderInRouter(<OrderPage id={id} send={send} />)

  await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }))
  const dialog = screen.getByRole('dialog', { name: 'Cancel this order?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }))

  await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('This order can no longer be cancelled.'))
  expect(screen.getByRole('dialog', { name: 'Cancel this order?' })).toBe(dialog)
  expect(within(dialog).getByRole('button', { name: 'Keep order' })).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Cancel order' })).toBeNull()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Your order is being packed.'))
})

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
