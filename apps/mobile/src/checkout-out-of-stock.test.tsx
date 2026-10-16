import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { queryClient } from './api'
import type { CartProduct } from './cart'
import { cartView } from './cart-guest'
import { CheckoutScreen } from './checkout-screen'
import { fakeCore, json } from './fake-core'
import { setToken } from './session'

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: 'Inter_400Regular',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
}))

const storeId = '00000000-0000-4000-8000-000000000401'
const home = { id: '00000000-0000-4000-8000-000000000301', label: 'Home', line1: '12 80 Feet Rd', line2: 'Koramangala', pincode: '560034', isDefault: true }
const store = {
  id: storeId,
  name: 'Koramangala',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}
const fees = { deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900 }
// Taaza has 2 in stock, so a cart asking for 3 is short; Butter is not in stock; Curd is fine.
const taaza: CartProduct = {
  id: '00000000-0000-4000-8000-000000000601',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  inStock: true,
  quantity: 2,
}
const butter: CartProduct = {
  id: '00000000-0000-4000-8000-000000000602',
  name: 'Amul Butter',
  slug: 'amul-butter',
  unitLabel: '100 g',
  mrpCents: 5600,
  priceCents: 5600,
  inStock: false,
  quantity: 0,
}
const curd: CartProduct = {
  id: '00000000-0000-4000-8000-000000000603',
  name: 'Amul Curd',
  slug: 'amul-curd',
  unitLabel: '400 g',
  mrpCents: 3500,
  priceCents: 3500,
  inStock: true,
  quantity: 20,
}

const addresses = (items: unknown[]) => json(200, { items, page: 1, pageSize: 24, total: items.length })

// The server cart as core prices it: the store's fees, the cart's own lines.
function cart(lines: { product: CartProduct; quantity: number }[]) {
  return cartView({ storeId, items: lines }, fees)
}
const threeLines = () => cart([{ product: taaza, quantity: 3 }, { product: butter, quantity: 1 }, { product: curd, quantity: 1 }])

// The screen renders under no router: each test owns one render, with the query client as the root layout provides it.
function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutScreen />
    </QueryClientProvider>,
  )
}

// Placing answers 409 out_of_stock naming the given products.
const outOfStock = (productIds: string[]) =>
  json(409, { error: { code: 'out_of_stock', message: 'some products are out of stock', productIds } })

test('Out-of-stock lines marked', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, threeLines()),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'POST /orders': () => outOfStock([taaza.id, butter.id]),
  })
  await renderScreen()
  await screen.findByText('From Koramangala')

  await fireEvent.press(screen.getByRole('button', { name: 'Place order' }))

  expect(await screen.findByText('Some products are not available in the quantity you chose.')).toBeTruthy()
  expect(screen.getByText('Remove them to place your order.')).toBeTruthy()
  expect(screen.getByText('Only 2 left')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Remove Amul Taaza' })).toBeTruthy()
  expect(screen.getByText('Out of stock')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Remove Amul Butter' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Remove Amul Curd' })).toBeNull()
  expect(screen.getByText('Remove the marked products to continue.')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Checkout' })).toBeTruthy()
})

test('Marked line removed', async () => {
  setToken('t-1')
  let lines = threeLines()
  const calls = fakeCore({
    'GET /me/cart': () => json(200, lines),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
    // Only Butter is named: Taaza is short in the cart's eyes but not marked, because core did not name it.
    'POST /orders': () => outOfStock([butter.id]),
    'PUT /me/cart/items': () => {
      lines = cart([{ product: taaza, quantity: 3 }, { product: curd, quantity: 1 }])
      return json(200, lines)
    },
  })
  await renderScreen()
  await screen.findByText('From Koramangala')
  await fireEvent.press(screen.getByRole('button', { name: 'Place order' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Remove Amul Butter' }))

  await waitFor(() => expect(screen.queryByText('Amul Butter')).toBeNull())
  const puts = calls.filter((call) => call.method === 'PUT')
  expect(puts).toHaveLength(1)
  expect(await puts[0].json()).toEqual({ storeId, productId: butter.id, quantity: 0 })
  expect(screen.queryByText('Out of stock')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Remove Amul Taaza' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Place order' })).toBeTruthy()
})

test('Failed removal at checkout', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, threeLines()),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'POST /orders': () => outOfStock([butter.id]),
    'PUT /me/cart/items': () => {
      throw new TypeError('Network request failed')
    },
  })
  await renderScreen()
  await screen.findByText('From Koramangala')
  await fireEvent.press(screen.getByRole('button', { name: 'Place order' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Remove Amul Butter' }))

  expect(await screen.findByText('Could not reach ShopperStop. Try again.')).toBeTruthy()
  expect(screen.getByText('Out of stock')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Remove Amul Butter' })).toBeTruthy()
})
