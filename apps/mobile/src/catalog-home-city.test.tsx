import { screen } from '@testing-library/react-native'
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
  city: 'Bengaluru',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}

// Navigation-free: Home is the only screen rendered, so one render covers the header.
test('header names the city', async () => {
  setPincode('560034')
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () => json(200, { items: [] }),
    [`GET /stores/${storeId}/products`]: () => json(200, { items: [], page: 1, pageSize: 24, total: 0 }),
  })

  await renderRouter(appDir, { initialUrl: '/' })

  expect(await screen.findByRole('button', { name: 'Delivering to 560034, Bengaluru' })).toBeTruthy()
})
