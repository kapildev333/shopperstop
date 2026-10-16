import type { ReactElement } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import Categories from './app/(tabs)/categories'
import Home from './app/(tabs)/index'
import Category from './app/category/[slug]'
import Product from './app/product/[slug]'
import Search from './app/search'
import { queryClient } from './api'
import { setQuantity } from './cart'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'
import type { StoreProduct } from './catalog'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The root layout provides the query client; a map-based render has no layout, so the test provides it.
function withClient(Screen: () => ReactElement) {
  return function Wrapped() {
    return (
      <QueryClientProvider client={queryClient}>
        <Screen />
      </QueryClientProvider>
    )
  }
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
const taaza: StoreProduct = {
  id: 'p-taaza',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  categoryId: 'c-dairy',
  inStock: true,
  quantity: 5,
}
const dairy = { id: 'c-dairy', name: 'Dairy, Bread & Eggs', slug: 'dairy-bread-eggs', sortOrder: 1, children: [] }

// A guest line of one product at the resolved store, and the reads the browsing screens make.
async function routes() {
  setPincode('560034')
  await setQuantity(storeId, taaza, 2)
  return fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () => json(200, { items: [dairy] }),
    [`GET /stores/${storeId}/products`]: () => json(200, { items: [taaza], page: 1, pageSize: 24, total: 1 }),
    [`GET /stores/${storeId}/products/amul-taaza`]: () => json(200, taaza),
  })
}

test('bar on the categories tab', async () => {
  await routes()

  await renderRouter({ categories: withClient(Categories) }, { initialUrl: '/categories' })

  expect(await screen.findByRole('button', { name: /^View cart/ })).toBeTruthy()
})

test('bar on the home tab', async () => {
  await routes()

  await renderRouter({ index: withClient(Home) }, { initialUrl: '/' })

  expect(await screen.findByRole('button', { name: /^View cart/ })).toBeTruthy()
})

test('bar on a category screen', async () => {
  await routes()

  await renderRouter({ 'category/[slug]': withClient(Category) }, { initialUrl: '/category/dairy-bread-eggs' })

  expect(await screen.findByRole('button', { name: /^View cart/ })).toBeTruthy()
})

test('bar on search', async () => {
  await routes()

  await renderRouter({ search: withClient(Search) }, { initialUrl: '/search?q=milk' })

  expect(await screen.findByRole('button', { name: /^View cart/ })).toBeTruthy()
})

test('no bar on the product screen', async () => {
  await routes()

  await renderRouter({ 'product/[slug]': withClient(Product) }, { initialUrl: '/product/amul-taaza' })

  expect(await screen.findByRole('heading', { name: 'Amul Taaza' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^View cart/ })).toBeNull()
})
