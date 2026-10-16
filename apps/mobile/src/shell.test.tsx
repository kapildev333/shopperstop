import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The real route files under src/app: the root layout, the tabs and the not-found screen.
const appDir = `${__dirname}/app`

const store = {
  id: '00000000-0000-4000-8000-000000000401',
  name: 'Koramangala',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}

// Home needs a pincode and an open store, or the first-visit sheet covers the tabs.
function openStore() {
  setPincode('560034')
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${store.id}/categories`]: () => json(200, { items: [] }),
    [`GET /stores/${store.id}/products`]: () => json(200, { items: [], page: 1, pageSize: 24, total: 0 }),
  })
}

test('home in the tabs', async () => {
  openStore()
  await renderRouter(appDir, { initialUrl: '/' })
  expect(await screen.findByRole('heading', { name: /^ShopperStop/ })).toBeTruthy()
  expect(screen.getAllByText(/^(Home|Categories|Orders)$/).map((label) => label.props.children)).toEqual([
    'Home',
    'Categories',
    'Orders',
  ])
  expect(screen.getByRole('button', { name: 'Home', selected: true })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy()
})

test('unknown path', async () => {
  openStore()
  await renderRouter(appDir, { initialUrl: '/nope' })
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy()
  fireEvent.press(screen.getByRole('link', { name: 'Go to Home' }))
  expect(await screen.findByRole('heading', { name: /^ShopperStop/ })).toBeTruthy()
})
