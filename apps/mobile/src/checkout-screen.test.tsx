import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { queryClient } from './api'
import type { CartProduct } from './cart'
import { cartView, emptyCart } from './cart-guest'
import { CheckoutScreen } from './checkout-screen'
import { apiError, fakeCore, json } from './fake-core'
import { setPincode } from './pincode'
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
const butter: CartProduct = {
  id: '00000000-0000-4000-8000-000000000602',
  name: 'Amul Butter',
  slug: 'amul-butter',
  unitLabel: '100 g',
  mrpCents: 5600,
  priceCents: 5600,
  inStock: true,
  quantity: 20,
}

const addresses = (items: unknown[]) => json(200, { items, page: 1, pageSize: 24, total: items.length })

// The server cart as core prices it: the store's fees, the cart's own lines.
function cart(lines: { product: CartProduct; quantity: number }[], over: Partial<typeof store> = {}) {
  return cartView({ storeId, items: lines }, { ...fees, ...over })
}

// The screen renders under no router: each test owns one render, with the query client as the root layout provides it.
function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutScreen />
    </QueryClientProvider>,
  )
}

test('Checkout summary from the cart', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, cart([{ product: taaza, quantity: 2 }, { product: butter, quantity: 1 }])),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
  })
  await renderScreen()

  expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeTruthy()
  expect(await screen.findByText('Delivery in 10 minutes')).toBeTruthy()
  expect(screen.getByText('From Koramangala')).toBeTruthy()
  expect(screen.getByText('Amul Taaza')).toBeTruthy()
  expect(screen.getByText('2 × 500 ml')).toBeTruthy()
  expect(screen.getByText('₹54')).toBeTruthy()
  expect(screen.getByText('Amul Butter')).toBeTruthy()
  expect(screen.getByText('1 × 100 g')).toBeTruthy()
  expect(screen.getByText('₹56')).toBeTruthy()
})

test('Summary names the cart\'s store', async () => {
  setToken('t-1')
  setPincode('560038')
  fakeCore({
    'GET /serviceability': () => json(200, { store: { ...store, id: '00000000-0000-4000-8000-000000000402', name: 'Indiranagar' } }),
    'GET /me/cart': () => json(200, cart([{ product: taaza, quantity: 2 }, { product: butter, quantity: 1 }])),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
  })
  await renderScreen()

  expect(await screen.findByText('From Koramangala')).toBeTruthy()
  expect(screen.getByText('Delivery in 10 minutes')).toBeTruthy()
  expect(screen.queryByText(/Indiranagar/)).toBeNull()
})

test('Cash on delivery and bill', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, cart([{ product: taaza, quantity: 2 }, { product: butter, quantity: 1 }])),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
  })
  await renderScreen()

  expect(await screen.findByText('Payment')).toBeTruthy()
  expect(screen.getByText('Cash on delivery')).toBeTruthy()
  expect(screen.getByText('Pay the rider in cash')).toBeTruthy()
  expect(screen.getByText('UPI and cards come with the payment service.')).toBeTruthy()
  expect(screen.getByText('Items total')).toBeTruthy()
  expect(screen.getByText('₹110')).toBeTruthy()
  expect(screen.getByText('Delivery fee')).toBeTruthy()
  expect(screen.getByText('₹25')).toBeTruthy()
  expect(screen.getByText('To pay')).toBeTruthy()
  // The bill's total and the button's amount.
  expect(screen.getAllByText('₹135')).toHaveLength(2)
})

test('Free delivery at checkout', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, cart([{ product: taaza, quantity: 2 }, { product: butter, quantity: 1 }], { freeDeliveryAboveCents: 10000 })),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
  })
  await renderScreen()

  expect(await screen.findByText('FREE')).toBeTruthy()
  expect(screen.queryByText('₹25')).toBeNull()
})

test('Empty checkout', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, cartView(emptyCart)),
    'GET /me/addresses': () => addresses([home]),
  })
  await renderScreen()

  expect(await screen.findByText('Your cart is empty')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Start shopping' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Your orders' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Place order' })).toBeNull()
})

test('Loading and failed checkout', async () => {
  setToken('t-1')
  let release: (failure: TypeError) => void = () => {}
  let reads = 0
  fakeCore({
    // The first read is held, then core cannot be reached; the next read answers.
    'GET /me/cart': () => {
      reads += 1
      if (reads === 1) return new Promise<Response>((_, reject) => (release = reject))
      return json(200, cart([{ product: taaza, quantity: 2 }]))
    },
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
  })
  await renderScreen()

  expect(await screen.findByLabelText('Loading')).toBeTruthy()
  release(new TypeError('Network request failed'))
  expect(await screen.findByText("You're offline")).toBeTruthy()

  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Amul Taaza')).toBeTruthy()
})

test('Checkout below the minimum', async () => {
  setToken('t-1')
  fakeCore({
    // Two of Amul Taaza is 5400: below the 9900 minimum.
    'GET /me/cart': () => json(200, cart([{ product: taaza, quantity: 2 }])),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
  })
  await renderScreen()

  expect(await screen.findByText('Minimum order is ₹99. Add ₹45 more to place the order.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Place order' })).toBeNull()
})

test('Minimum from the cart when the pincode is not served', async () => {
  setToken('t-1')
  setPincode('560099')
  fakeCore({
    'GET /serviceability': () => apiError(404, 'not_serviceable'),
    'GET /me/cart': () => json(200, cart([{ product: taaza, quantity: 2 }])),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
  })
  await renderScreen()

  expect(await screen.findByText('Minimum order is ₹99. Add ₹45 more to place the order.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Place order' })).toBeNull()
})

test('No address blocks placing', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, cart([{ product: taaza, quantity: 2 }, { product: butter, quantity: 1 }])),
    'GET /me/addresses': () => addresses([]),
    [`GET /stores/${storeId}`]: () => json(200, store),
  })
  await renderScreen()

  expect(await screen.findByText('Add an address to place the order.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Place order' })).toBeNull()
})

test('Place order shows the amount', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, cart([{ product: taaza, quantity: 2 }, { product: butter, quantity: 1 }])),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
  })
  await renderScreen()

  const button = await screen.findByRole('button', { name: 'Place order' })
  expect(within(button).getByText('₹135')).toBeTruthy()
})
