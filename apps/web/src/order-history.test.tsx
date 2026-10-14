import { cleanup, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { ordersKey, type OrderList } from './orders'
import { setToken } from './session'
import { order, renderAt } from './test-data'

const placed = order({
  id: '00000000-0000-4000-8000-000000000703',
  number: 'SS-DEMOAAAD',
  status: 'placed',
  subtotalCents: 103000,
  deliveryFeeCents: 0,
  totalCents: 103000,
  items: [
    { productId: '00000000-0000-4000-8000-000000000601', name: 'Banana Robusta', unitLabel: '1 kg', priceCents: 7000, mrpCents: 7000, quantity: 2 },
    { productId: '00000000-0000-4000-8000-000000000602', name: 'Amul Butter', unitLabel: '100 g', priceCents: 5600, mrpCents: 5600, quantity: 2 },
  ],
})
const cancelled = order({
  id: '00000000-0000-4000-8000-000000000702',
  number: 'SS-DEMOAAAC',
  status: 'cancelled',
  subtotalCents: 39900,
  deliveryFeeCents: 0,
  totalCents: 39900,
  placedAt: '2026-10-12T09:00:00.000Z',
  items: [{ productId: '00000000-0000-4000-8000-000000000603', name: 'Amul Curd', unitLabel: '400 g', priceCents: 39900, mrpCents: 39900, quantity: 1 }],
})

function list(total: number): OrderList {
  return { items: [placed, cancelled], page: 1, pageSize: 24, total }
}

test('history lists orders', async () => {
  setToken('t')
  queryClient.setQueryData(ordersKey('t'), list(2))
  renderAt('/orders')
  expect(await screen.findByRole('heading', { level: 1, name: 'Your orders' })).toBeInTheDocument()

  const [first, second] = screen.getAllByRole('listitem')
  expect(within(first).getByRole('heading', { level: 2, name: 'SS-DEMOAAAD' })).toBeInTheDocument()
  expect(within(first).getByText('Placed')).toBeInTheDocument()
  expect(within(first).getByText('4 items')).toBeInTheDocument()
  expect(within(first).getByText('₹1,030')).toBeInTheDocument()
  expect(first.querySelector('time')?.dateTime).toBe(placed.placedAt)
  expect(within(first).getByRole('link', { name: 'View order SS-DEMOAAAD' })).toHaveAttribute(
    'href',
    '/orders/00000000-0000-4000-8000-000000000703',
  )

  expect(within(second).getByRole('heading', { level: 2, name: 'SS-DEMOAAAC' })).toBeInTheDocument()
  expect(within(second).getByText('Cancelled')).toBeInTheDocument()
  expect(within(second).getByText('1 item')).toBeInTheDocument()
  expect(screen.queryByText(/Showing your latest/)).toBeNull()

  cleanup()
  setToken('t')
  queryClient.setQueryData(ordersKey('t'), list(30))
  renderAt('/orders')
  expect(await screen.findByText('Showing your latest 2 orders.')).toBeInTheDocument()
})

test('no orders yet', async () => {
  setToken('t')
  queryClient.setQueryData(ordersKey('t'), { items: [], page: 1, pageSize: 24, total: 0 })
  renderAt('/orders')
  expect(await screen.findByText('No orders yet')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Start shopping' })).toHaveAttribute('href', '/')

  // Nothing held and core cannot be reached: the alert, not the empty state.
  cleanup()
  queryClient.clear()
  setToken('t')
  renderAt('/orders')
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your orders.')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(screen.queryByText('No orders yet')).toBeNull()
})
