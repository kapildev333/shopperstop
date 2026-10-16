import { screen, within } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { QueryClientProvider } from '@tanstack/react-query'
import Product from './app/product/[slug]'
import { queryClient } from './api'
import { fakeCore, json } from './fake-core'
import { setQuantity } from './cart'
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
const fruit = { id: 'c-fruit', name: 'Fruits & Vegetables', slug: 'fruits-vegetables', sortOrder: 2 }
const banana = {
  id: 'p-banana',
  name: 'Banana Robusta',
  slug: 'banana-robusta',
  unitLabel: '6 pcs',
  mrpCents: 4000,
  priceCents: 3600,
  categoryId: 'c-fruit',
  inStock: true,
  quantity: 5,
}

// Not navigating: the Home press is a cart write made before the product screen renders.
test('count follows the product across screens', async () => {
  setPincode('560034')
  setQuantity('s-1', banana.id, 1)
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () => json(200, { items: [{ ...fruit, children: [] }] }),
    [`GET /stores/${storeId}/products`]: () => json(200, { items: [], page: 1, pageSize: 11, total: 0 }),
    [`GET /stores/${storeId}/products/banana-robusta`]: () => json(200, banana),
  })

  await renderRouter({ 'product/[slug]': ProductScreen }, { initialUrl: '/product/banana-robusta' })

  expect(await screen.findByRole('heading', { name: 'Banana Robusta' })).toHaveProp('aria-level', 1)
  const group = screen.getByLabelText('Quantity of Banana Robusta')
  expect(within(group).getByText('1')).toBeTruthy()
})
