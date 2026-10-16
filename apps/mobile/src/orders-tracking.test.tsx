import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react-native'
import { queryClient } from './api'
import { apiError, fakeCore, json } from './fake-core'
import { orderKey, type Order } from './orders'
import { Headline, OrderTracking } from './orders-tracking'
import { setToken } from './session'
import { colors, fontFamily } from './ui/tokens'

const id = '00000000-0000-4000-8000-000000000703'
const token = 't-order'

const placedAt = new Date(2026, 9, 16, 10, 2).toISOString()

// Every field of a core Order; tests override only what they state.
function order(over: Partial<Order> = {}): Order {
  return {
    id,
    number: 'SS-DEMOAAAD',
    storeId: '00000000-0000-4000-8000-000000000401',
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
    items: [
      { productId: '00000000-0000-4000-8000-000000000601', name: 'Toned milk', unitLabel: '1 l', priceCents: 2900, mrpCents: 2900, quantity: 2 },
      { productId: '00000000-0000-4000-8000-000000000602', name: 'Whole wheat bread', unitLabel: '1 pack', priceCents: 5000, mrpCents: 5000, quantity: 1 },
    ],
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

// Non-navigating tests: the screen renders under no router, so each test owns one render.

test('Tracking shows the order', async () => {
  setToken(token)
  fakeCore({ [`GET /orders/${id}`]: () => json(200, order()) })
  await renderTracking()

  expect(await screen.findByRole('heading', { name: 'Order SS-DEMOAAAD' })).toBeTruthy()
  expect(screen.getByText('2 products · Cash on delivery')).toBeTruthy()
  expect(screen.getByText('2 × Toned milk')).toBeTruthy()
  expect(screen.getByText('₹58')).toBeTruthy()
  expect(screen.getByText('1 × Whole wheat bread')).toBeTruthy()
  expect(screen.getByText('₹50')).toBeTruthy()
  expect(screen.getByText('Delivery fee')).toBeTruthy()
  expect(screen.getByText('₹25')).toBeTruthy()
  expect(screen.getByText('Pay on delivery')).toBeTruthy()
  expect(screen.getByText('₹133')).toBeTruthy()
  expect(screen.getByText('Delivering to Home')).toBeTruthy()
  expect(screen.getByText('12 80 Feet Rd, Koramangala, 560034')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Need help?' })).toBeTruthy()
})

test('Finished order labels', async () => {
  setToken(token)
  const delivered = order({
    status: 'delivered',
    deliveryFeeCents: 0,
    subtotalCents: 9500,
    totalCents: 9500,
    items: [{ productId: '00000000-0000-4000-8000-000000000601', name: 'Toned milk', unitLabel: '1 l', priceCents: 9500, mrpCents: 9500, quantity: 1 }],
    events: [{ toStatus: 'delivered', actorType: 'staff', createdAt: placedAt }],
  })
  fakeCore({ [`GET /orders/${id}`]: () => json(200, delivered) })
  await renderTracking()

  expect(await screen.findByText('1 product · Cash on delivery')).toBeTruthy()
  expect(screen.getByText('Free')).toBeTruthy()
  expect(screen.getByText('Total')).toBeTruthy()
  expect(screen.getAllByText('₹95')).toHaveLength(2)
  expect(screen.getByText('Address: Home')).toBeTruthy()
  expect(screen.queryByText('Pay on delivery')).toBeNull()
  expect(screen.queryByText(/Delivering to/)).toBeNull()
})

test('Unknown order', async () => {
  setToken(token)
  fakeCore({ [`GET /orders/${id}`]: () => apiError(404, 'not_found') })
  await renderTracking()

  expect(await screen.findByRole('heading', { name: 'Order not found' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Your orders' })).toBeTruthy()
})

test('Tracking loading', async () => {
  setToken(token)
  fakeCore({ [`GET /orders/${id}`]: () => new Promise<Response>(() => undefined) })
  await renderTracking()

  expect(screen.getByRole('heading', { name: 'Your order' })).toBeTruthy()
  expect(screen.getByLabelText('Loading')).toBeTruthy()
})

test('Tracking fails with nothing held', async () => {
  setToken(token)
  fakeCore({ [`GET /orders/${id}`]: () => apiError(500, 'internal', 'Something went wrong') })
  await renderTracking()

  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByText('Something went wrong on our side')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Your order' })).toBeTruthy()
  expect(screen.getByText("Your order is safe. We just couldn't load its latest status.")).toBeTruthy()
})

test('Status change announced in place', async () => {
  setToken(token)
  let current = order()
  fakeCore({ [`GET /orders/${id}`]: () => json(200, current) })
  await renderTracking()

  expect((await screen.findByRole('status')).props.accessibilityLiveRegion).toBe('polite')
  expect(screen.getByRole('status').props.children).toBe('Order placed. Waiting for the store to accept it.')

  current = order({ status: 'accepted', events: [...order().events, { toStatus: 'accepted', actorType: 'staff', createdAt: placedAt }] })
  await act(() => queryClient.refetchQueries({ queryKey: orderKey(token, id) }))

  // The repeat's answer reaches the screen a tick after the refetch settles, so wait for the text.
  expect(await screen.findByText('The store accepted your order.')).toBeTruthy()
  expect(screen.getAllByRole('status')).toHaveLength(1)
})

test('Cancelled order shows the reason', async () => {
  setToken(token)
  const cancelled = order({ status: 'cancelled', cancelReason: 'Ordered by mistake' })
  let current = cancelled
  fakeCore({ [`GET /orders/${id}`]: () => json(200, current) })
  await renderTracking()

  expect(await screen.findByText('This order was cancelled. Reason: Ordered by mistake')).toBeTruthy()

  current = order({ status: 'cancelled' })
  await act(() => queryClient.refetchQueries({ queryKey: orderKey(token, id) }))

  expect(await screen.findByText('This order was cancelled.')).toBeTruthy()
  expect(screen.queryByText(/Reason:/)).toBeNull()
})

test('Timeline of a packing order', async () => {
  setToken(token)
  const packing = order({
    status: 'packing',
    events: [
      { toStatus: 'placed', actorType: 'customer', createdAt: new Date(2026, 9, 16, 10, 2).toISOString() },
      { toStatus: 'accepted', actorType: 'staff', createdAt: new Date(2026, 9, 16, 10, 3).toISOString() },
      { toStatus: 'packing', actorType: 'staff', createdAt: new Date(2026, 9, 16, 10, 4).toISOString() },
    ],
  })
  fakeCore({ [`GET /orders/${id}`]: () => json(200, packing) })
  await renderTracking()

  expect(await screen.findByText('Order status')).toBeTruthy()
  for (const step of ['Order placed', 'Accepted by store', 'Packing your order', 'Ready for pickup', 'Out for delivery', 'Delivered']) {
    expect(screen.getByText(step)).toBeTruthy()
  }
  expect(screen.getByText('10:02')).toBeTruthy()
  expect(screen.getByText('10:03')).toBeTruthy()
  expect(screen.getByText('10:04')).toBeTruthy()
  expect(screen.getAllByText(/^\d\d:\d\d$/)).toHaveLength(3)
  expect(screen.getByText('Packing your order')).toHaveStyle({ fontFamily: fontFamily(700) })
  expect(screen.getByText('Ready for pickup')).toHaveStyle({ color: colors.inkMuted })
})

test('Timeline of a cancelled order', async () => {
  setToken(token)
  const cancelled = order({
    status: 'cancelled',
    cancelReason: 'Ordered by mistake',
    events: [
      { toStatus: 'placed', actorType: 'customer', createdAt: new Date(2026, 9, 16, 10, 2).toISOString() },
      { toStatus: 'cancelled', actorType: 'customer', createdAt: new Date(2026, 9, 16, 10, 5).toISOString() },
    ],
  })
  fakeCore({ [`GET /orders/${id}`]: () => json(200, cancelled) })
  await renderTracking()

  expect(await screen.findByText('Order placed')).toBeTruthy()
  expect(screen.getByText('10:02')).toBeTruthy()
  expect(screen.getByText('10:05')).toBeTruthy()
  // The headline reads "Cancelled" too; the timeline's own step is the second.
  expect(screen.getAllByText('Cancelled')).toHaveLength(2)
  expect(screen.queryByText('Accepted by store')).toBeNull()
})

test('Rider steps name the rider', async () => {
  setToken(token)
  const at = (hour: number) => new Date(2026, 9, 16, hour, 0).toISOString()
  const delivered = order({
    status: 'delivered',
    riderName: 'Asha',
    events: [
      { toStatus: 'placed', actorType: 'customer', createdAt: at(10) },
      { toStatus: 'accepted', actorType: 'staff', createdAt: at(10) },
      { toStatus: 'packing', actorType: 'staff', createdAt: at(10) },
      { toStatus: 'ready', actorType: 'staff', createdAt: at(10) },
      { toStatus: 'out_for_delivery', actorType: 'rider', actorName: 'Asha', createdAt: at(11) },
      { toStatus: 'delivered', actorType: 'rider', actorName: 'Asha', createdAt: at(11) },
    ],
  })
  fakeCore({ [`GET /orders/${id}`]: () => json(200, delivered) })
  await renderTracking()

  expect(await screen.findByText('Picked up by Asha')).toBeTruthy()
  expect(screen.getByText('Delivered by Asha')).toBeTruthy()
  // "Accepted by store" is a step label too; only the rider's own lines name Asha.
  expect(screen.getAllByText(/by Asha$/)).toHaveLength(2)
})

test('Failed poll keeps the order', async () => {
  setToken(token)
  let reachable = true
  fakeCore({
    [`GET /orders/${id}`]: () => (reachable ? json(200, order()) : Promise.reject(new TypeError('Network request failed'))),
  })
  await renderTracking()

  expect(await screen.findByRole('heading', { name: 'Order SS-DEMOAAAD' })).toBeTruthy()
  reachable = false
  await act(() => queryClient.refetchQueries({ queryKey: orderKey(token, id) }))

  expect(screen.getByRole('heading', { name: 'Order SS-DEMOAAAD' })).toBeTruthy()
  expect(screen.getByText('Order placed. Waiting for the store to accept it.')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('Headline kept current', async () => {
  // Placed 3 minutes before the fixed clock with a 10-minute promise: 7 minutes left, then 6 after one minute.
  jest.useFakeTimers({ now: new Date(2026, 9, 16, 10, 5).getTime() })
  await render(<Headline order={order({ placedAt: new Date(2026, 9, 16, 10, 2).toISOString() })} />)

  expect(screen.getByText('Arriving in 7 min')).toBeTruthy()
  await act(() => jest.advanceTimersByTime(60_000))
  expect(screen.getByText('Arriving in 6 min')).toBeTruthy()
  jest.useRealTimers()
})
