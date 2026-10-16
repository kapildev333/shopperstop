import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Stack } from 'expo-router'
import { Text } from 'react-native'
import { queryClient } from './api'
import { getCartSummary, type CartProduct } from './cart'
import { cartView } from './cart-guest'
import CheckoutRoute from './app/checkout'
import OrderRoute from './app/orders/[id]'
import { fakeCore, json } from './fake-core'
import type { Order } from './orders'
import { setToken } from './session'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const storeId = '00000000-0000-4000-8000-000000000401'
const orderId = '00000000-0000-4000-8000-000000000703'
const home = { id: '00000000-0000-4000-8000-000000000301', label: 'Home', line1: '12 80 Feet Rd', line2: 'Koramangala', pincode: '560034', isDefault: true }
const taaza: CartProduct = {
  id: '00000000-0000-4000-8000-000000000601',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  inStock: true,
  quantity: 20,
}
const placedAt = new Date(2026, 9, 16, 10, 2).toISOString()
const placed: Order = {
  id: orderId,
  number: 'SS-ABCDEFGH',
  storeId,
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
  items: [{ productId: taaza.id, name: taaza.name, unitLabel: taaza.unitLabel, priceCents: 2700, mrpCents: 2900, quantity: 4 }],
  events: [{ toStatus: 'placed', actorType: 'customer', createdAt: placedAt }],
}

// The root layout's shape: the query client over the stack of routes.
function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack />
    </QueryClientProvider>
  )
}

const Stub = () => <Text>Orders stub</Text>

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('Order placed', async () => {
  setToken('t-1')
  const calls = fakeCore({
    'GET /me/cart': () => json(200, cartView({ storeId, items: [{ product: taaza, quantity: 4 }] }, { deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900 })),
    'GET /me/addresses': () => json(200, { items: [home], page: 1, pageSize: 24, total: 1 }),
    [`GET /stores/${storeId}`]: () => json(200, { id: storeId, name: 'Koramangala', isOpen: true, deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900, promisedMinutes: 10 }),
    'POST /orders': () => json(201, placed),
    [`GET /orders/${orderId}`]: () => json(200, placed),
  })
  const router = await renderRouter({ _layout: Layout, checkout: CheckoutRoute, 'orders/[id]': OrderRoute, orders: Stub }, { initialUrl: '/checkout' })
  await screen.findByText('From Koramangala')

  fireEvent.press(screen.getByRole('button', { name: 'Place order' }))

  expect(await screen.findByRole('heading', { name: 'Order SS-ABCDEFGH' })).toBeTruthy()
  await waitFor(() => expect(router.getPathname()).toBe(`/orders/${orderId}`))
  expect(getCartSummary().count).toBe(0)
  const posts = calls.filter((call) => call.method === 'POST')
  expect(posts).toHaveLength(1)
  expect(await posts[0].json()).toEqual({ addressId: home.id })
})
