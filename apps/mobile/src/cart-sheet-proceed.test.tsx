import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Stack } from 'expo-router'
import { Text } from 'react-native'
import type { StoreProduct } from './catalog'
import { queryClient } from './api'
import { openCartSheet, setQuantity } from './cart'
import { CartSheet } from './cart-sheet'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'
import { resolvePincode } from './serviceability'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const storeId = '00000000-0000-4000-8000-000000000401'
const store = {
  id: storeId,
  name: 'Koramangala',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}
const taaza: StoreProduct = {
  id: 'p-taaza',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  categoryId: 'c-milk',
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
const SignIn = () => <Text>Sign-in stub</Text>
const Checkout = () => <Text>Checkout stub</Text>

test('proceed signed out', async () => {
  setPincode('560034')
  fakeCore({ 'GET /serviceability': () => json(200, { store }), [`GET /stores/${storeId}`]: () => json(200, store) })
  await resolvePincode('560034')
  // Four of Amul Taaza is 10800: above the 9900 minimum.
  await setQuantity(storeId, taaza, 4)

  const router = await renderRouter({ _layout: Layout, index: Index, 'sign-in': SignIn, checkout: Checkout }, { initialUrl: '/' })
  await screen.findByText('Home stub')
  await act(async () => {
    openCartSheet()
  })
  await fireEvent.press(await screen.findByRole('link', { name: 'Proceed to checkout' }))

  await waitFor(() => expect(router.getPathname()).toBe('/sign-in'))
  expect(router.getSearchParams()).toEqual({ returnTo: '/checkout' })
  expect(screen.queryByRole('heading', { name: 'My cart' })).toBeNull()
})
