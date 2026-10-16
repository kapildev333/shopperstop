import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { queryClient } from './api'
import { fakeCore, json } from './fake-core'
import type { Order } from './orders'
import { setToken } from './session'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const appDir = `${__dirname}/app`

// Placed at a local clock time on the device's current day: the card reads "Today, HH:MM".
function todayAt(hour: number, minute: number) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const placedAt = todayAt(10, 2)

const placed: Order = {
  id: '00000000-0000-4000-8000-000000000703',
  number: 'SS-DEMOAAAD',
  storeId: 'store-1',
  storeName: 'Koramangala',
  promisedMinutes: 10,
  status: 'placed',
  customerName: 'Asha Rao',
  address: { label: 'Home', line1: '12 MG Road', pincode: '560034' },
  subtotalCents: 103000,
  deliveryFeeCents: 0,
  totalCents: 103000,
  paymentMethod: 'cod',
  placedAt,
  items: [
    { productId: 'p1', name: 'Toned milk', unitLabel: '1 L', priceCents: 30000, mrpCents: 30000, quantity: 3 },
    { productId: 'p2', name: 'Brown bread', unitLabel: '400 g', priceCents: 13000, mrpCents: 13000, quantity: 1 },
  ],
  events: [{ toStatus: 'placed', actorType: 'customer', createdAt: placedAt }],
}

const cancelled: Order = {
  ...placed,
  id: '00000000-0000-4000-8000-000000000702',
  number: 'SS-DEMOAAAC',
  status: 'cancelled',
  cancelReason: 'Ordered by mistake',
  subtotalCents: 39900,
  totalCents: 39900,
  items: [{ productId: 'p3', name: 'Curd', unitLabel: '400 g', priceCents: 39900, mrpCents: 39900, quantity: 1 }],
  events: [
    { toStatus: 'placed', actorType: 'customer', createdAt: placedAt },
    { toStatus: 'cancelled', actorType: 'customer', createdAt: placedAt },
  ],
}

// Own file: expo-router keeps its navigation store at module level, so the navigating tests run apart.
test('History lists orders', async () => {
  setToken('t-history')
  const routes: Record<string, () => Response | Promise<Response>> = {
    'GET /orders': () => json(200, { items: [placed, cancelled], total: 2 }),
  }
  fakeCore(routes)
  await renderRouter(appDir, { initialUrl: '/orders' })

  const placedLink = await screen.findByRole('link', { name: /^View order SS-DEMOAAAD,/ })
  expect(within(placedLink).getByText('Placed')).toBeTruthy()
  expect(within(placedLink).getByText('Today, 10:02 · 4 items')).toBeTruthy()
  expect(within(placedLink).getByText('₹1,030')).toBeTruthy()

  const cancelledLink = screen.getByRole('link', { name: /^View order SS-DEMOAAAC,/ })
  expect(within(cancelledLink).getByText('Cancelled')).toBeTruthy()
  expect(within(cancelledLink).getByText('Today, 10:02 · 1 item')).toBeTruthy()
  expect(screen.queryByText(/Showing your latest/)).toBeNull()

  const listed = screen
    .getAllByRole('link')
    .map((link) => link.props.accessibilityLabel)
    .filter((label) => typeof label === 'string' && label.startsWith('View order '))
  expect(listed).toEqual([
    'View order SS-DEMOAAAD, Placed, Today, 10:02 · 4 items, ₹1,030',
    'View order SS-DEMOAAAC, Cancelled, Today, 10:02 · 1 item, ₹399',
  ])

  // Core holds 30 orders and lists 2: the list says so after the next read.
  routes['GET /orders'] = () => json(200, { items: [placed, cancelled], total: 30 })
  await act(() => queryClient.refetchQueries({ queryKey: ['orders'] }))
  expect(await screen.findByText('Showing your latest 2 orders.')).toBeTruthy()
})

test('Signed-out Orders tab', async () => {
  const calls = fakeCore({})
  await renderRouter(appDir, { initialUrl: '/orders' })

  expect(await screen.findByText('Sign in to see your orders')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
  expect(calls).toHaveLength(0)
})

test('Orders loading', async () => {
  setToken('t-loading')
  fakeCore({ 'GET /orders': () => new Promise<Response>(() => {}) })
  await renderRouter(appDir, { initialUrl: '/orders' })

  expect(await screen.findByLabelText('Loading')).toBeTruthy()
})

test('No orders yet', async () => {
  setToken('t-empty')
  fakeCore({ 'GET /orders': () => json(200, { items: [], total: 0 }) })
  await renderRouter(appDir, { initialUrl: '/orders' })

  expect(await screen.findByText('No orders yet')).toBeTruthy()
  expect(screen.getByText('Your past and current orders show up here.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Start shopping' })).toBeTruthy()
})

test('Orders fail to load', async () => {
  setToken('t-offline')
  // No fake yet: the read is refused, as a phone with no network refuses it.
  await renderRouter(appDir, { initialUrl: '/orders' })

  const alert = await screen.findByRole('alert')
  expect(within(alert).getByText("You're offline")).toBeTruthy()

  fakeCore({ 'GET /orders': () => json(200, { items: [placed], total: 1 }) })
  await fireEvent.press(within(alert).getByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('link', { name: /^View order SS-DEMOAAAD,/ })).toBeTruthy()
})
