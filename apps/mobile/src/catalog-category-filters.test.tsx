import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { QueryClientProvider } from '@tanstack/react-query'
import Category from './app/category/[slug]'
import { queryClient } from './api'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The root layout provides the query client; a map-based render has no layout, so the test provides it.
function CategoryScreen() {
  return (
    <QueryClientProvider client={queryClient}>
      <Category />
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

// Navigation-free: the category screen stays mounted, so one render covers every press.
test('filters sent to core', async () => {
  setPincode('560034')
  const calls = fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () => json(200, { items: [{ ...dairy, children: [milk] }] }),
    [`GET /stores/${storeId}/products`]: () => json(200, { items: [], page: 1, pageSize: 24, total: 0 }),
  })

  await renderRouter({ 'category/[slug]': CategoryScreen }, { initialUrl: '/category/dairy-bread-eggs' })
  await screen.findByRole('heading', { name: 'Dairy, Bread & Eggs' })
  await waitFor(() => expect(productReads(calls)).toHaveLength(1))

  await fireEvent.press(screen.getByRole('button', { name: 'In stock' }))
  await waitFor(() => expect(productReads(calls)).toHaveLength(2))
  await fireEvent.press(screen.getByRole('button', { name: 'Price: low to high' }))
  await waitFor(() => expect(productReads(calls)).toHaveLength(3))
  await fireEvent.press(screen.getByRole('button', { name: 'In stock' }))
  await waitFor(() => expect(productReads(calls)).toHaveLength(4))

  expect(productReads(calls)).toEqual([
    { page: '1', inStock: null, sort: null },
    { page: '1', inStock: 'true', sort: null },
    { page: '1', inStock: 'true', sort: 'price_asc' },
    { page: '1', inStock: null, sort: 'price_asc' },
  ])
  expect(screen.getByRole('button', { name: 'Price: low to high', selected: true })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'In stock', selected: false })).toBeTruthy()
})

// The product reads of the category, as the filter parameters core receives them.
function productReads(calls: Request[]) {
  return calls
    .filter((request) => request.method === 'GET' && new URL(request.url).pathname.endsWith('/products'))
    .map((request) => {
      const params = new URL(request.url).searchParams
      return { page: params.get('page'), inStock: params.get('inStock'), sort: params.get('sort') }
    })
}
