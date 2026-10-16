import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const appDir = `${__dirname}/app`
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
test('categories tab lists parents', async () => {
  setPincode('560034')
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () =>
      json(200, {
        items: [
          { id: 'c-fruit', name: 'Fruits & Vegetables', slug: 'fruits-vegetables', sortOrder: 1, children: [] },
          { id: 'c-dairy', name: 'Dairy, Bread & Eggs', slug: 'dairy-bread-eggs', sortOrder: 2, children: [] },
        ],
      }),
    [`GET /stores/${storeId}/products`]: () => json(200, { items: [], page: 1, pageSize: 24, total: 0 }),
  })

  const router = await renderRouter(appDir, { initialUrl: '/' })
  await screen.findByRole('heading', { name: /^ShopperStop/ })

  await fireEvent.press(screen.getByRole('button', { name: 'Categories' }))

  expect(await screen.findByRole('heading', { name: 'Categories' })).toHaveProp('aria-level', 1)
  expect(await screen.findByRole('link', { name: 'Fruits & Vegetables' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Dairy, Bread & Eggs' })).toBeTruthy()

  await fireEvent.press(screen.getByRole('link', { name: 'Dairy, Bread & Eggs' }))
  await waitFor(() => expect(router.getPathname()).toBe('/category/dairy-bread-eggs'))
})
