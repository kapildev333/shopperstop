import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { QueryClientProvider } from '@tanstack/react-query'
import Search from './app/search'
import { queryClient } from './api'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The root layout provides the query client; a map-based render has no layout, so the test provides it.
function SearchScreen() {
  return (
    <QueryClientProvider client={queryClient}>
      <Search />
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
const milk = (id: string, name: string) => ({
  id,
  name,
  slug: id,
  unitLabel: '500 ml',
  mrpCents: 3000,
  priceCents: 2800,
  categoryId: 'c-milk',
  inStock: true,
  quantity: 5,
})

// Navigating test: the only renderRouter test in this file, so the router's module state is fresh.
test('search submits', async () => {
  setPincode('560034')
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () => json(200, { items: [] }),
    [`GET /stores/${storeId}/products`]: (request) =>
      new URL(request.url).searchParams.get('q') === 'milk'
        ? json(200, { items: [milk('m-1', 'Toned Milk'), milk('m-2', 'Full Cream Milk')], page: 1, pageSize: 24, total: 2 })
        : json(200, { items: [], page: 1, pageSize: 24, total: 0 }),
  })

  const router = await renderRouter({ search: SearchScreen }, { initialUrl: '/search' })

  await fireEvent.changeText(screen.getByLabelText('Search products'), ' milk ')
  await fireEvent(screen.getByLabelText('Search products'), 'submitEditing')

  expect(await screen.findByRole('heading', { name: '2 products for “milk”' })).toHaveProp('aria-level', 1)
  expect(router).toHaveSearchParams({ q: 'milk' })
})
