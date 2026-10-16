import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Stack } from 'expo-router'
import { Text } from 'react-native'
import { queryClient } from './api'
import { CartSheet } from './cart-sheet'
import { cartView } from './cart-guest'
import CheckoutRoute from './app/checkout'
import type { CartProduct } from './cart'
import { fakeCore, json } from './fake-core'
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

// The root layout's shape: the stack of routes and the cart sheet, which every route can open.
function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack />
      <CartSheet />
    </QueryClientProvider>
  )
}

const Index = () => <Text>Home stub</Text>

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('Back to cart opens the cart sheet', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, cartView({ storeId, items: [{ product: taaza, quantity: 1 }] }, { deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900 })),
    'GET /me/addresses': () => json(200, { items: [home], page: 1, pageSize: 24, total: 1 }),
    [`GET /stores/${storeId}`]: () => json(200, { id: storeId, name: 'Koramangala', isOpen: true, deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900, promisedMinutes: 10 }),
  })
  const router = await renderRouter({ _layout: Layout, index: Index, checkout: CheckoutRoute }, { initialUrl: '/checkout' })

  await fireEvent.press(await screen.findByRole('button', { name: 'Back to cart' }))

  await waitFor(() => expect(router.getPathname()).toBe('/'))
  expect(await screen.findByRole('heading', { name: 'My cart' })).toBeTruthy()
})
