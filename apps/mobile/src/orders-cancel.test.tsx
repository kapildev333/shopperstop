import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { queryClient } from './api'
import { CancelOrderDialog } from './orders-cancel'
import { useOrder, type Order } from './orders'
import { apiError, fakeCore, json } from './fake-core'
import { setToken } from './session'

const local = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute).toISOString()

function order(over: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    number: 'SS-DEMOAAAD',
    storeId: 'store-1',
    storeName: 'Koramangala',
    promisedMinutes: 10,
    status: 'placed',
    customerName: 'Asha',
    address: { label: 'Home', line1: '12 MG Road', pincode: '560034' },
    subtotalCents: 2000,
    deliveryFeeCents: 0,
    totalCents: 2000,
    paymentMethod: 'cod',
    placedAt: local(16, 10, 2),
    items: [{ productId: 'p1', name: 'Toned milk', unitLabel: '1 L', priceCents: 2000, mrpCents: 2200, quantity: 1 }],
    events: [{ toStatus: 'placed', actorType: 'customer', createdAt: local(16, 10, 2) }],
    ...over,
  }
}

// Keeps the order observed, as the tracking screen does, so an invalidation re-reads it.
function Observed({ id }: { id: string }) {
  useOrder(id)
  return null
}

function renderDialog(placed: Order, onClose = jest.fn()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Observed id={placed.id} />
      <CancelOrderDialog order={placed} open onClose={onClose} />
    </QueryClientProvider>,
  )
}

test('Cancel dialog contents', async () => {
  setToken('t-cancel')
  fakeCore({})
  await renderDialog(order())

  expect(screen.getByText('Cancel this order?')).toBeTruthy()
  expect(screen.getByText("Order SS-DEMOAAAD hasn't been packed yet, so you can still cancel it. Nothing has been charged.")).toBeTruthy()
  expect(screen.getByText('Reason (optional)')).toBeTruthy()
  for (const reason of ['Ordered by mistake', 'Want to change items', 'Delivery is taking too long', 'Other']) {
    expect(screen.getByRole('button', { name: reason }).props.accessibilityState).toEqual({ selected: false })
  }
  // Keep order comes first in the dialog; the labels are the buttons' own text.
  const labels = screen
    .getAllByRole('button')
    .map((button) => within(button).queryByText(/^(Keep order|Cancel order)$/)?.props.children)
    .filter(Boolean)
  expect(labels).toEqual(['Keep order', 'Cancel order'])
})

test('Keep order', async () => {
  setToken('t-cancel')
  const calls = fakeCore({})
  const onClose = jest.fn()
  await renderDialog(order(), onClose)

  await fireEvent.press(screen.getByRole('button', { name: 'Keep order' }))

  expect(onClose).toHaveBeenCalledTimes(1)
  expect(calls.filter((request) => request.method === 'POST')).toEqual([])
})

test('Order cancelled without a reason', async () => {
  setToken('t-cancel')
  const calls = fakeCore({
    'POST /orders/order-1/cancel': () => json(200, order({ status: 'cancelled' })),
  })
  const onClose = jest.fn()
  await renderDialog(order(), onClose)

  await fireEvent.press(screen.getByRole('button', { name: 'Ordered by mistake' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Ordered by mistake' }))
  expect(screen.getByRole('button', { name: 'Ordered by mistake' }).props.accessibilityState).toEqual({ selected: false })
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel order' }))

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  const post = calls.find((request) => request.method === 'POST')!
  expect(await post.clone().json()).toEqual({})
})

test('Cancel refused', async () => {
  setToken('t-cancel')
  let attempts = 0
  const calls = fakeCore({
    'GET /orders/order-1': () => json(200, order()),
    'POST /orders/order-1/cancel': () => {
      attempts += 1
      if (attempts === 1) return apiError(409, 'conflict', 'order is packing')
      throw new TypeError('Network request failed')
    },
  })
  const onClose = jest.fn()
  await renderDialog(order(), onClose)

  await fireEvent.press(screen.getByRole('button', { name: 'Cancel order' }))
  expect(await screen.findByText('This order can no longer be cancelled.')).toBeTruthy()
  const refused = calls.findIndex((request) => request.method === 'POST')
  expect(calls.slice(refused + 1).some((request) => request.method === 'GET' && new URL(request.url).pathname.endsWith('/orders/order-1'))).toBe(true)

  await fireEvent.press(screen.getByRole('button', { name: 'Cancel order' }))
  expect(await screen.findByText('Could not cancel the order. Try again.')).toBeTruthy()
  expect(onClose).not.toHaveBeenCalled()
  expect(attempts).toBe(2)
})

// Both presses land before React renders the disabled state, so only the in-flight ref can stop the second one.
test('Cancel is not sent twice when pressed twice in one tick', async () => {
  setToken('t-cancel')
  const calls = fakeCore({
    'POST /orders/order-1/cancel': () => json(200, order({ status: 'cancelled' })),
  })
  const onClose = jest.fn()
  await renderDialog(order(), onClose)

  const button = screen.getByRole('button', { name: 'Cancel order' })
  await act(async () => {
    void fireEvent.press(button)
    void fireEvent.press(button)
  })

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(calls.filter((request) => request.method === 'POST')).toHaveLength(1)
})

test('Keep order is disabled while the cancel is in flight', async () => {
  setToken('t-cancel')
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  fakeCore({
    'POST /orders/order-1/cancel': async () => {
      await gate
      return json(200, order({ status: 'cancelled' }))
    },
  })
  const onClose = jest.fn()
  await renderDialog(order(), onClose)

  await fireEvent.press(screen.getByRole('button', { name: 'Cancel order' }))

  await waitFor(() => expect(screen.getByRole('button', { name: 'Keep order' }).props.accessibilityState).toMatchObject({ disabled: true }))
  release()
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
})
