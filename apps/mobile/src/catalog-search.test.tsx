import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { QueryClientProvider } from '@tanstack/react-query'
import { TextInput } from 'react-native'
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
const fruits = { id: 'c-fruits', name: 'Fruits & Vegetables', slug: 'fruits-vegetables', sortOrder: 1, children: [] }
const dairy = { id: 'c-dairy', name: 'Dairy, Bread & Eggs', slug: 'dairy-bread-eggs', sortOrder: 2, children: [] }

function routes() {
  setPincode('560034')
  return fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () => json(200, { items: [fruits, dairy] }),
    [`GET /stores/${storeId}/products`]: () => json(200, { items: [], page: 1, pageSize: 24, total: 0 }),
  })
}

test('no query shows search for products', async () => {
  routes()

  await renderRouter({ search: SearchScreen }, { initialUrl: '/search' })

  expect(await screen.findByRole('heading', { name: 'Search for products' })).toHaveProp('aria-level', 1)
  expect(screen.getByText('Or browse a category.')).toBeTruthy()
  expect(await screen.findByRole('link', { name: 'Fruits & Vegetables' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Dairy, Bread & Eggs' })).toBeTruthy()
})

test('no results suggests categories', async () => {
  routes()

  await renderRouter({ search: SearchScreen }, { initialUrl: '/search?q=zzz' })

  expect(await screen.findByRole('heading', { name: 'No results for “zzz”' })).toHaveProp('aria-level', 1)
  expect(screen.getByText('Check the spelling, or browse a category instead.')).toBeTruthy()
  expect(await screen.findByRole('link', { name: 'Fruits & Vegetables' })).toHaveProp('href', '/category/fruits-vegetables')
  expect(await screen.findByRole('link', { name: 'Dairy, Bread & Eggs' })).toHaveProp('href', '/category/dairy-bread-eggs')
})

test('clear search', async () => {
  routes()
  const focus = jest.spyOn(TextInput.prototype, 'focus')

  await renderRouter({ search: SearchScreen }, { initialUrl: '/search' })

  const box = screen.getByLabelText('Search products')
  await fireEvent.changeText(box, 'milk')
  expect(screen.getByLabelText('Search products').props.value).toBe('milk')

  await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }))

  expect(screen.getByLabelText('Search products').props.value).toBe('')
  expect(focus).toHaveBeenCalled()
  focus.mockRestore()
})
