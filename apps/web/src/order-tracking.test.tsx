import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { queryClient } from './api'
import { keys } from './catalog'
import { Countdown } from './order-parts'
import { OrderPage } from './order-tracking'
import { orderKey, type Order, type OrderResult } from './orders'
import { setToken } from './session'
import { order, refetchFailed, renderAt, renderInRouter, store } from './test-data'

const id = '00000000-0000-4000-8000-000000000703'
const koramangala = '00000000-0000-4000-8000-000000000401'

// Only the clock is faked here, and only in the countdown tests (Testing Library's findBy and the router need setTimeout).
afterEach(() => {
  vi.useRealTimers()
})
const placed = { toStatus: 'placed' as const, actorType: 'customer' as const, createdAt: '2026-10-13T10:00:00.000Z' }
const accepted = { toStatus: 'accepted' as const, actorType: 'staff' as const, createdAt: '2026-10-13T10:20:00.000Z' }

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
