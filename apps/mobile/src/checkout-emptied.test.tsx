import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Stack } from 'expo-router'
import { Text } from 'react-native'
import { queryClient } from './api'
import { getCartSummary, type CartProduct } from './cart'
import { cartView } from './cart-guest'
import CheckoutRoute from './app/checkout'
import { apiError, fakeCore, json } from './fake-core'
import { setToken } from './session'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const storeId = '00000000-0000-4000-8000-000000000401'
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

function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack />
    </QueryClientProvider>
  )
}

const Stub = () => <Text>Orders stub</Text>

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('Cart already empty goes to orders', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, cartView({ storeId, items: [{ product: taaza, quantity: 4 }] }, { deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900 })),
    'GET /me/addresses': () => json(200, { items: [home], page: 1, pageSize: 24, total: 1 }),
    [`GET /stores/${storeId}`]: () => json(200, { id: storeId, name: 'Koramangala', isOpen: true, deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900, promisedMinutes: 10 }),
    // A second press after a placement the page did not see: the cart is empty, with no field named.
    'POST /orders': () => apiError(400, 'validation', 'cart is empty'),
  })
  const router = await renderRouter({ _layout: Layout, checkout: CheckoutRoute, orders: Stub }, { initialUrl: '/checkout' })
  await screen.findByText('From Koramangala')

  await fireEvent.press(screen.getByRole('button', { name: 'Place order' }))

  expect(await screen.findByText('Orders stub')).toBeTruthy()
  await waitFor(() => expect(router.getPathname()).toBe('/orders'))
  expect(getCartSummary().count).toBe(0)
})
