import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { queryClient } from './api'
import { fakeCore, json } from './fake-core'
import { orderKey, type Order } from './orders'
import { OrderTracking } from './orders-tracking'
import { setToken } from './session'

const id = '00000000-0000-4000-8000-000000000703'
const token = 't-cancel-screen'

const placedAt = new Date(2026, 9, 16, 10, 2).toISOString()

// Every field of a core Order; tests override only what they state.
function order(over: Partial<Order> = {}): Order {
  return {
    id,
    number: 'SS-DEMOAAAD',
    storeId: 'store-1',
    storeName: 'Koramangala',
    promisedMinutes: 10,
    status: 'placed',
    customerName: 'Asha Rao',
    address: { label: 'Home', line1: '12 80 Feet Rd', line2: 'Koramangala', pincode: '560034' },
    subtotalCents: 10800,
    deliveryFeeCents: 2500,
    totalCents: 13300,
    paymentMethod: 'cod',
    placedAt,
    items: [{ productId: 'p1', name: 'Toned milk', unitLabel: '1 l', priceCents: 2900, mrpCents: 2900, quantity: 2 }],
    events: [{ toStatus: 'placed', actorType: 'customer', createdAt: placedAt }],
    ...over,
  }
}

// The root layout provides the query client in the app; the screen needs it here too.
function renderTracking() {
  return render(
    <QueryClientProvider client={queryClient}>
      <OrderTracking id={id} />
    </QueryClientProvider>,
  )
}

// Non-navigating: the screen renders under no router, so each test owns one render.

test('Cancel offered while placed or accepted', async () => {
  setToken(token)
  let current = order({ status: 'placed' })
  fakeCore({ [`GET /orders/${id}`]: () => json(200, current) })
  await renderTracking()

  expect(await screen.findByText('Order placed. Waiting for the store to accept it.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Cancel order' })).toBeTruthy()

  current = order({ status: 'accepted' })
  await act(() => queryClient.refetchQueries({ queryKey: orderKey(token, id) }))
  expect(await screen.findByText('The store accepted your order.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Cancel order' })).toBeTruthy()

  current = order({ status: 'packing' })
  await act(() => queryClient.refetchQueries({ queryKey: orderKey(token, id) }))
  expect(await screen.findByText('Your order is being packed.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull()
})

test('Order cancelled with a reason', async () => {
  setToken(token)
  const calls = fakeCore({
    [`GET /orders/${id}`]: () => json(200, order()),
    [`POST /orders/${id}/cancel`]: () => json(200, order({ status: 'cancelled', cancelReason: 'Ordered by mistake' })),
  })
  await renderTracking()

  await fireEvent.press(await screen.findByRole('button', { name: 'Cancel order' }))
  expect(screen.getByText('Cancel this order?')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Keep order' })).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Ordered by mistake' }))
  // The screen's own "Cancel order" stays in the tree under the open sheet; the sheet comes after it, so its button is the last.
  const confirm = screen.getAllByRole('button', { name: 'Cancel order' })
  await fireEvent.press(confirm[confirm.length - 1])

  expect(await screen.findByText('This order was cancelled. Reason: Ordered by mistake')).toBeTruthy()
  const post = calls.find((request) => request.method === 'POST')!
  expect(await post.clone().json()).toEqual({ reason: 'Ordered by mistake' })
  await waitFor(() => expect(screen.queryByText('Cancel this order?')).toBeNull())
  expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull()
})
