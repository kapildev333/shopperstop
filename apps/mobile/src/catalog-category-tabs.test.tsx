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
const eggs = { id: 'c-eggs', name: 'Eggs', slug: 'eggs', parentId: 'c-dairy', sortOrder: 2 }

// Navigating test: the only renderRouter test in this file, so the router's module state is fresh.
test('category tabs', async () => {
  setPincode('560034')
  const calls = fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () => json(200, { items: [{ ...dairy, children: [milk, eggs] }] }),
    [`GET /stores/${storeId}/products`]: () => json(200, { items: [], page: 1, pageSize: 24, total: 0 }),
  })

  const router = await renderRouter({ 'category/[slug]': CategoryScreen }, { initialUrl: '/category/dairy-bread-eggs' })

  expect(await screen.findByRole('heading', { name: 'Dairy, Bread & Eggs' })).toHaveProp('aria-level', 1)
  expect(screen.getByLabelText('Subcategories')).toBeTruthy()
  expect(screen.getByRole('tab', { name: 'All', selected: true })).toBeTruthy()

  fireEvent.press(screen.getByRole('tab', { name: 'Milk' }))

  await waitFor(() => expect(screen.getByRole('tab', { name: 'Milk', selected: true })).toBeTruthy())
  expect(router).toHavePathname('/category/milk')
  expect(screen.getByRole('heading', { name: 'Dairy, Bread & Eggs' })).toBeTruthy()
  await waitFor(() =>
    expect(calls.some((request) => new URL(request.url).searchParams.get('categoryId') === 'c-milk')).toBe(true),
  )
})
