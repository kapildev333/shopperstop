import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { queryClient } from './api'
import type { CartProduct } from './cart'
import { cartView } from './cart-guest'
import { CheckoutScreen } from './checkout-screen'
import { apiError, fakeCore, json } from './fake-core'
import { setToken } from './session'

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: 'Inter_400Regular',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
}))

const storeId = '00000000-0000-4000-8000-000000000401'
const home = { id: '00000000-0000-4000-8000-000000000301', label: 'Home', line1: '12 80 Feet Rd', line2: 'Koramangala', pincode: '560034', isDefault: true }
const work = { id: '00000000-0000-4000-8000-000000000302', label: 'Work', line1: '1 Park St', pincode: '560038', isDefault: false }
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

// The server cart as core prices it: the store's fees, the cart's own lines. Two Taaza and one Butter is 110, above the minimum.
function cart(lines: { product: CartProduct; quantity: number }[]) {
  return cartView({ storeId, items: lines }, fees)
}
const twoLines = () => cart([{ product: taaza, quantity: 2 }, { product: butter, quantity: 1 }])

// The screen renders under no router: each test owns one render, with the query client as the root layout provides it.
function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutScreen />
    </QueryClientProvider>,
  )
}

// Chooses an address from the "Choose address" sheet opened by "Change".
async function chooseAddress(name: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'Change address' }))
  const group = await screen.findByLabelText('Deliver to')
  await fireEvent.press(within(group).getByRole('radio', { name: `Deliver to ${name}` }))
  await waitFor(() => expect(screen.queryByLabelText('Deliver to')).toBeNull())
}

// Placing is pressed without waiting: the handler answers later, so the test waits on what the screen shows.
test('Place order sent once', async () => {
  setToken('t-1')
  let release: (reply: Response) => void = () => {}
  let posts = 0
  fakeCore({
    'GET /me/cart': () => json(200, twoLines()),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'POST /orders': () => {
      posts += 1
      // The first answer is held; its retry (a conflict) answers at once, so placing ends.
      if (posts === 1) return new Promise<Response>((resolve) => (release = resolve))
      return apiError(409, 'conflict', 'number taken')
    },
  })
  await renderScreen()
  await screen.findByText('From Koramangala')

  const button = screen.getByRole('button', { name: 'Place order' })
  fireEvent.press(button)
  fireEvent.press(button)
  await waitFor(() => expect(posts).toBe(1))
  expect(screen.getByRole('button', { name: 'Place order' })).toBeBusy()

  release(apiError(409, 'conflict', 'number taken'))
  await waitFor(() => expect(posts).toBe(2))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Place order' })).not.toBeBusy())
  expect(posts).toBe(2)
})

test('Place order sends nothing while the address list is unread', async () => {
  setToken('t-1')
  let release: (reply: Response) => void = () => {}
  const calls = fakeCore({
    'GET /me/cart': () => json(200, twoLines()),
    'GET /me/addresses': () => new Promise<Response>((resolve) => (release = resolve)),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'POST /orders': () => json(201, {}),
  })
  await renderScreen()
  await screen.findByText('Amul Taaza')

  // The bar does not block on an address that is not read yet, so the button shows; a press with no chosen address sends nothing.
  fireEvent.press(screen.getByRole('button', { name: 'Place order' }))
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0)

  release(addresses([home]))
  expect(await screen.findByText('Delivering to Home')).toBeTruthy()
})

test('Address not served', async () => {
  setToken('t-1')
  const calls = fakeCore({
    'GET /me/cart': () => json(200, twoLines()),
    'GET /me/addresses': () => addresses([home, work]),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'POST /orders': () => apiError(409, 'not_serviceable', 'not serviceable', 'addressId'),
  })
  await renderScreen()
  await screen.findByText('From Koramangala')
  await chooseAddress('Work')
  expect(await screen.findByText('Delivering to Work')).toBeTruthy()

  fireEvent.press(screen.getByRole('button', { name: 'Place order' }))

  expect(await screen.findByText('Koramangala does not deliver to this address. Choose another address or add one.')).toBeTruthy()
  expect(screen.getByText('Not delivered here')).toBeTruthy()
  expect(screen.getByText('Amul Taaza')).toBeTruthy()
  const [post] = calls.filter((call) => call.method === 'POST')
  expect(await post.json()).toEqual({ addressId: work.id })
})

test('Store closed at placement', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, twoLines()),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'POST /orders': () => apiError(409, 'not_serviceable', 'store closed'),
  })
  await renderScreen()
  await screen.findByText('From Koramangala')

  fireEvent.press(screen.getByRole('button', { name: 'Place order' }))

  expect(await screen.findByText('Koramangala is closed right now.')).toBeTruthy()
  expect(screen.queryByText('Not delivered here')).toBeNull()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Place order' })).not.toBeBusy())
})

// Each refusal is its own test: one render per test.
test('Placement fails (subtotal)', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, twoLines()),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'POST /orders': () => apiError(400, 'validation', 'below the minimum', 'subtotal'),
  })
  await renderScreen()
  await screen.findByText('From Koramangala')

  fireEvent.press(screen.getByRole('button', { name: 'Place order' }))

  expect(await screen.findByText("Your cart is below the store's minimum order.")).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Place order' })).not.toBeBusy()
})

test('Placement fails (address)', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, twoLines()),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'POST /orders': () => apiError(400, 'validation', 'address not found', 'addressId'),
  })
  await renderScreen()
  await screen.findByText('From Koramangala')

  fireEvent.press(screen.getByRole('button', { name: 'Place order' }))

  expect(await screen.findByText('Could not place your order. Try again.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Place order' })).not.toBeBusy()
})

test('Placement fails (conflict)', async () => {
  setToken('t-1')
  const calls = fakeCore({
    'GET /me/cart': () => json(200, twoLines()),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'POST /orders': () => apiError(409, 'conflict', 'number taken'),
  })
  await renderScreen()
  await screen.findByText('From Koramangala')

  fireEvent.press(screen.getByRole('button', { name: 'Place order' }))

  expect(await screen.findByText('Could not place your order. Try again.')).toBeTruthy()
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Place order' })).not.toBeBusy()
})

test('Choosing another address clears the alert', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, twoLines()),
    'GET /me/addresses': () => addresses([home, work]),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'POST /orders': () => apiError(409, 'not_serviceable', 'not serviceable', 'addressId'),
  })
  await renderScreen()
  await screen.findByText('From Koramangala')
  await chooseAddress('Work')
  expect(await screen.findByText('Delivering to Work')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Place order' }))
  expect(await screen.findByText('Koramangala does not deliver to this address. Choose another address or add one.')).toBeTruthy()

  await chooseAddress('Home')

  expect(await screen.findByText('Delivering to Home')).toBeTruthy()
  expect(screen.queryByText(/does not deliver to this address/)).toBeNull()
  expect(screen.queryByText('Not delivered here')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Change address' }))
  const group = await screen.findByLabelText('Deliver to')
  expect(within(within(group).getByRole('radio', { name: 'Deliver to Work' })).getByText('Not delivered here')).toBeTruthy()
  expect(within(within(group).getByRole('radio', { name: 'Deliver to Home' })).queryByText('Not delivered here')).toBeNull()
})

test('Core cannot be reached at placement', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me/cart': () => json(200, twoLines()),
    'GET /me/addresses': () => addresses([home]),
    [`GET /stores/${storeId}`]: () => json(200, store),
    'POST /orders': () => Promise.reject(new TypeError('Network request failed')),
  })
  await renderScreen()
  await screen.findByText('From Koramangala')

  fireEvent.press(screen.getByRole('button', { name: 'Place order' }))

  expect(
    await screen.findByText('We could not confirm your order. It may have been placed, so check Your orders before you place it again.'),
  ).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Your orders' })).toBeTruthy()
  expect(screen.getByText('Amul Taaza')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Place order' })).not.toBeBusy()
})
