import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { fakeCore, json } from './fake-core'
import { setToken } from './session'

jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const appDir = `${__dirname}/app`
const orderId = '00000000-0000-4000-8000-000000000703'

const placed = {
  id: orderId,
  number: 'SS-DEMOAAAD',
  storeId: 'store-1',
  storeName: 'Koramangala',
  promisedMinutes: 10,
  status: 'placed',
  customerName: 'Asha Rao',
  address: { label: 'Home', line1: '12 MG Road', pincode: '560034' },
  subtotalCents: 39900,
  deliveryFeeCents: 0,
  totalCents: 39900,
  paymentMethod: 'cod',
  placedAt: new Date().toISOString(),
  items: [{ productId: 'p1', name: 'Curd', unitLabel: '400 g', priceCents: 39900, mrpCents: 39900, quantity: 1 }],
  events: [],
}

// Own file: one navigating test per file.
test('Card opens the order', async () => {
  setToken('t-open')
  fakeCore({
    'GET /orders': () => json(200, { items: [placed], total: 1 }),
    [`GET /orders/${orderId}`]: () => json(200, placed),
  })
  const router = await renderRouter(appDir, { initialUrl: '/orders' })

  await fireEvent.press(await screen.findByRole('link', { name: /^View order SS-DEMOAAAD,/ }))

  await waitFor(() => expect(router.getPathname()).toBe(`/orders/${orderId}`))
  expect(await screen.findByRole('heading', { name: 'Order SS-DEMOAAAD' })).toBeTruthy()
})
