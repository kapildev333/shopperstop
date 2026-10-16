import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import Product from './app/product/[slug]'
import type { StoreProduct } from './catalog'
import { ProductCard } from './catalog-card'
import { queryClient } from './api'
import { apiError, fakeCore, json } from './fake-core'
import { setPincode } from './pincode'
import { resolvePincode } from './serviceability'
import { setToken } from './session'

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
  quantity: 5,
}

type Routes = Parameters<typeof fakeCore>[0]

// Core answers the open store for 560034; the store is resolved before the card renders, as the screens do.
async function serve(routes: Routes = {}) {
  setPincode('560034')
  fakeCore({ 'GET /serviceability': () => json(200, { store }), ...routes })
  await resolvePincode('560034')
}

// A server cart of Amul Taaza, every field of core's Cart.
function serverCart(quantity: number) {
  const subtotalCents = taaza.priceCents * quantity
  return {
    storeId,
    items: [{ product: taaza, quantity }],
    subtotalCents,
    deliveryFeeCents: 2500,
    totalCents: subtotalCents + 2500,
    minOrderCents: 9900,
    shortfallCents: Math.max(0, 19900 - subtotalCents),
  }
}

function card() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProductCard product={taaza} storeId={storeId} />
    </QueryClientProvider>
  )
}

// The root layout provides the query client; a map-based render has no layout, so the test provides it.
function ProductScreen() {
  return (
    <QueryClientProvider client={queryClient}>
      <Product />
    </QueryClientProvider>
  )
}

function countOf(group: ReturnType<typeof screen.getByLabelText>) {
  return within(group).getByText(/^\d+$/).props.children
}

test('failed write tells the customer', async () => {
  // Core cannot be reached: the write's fetch rejects, and the card shows the unreachable message under its stepper.
  await serve({
    'GET /me/cart': () => json(200, serverCart(1)),
    'PUT /me/cart/items': () => Promise.reject(new TypeError('Network request failed')),
  })
  setToken('t-1')
  await render(card())
  await screen.findByLabelText('Quantity of Amul Taaza')

  await fireEvent.press(screen.getByRole('button', { name: 'Add one Amul Taaza' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach ShopperStop. Try again.')
  expect(countOf(screen.getByLabelText('Quantity of Amul Taaza'))).toBe('1')
})

test("core's refusal is shown", async () => {
  await serve({
    [`GET /stores/${storeId}/products/amul-taaza`]: () => json(200, taaza),
    [`GET /stores/${storeId}/categories`]: () => json(200, { items: [] }),
    [`GET /stores/${storeId}/products`]: () => json(200, { items: [], page: 1, pageSize: 11, total: 0 }),
    'GET /me/cart': () => json(200, serverCart(1)),
    'PUT /me/cart/items': () => apiError(400, 'validation', 'product not available'),
  })
  setToken('t-1')
  await renderRouter({ 'product/[slug]': ProductScreen }, { initialUrl: '/product/amul-taaza' })

  await fireEvent.press(await screen.findByRole('button', { name: 'Add one Amul Taaza' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('product not available')
})

test('next tap clears the failure', async () => {
  // The first write fails at once; the second is held until the test releases it, then fails too.
  let failSecond: () => void = () => {}
  let writes = 0
  await serve({
    'GET /me/cart': () => json(200, serverCart(1)),
    'PUT /me/cart/items': () => {
      writes += 1
      if (writes === 1) return Promise.reject(new TypeError('Network request failed'))
      return new Promise<Response>((_, reject) => {
        failSecond = () => reject(new TypeError('Network request failed'))
      })
    },
  })
  setToken('t-1')
  await render(card())
  await screen.findByLabelText('Quantity of Amul Taaza')

  await fireEvent.press(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(await screen.findByRole('alert')).toBeTruthy()

  // The held write leaves the alert gone at once; the write's own answer brings it back.
  await fireEvent.press(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  expect(screen.queryByRole('alert')).toBeNull()
  await waitFor(() => expect(writes).toBe(2))
  failSecond()
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach ShopperStop. Try again.')
})

test('overtaken change shows no failure', async () => {
  // Core cannot be reached: two taps on the same card before any answer; only the last one's failure is shown.
  const held: Array<() => void> = []
  await serve({
    'GET /me/cart': () => json(200, serverCart(1)),
    'PUT /me/cart/items': () =>
      new Promise<Response>((_, reject) => {
        held.push(() => reject(new TypeError('Network request failed')))
      }),
  })
  setToken('t-1')
  await render(card())
  await screen.findByLabelText('Quantity of Amul Taaza')

  void fireEvent.press(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  void fireEvent.press(screen.getByRole('button', { name: 'Add one Amul Taaza' }))
  await waitFor(() => expect(held.length).toBeGreaterThan(0))
  held.forEach((fail) => fail())

  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1))
})
