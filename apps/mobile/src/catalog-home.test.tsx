import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { apiError, fakeCore, json } from './fake-core'
import { setPincode } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The real route files under src/app. None of these tests navigates, so they share the file.
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
const parents = [
  { id: 'c-fruit', name: 'Fruits & Vegetables', slug: 'fruits-vegetables', sortOrder: 1, children: [] },
  { id: 'c-dairy', name: 'Dairy, Bread & Eggs', slug: 'dairy-bread-eggs', sortOrder: 2, children: [] },
  { id: 'c-snack', name: 'Snacks', slug: 'snacks', sortOrder: 3, children: [] },
]

// Fourteen products on page one; the 2nd and the 5th are out of stock.
const products = Array.from({ length: 14 }, (_, i) => ({
  id: `p-${i + 1}`,
  name: `Item ${i + 1}`,
  slug: `item-${i + 1}`,
  unitLabel: '1 pc',
  mrpCents: 1000,
  priceCents: 900,
  categoryId: 'c-fruit',
  inStock: i !== 1 && i !== 4,
  quantity: 5,
}))

function routes(extra: Record<string, () => Response> = {}) {
  return fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${storeId}/categories`]: () => json(200, { items: parents }),
    [`GET /stores/${storeId}/products`]: () => json(200, { items: products, page: 1, pageSize: 24, total: 14 }),
    ...extra,
  })
}

test('home in the tabs', async () => {
  setPincode('560034')
  routes()

  await renderRouter(appDir, { initialUrl: '/' })

  expect(await screen.findByRole('heading', { name: 'ShopperStop in 10 minutes', level: 1 })).toBeTruthy()
  expect(screen.getAllByText(/^(Home|Categories|Orders)$/).map((label) => label.props.children)).toEqual([
    'Home',
    'Categories',
    'Orders',
  ])
  expect(screen.getByRole('button', { name: 'Home', selected: true })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy()
})

test('header shows the delivery promise', async () => {
  setPincode('560034')
  routes()

  await renderRouter(appDir, { initialUrl: '/' })

  expect(await screen.findByRole('heading', { name: 'ShopperStop in 10 minutes' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Delivering to 560034' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Search products' })).toBeTruthy()
})

test('header control opens the sheet', async () => {
  setPincode('560034')
  routes()

  await renderRouter(appDir, { initialUrl: '/' })

  fireEvent.press(await screen.findByRole('button', { name: 'Delivering to 560034' }))

  expect(await screen.findByText('Where should we deliver?')).toBeTruthy()
  expect(screen.getByLabelText('Pincode')).toHaveProp('value', '560034')
})

test('no pincode notice', async () => {
  routes()

  await renderRouter(appDir, { initialUrl: '/' })

  // The first visit opens the sheet; closing it leaves the notice behind.
  fireEvent.press(await screen.findByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByText('Where should we deliver?')).toBeNull())
  expect(await screen.findByRole('heading', { name: 'Set your pincode', level: 2 })).toBeTruthy()

  // The header and the notice both offer "Choose pincode"; the notice's button is the last one.
  const choose = screen.getAllByRole('button', { name: 'Choose pincode' })
  fireEvent.press(choose[choose.length - 1])
  expect(await screen.findByText('Where should we deliver?')).toBeTruthy()
})

test('home lists categories and picks', async () => {
  setPincode('560034')
  routes()

  await renderRouter(appDir, { initialUrl: '/' })

  expect(await screen.findByRole('heading', { name: 'Shop by category' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Fruits & Vegetables' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Dairy, Bread & Eggs' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Snacks' })).toBeTruthy()

  // The first twelve in stock, in core's order: Items 2 and 5 are out of stock and left out.
  expect(screen.getByRole('heading', { name: 'Picked for you' })).toBeTruthy()
  const picks = await screen.findAllByRole('link', { name: /^Item \d+ 1 pc$/ })
  expect(picks.map((pick) => pick.props.accessibilityLabel)).toEqual([
    'Item 1 1 pc',
    'Item 3 1 pc',
    'Item 4 1 pc',
    'Item 6 1 pc',
    'Item 7 1 pc',
    'Item 8 1 pc',
    'Item 9 1 pc',
    'Item 10 1 pc',
    'Item 11 1 pc',
    'Item 12 1 pc',
    'Item 13 1 pc',
    'Item 14 1 pc',
  ])
})

test('home sections fail apart', async () => {
  setPincode('560034')
  routes({ [`GET /stores/${storeId}/categories`]: () => apiError(500, 'internal') })

  await renderRouter(appDir, { initialUrl: '/' })

  expect(await screen.findByText('Something went wrong on our side')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  expect(await screen.findByRole('link', { name: 'Item 1 1 pc' })).toBeTruthy()
})
