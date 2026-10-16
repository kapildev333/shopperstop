import { screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { QueryClientProvider } from '@tanstack/react-query'
import Product from './app/product/[slug]'
import { queryClient } from './api'
import { apiError, fakeCore, json } from './fake-core'
import { setPincode } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The root layout provides the query client; a map-based render has no layout, so the test provides it.
function ProductScreen() {
  return (
    <QueryClientProvider client={queryClient}>
      <Product />
    </QueryClientProvider>
  )
}

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
const dairy = { id: 'c-dairy', name: 'Dairy, Bread & Eggs', slug: 'dairy-bread-eggs', sortOrder: 1 }
const milk = { id: 'c-milk', name: 'Milk', slug: 'milk', parentId: 'c-dairy', sortOrder: 1 }
const categories = { items: [{ ...dairy, children: [milk] }] }

const curd = {
  id: 'p-curd',
  name: 'Amul Curd',
  slug: 'amul-curd',
  unitLabel: '400 g',
  mrpCents: 6000,
  priceCents: 4800,
  categoryId: 'c-milk',
  inStock: true,
  quantity: 3,
}

function routes(product: unknown, extra: Record<string, () => Response> = {}) {
  return fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () => json(200, categories),
    [`GET /stores/${storeId}/products`]: () => json(200, { items: [], page: 1, pageSize: 11, total: 0 }),
    [`GET /stores/${storeId}/products/${(product as { slug: string }).slug}`]: () => json(200, product),
    ...extra,
  })
}

test('product with a discount', async () => {
  setPincode('560034')
  routes(curd)

  await renderRouter({ 'product/[slug]': ProductScreen }, { initialUrl: '/product/amul-curd' })

  expect(await screen.findByRole('heading', { name: 'Amul Curd' })).toHaveProp('aria-level', 1)
  expect(screen.getByText('₹48')).toBeTruthy()
  expect(screen.getByText('₹60')).toHaveStyle({ textDecorationLine: 'line-through' })
  expect(screen.getByText('20% off')).toBeTruthy()
  expect(screen.getByText('Only 3 left')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add Amul Curd' })).toBeTruthy()
  expect(screen.getByText('Add to cart')).toBeTruthy()
})

test('plenty in stock', async () => {
  setPincode('560034')
  routes({ ...curd, quantity: 10 })

  await renderRouter({ 'product/[slug]': ProductScreen }, { initialUrl: '/product/amul-curd' })

  expect(await screen.findByText('10+ left')).toBeTruthy()
})

test('out of stock product', async () => {
  setPincode('560034')
  routes({ ...curd, inStock: false, quantity: 0 })

  await renderRouter({ 'product/[slug]': ProductScreen }, { initialUrl: '/product/amul-curd' })

  expect(await screen.findByRole('button', { name: 'Out of stock' })).toHaveProp('accessibilityState', { disabled: true })
  expect(screen.queryByRole('button', { name: 'Add Amul Curd' })).toBeNull()
  expect(screen.queryByText(/left/)).toBeNull()
})

test('unknown product', async () => {
  setPincode('560034')
  routes(curd, { [`GET /stores/${storeId}/products/nope`]: () => apiError(404, 'not_found') })

  await renderRouter({ 'product/[slug]': ProductScreen }, { initialUrl: '/product/nope' })

  expect(await screen.findByRole('heading', { name: 'Product not found' })).toHaveProp('aria-level', 1)
  expect(screen.getByRole('link', { name: 'Go to Home' })).toBeTruthy()
})

test('more in the category', async () => {
  setPincode('560034')
  const taaza = { id: 'p-taaza', name: 'Amul Taaza', slug: 'amul-taaza', unitLabel: '500 ml', mrpCents: 2900, priceCents: 2700, categoryId: 'c-milk', inStock: true, quantity: 3 }
  const toned = { ...taaza, id: 'p-toned', name: 'Toned Milk', slug: 'toned-milk', unitLabel: '1 l' }
  const gold = { ...taaza, id: 'p-gold', name: 'Amul Gold', slug: 'amul-gold' }
  const calls = routes(curd, {
    [`GET /stores/${storeId}/products`]: () => json(200, { items: [taaza, toned, gold, curd], page: 1, pageSize: 11, total: 4 }),
  })

  await renderRouter({ 'product/[slug]': ProductScreen }, { initialUrl: '/product/amul-curd' })

  expect(await screen.findByRole('heading', { name: 'More in Milk' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Amul Taaza' })).toHaveProp('href', '/product/amul-taaza')
  expect(screen.getByRole('link', { name: 'Toned Milk' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Amul Gold' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Amul Curd' })).toBeNull()
  expect(screen.getByText('Home / Dairy, Bread & Eggs / Milk')).toBeTruthy()
  expect(calls.some((request) => new URL(request.url).searchParams.get('categoryId') === 'c-milk')).toBe(true)
})
