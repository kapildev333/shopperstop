import { screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import Category from './app/category/[slug]'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'

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

test('unknown category', async () => {
  setPincode('560034')
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () =>
      json(200, { items: [{ id: 'c-dairy', name: 'Dairy, Bread & Eggs', slug: 'dairy-bread-eggs', sortOrder: 1, children: [] }] }),
  })

  await renderRouter({ 'category/[slug]': Category }, { initialUrl: '/category/nope' })

  expect(await screen.findByRole('heading', { name: 'Category not found' })).toHaveProp('aria-level', 1)
  expect(screen.getByRole('link', { name: 'Go to Home' })).toBeTruthy()
})
