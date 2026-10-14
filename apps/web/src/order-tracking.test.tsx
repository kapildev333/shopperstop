import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { orderKey, type Order } from './orders'
import { setToken } from './session'
import { order, refetchFailed, renderAt } from './test-data'

const id = '00000000-0000-4000-8000-000000000703'
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
