import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { QueryClientProvider } from '@tanstack/react-query'
import { TextInput } from 'react-native'
import Home from './app/(tabs)/index'
import { queryClient } from './api'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The root layout provides the query client; a map-based render has no layout, so the test provides it.
function HomeScreen() {
  return (
    <QueryClientProvider client={queryClient}>
      <Home />
    </QueryClientProvider>
  )
}

// Until the search screen lands (task 14) the route is a stub holding the box Home opens.
function SearchStub() {
  return <TextInput accessibilityLabel="Search products" />
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

// Navigating test: the only renderRouter test in this file, so the router's module state is fresh.
test('search field opens search', async () => {
  setPincode('560034')
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () => json(200, { items: [] }),
    [`GET /stores/${storeId}/products`]: () => json(200, { items: [], page: 1, pageSize: 24, total: 0 }),
  })

  const router = await renderRouter({ index: HomeScreen, search: SearchStub }, { initialUrl: '/' })

  fireEvent.press(await screen.findByRole('button', { name: 'Search products' }))

  await waitFor(() => expect(router.getPathname()).toBe('/search'))
  expect(await screen.findByRole('textbox', { name: 'Search products' })).toBeTruthy()
})
