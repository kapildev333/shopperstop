import { screen, within } from '@testing-library/react-native'
import { renderRouter, testRouter } from 'expo-router/testing-library'
import { fakeCore, json } from './fake-core'
import type { Order } from './orders'
import { setToken } from './session'

jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const appDir = `${__dirname}/app`

const placed: Order = {
  id: '00000000-0000-4000-8000-000000000703',
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
  events: [{ toStatus: 'placed', actorType: 'customer', createdAt: new Date().toISOString() }],
}

// Own file: one navigating test per file.
test('Statuses current on return', async () => {
  setToken('t-return')
  const routes: Record<string, () => Response | Promise<Response>> = {
    'GET /orders': () => json(200, { items: [placed], total: 1 }),
  }
  const calls = fakeCore(routes)
  await renderRouter(appDir, { initialUrl: '/orders' })
  const card = await screen.findByRole('link', { name: /^View order SS-DEMOAAAD,/ })
  expect(within(card).getByText('Placed')).toBeTruthy()

  // Core moves the order on while the customer is on Home.
  routes['GET /orders'] = () => json(200, { items: [{ ...placed, status: 'packing' }], total: 1 })
  await testRouter.navigate('/')
  await testRouter.navigate('/orders')

  expect(await within(await screen.findByRole('link', { name: /^View order SS-DEMOAAAD,/ })).findByText('Packing')).toBeTruthy()
  expect(calls.filter((request) => new URL(request.url).pathname.endsWith('/orders'))).toHaveLength(2)
})
