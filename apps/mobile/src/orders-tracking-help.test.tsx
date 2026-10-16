import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { fakeCore, json } from './fake-core'
import { setToken } from './session'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The real route files under src/app: the root layout provides the query client, as in the app.
const appDir = `${__dirname}/app`
const id = '00000000-0000-4000-8000-000000000703'

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('Need help opens the account', async () => {
  setToken('t-order')
  fakeCore({
    [`GET /orders/${id}`]: () =>
      json(200, {
        id,
        number: 'SS-DEMOAAAD',
        storeId: '00000000-0000-4000-8000-000000000401',
        storeName: 'Koramangala',
        promisedMinutes: 10,
        status: 'placed',
        customerName: 'Asha Rao',
        address: { label: 'Home', line1: '12 80 Feet Rd', pincode: '560034' },
        subtotalCents: 10800,
        deliveryFeeCents: 2500,
        totalCents: 13300,
        paymentMethod: 'cod',
        placedAt: new Date(2026, 9, 16, 10, 2).toISOString(),
        items: [],
        events: [{ toStatus: 'placed', actorType: 'customer', createdAt: new Date(2026, 9, 16, 10, 2).toISOString() }],
      }),
    'GET /me': () => json(200, { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.com', name: 'Asha Rao' }),
    'GET /me/addresses': () => json(200, { items: [] }),
  })
  const router = await renderRouter(appDir, { initialUrl: `/orders/${id}` })

  await fireEvent.press(await screen.findByRole('button', { name: 'Need help?' }))

  expect(await screen.findByRole('heading', { name: 'My account' })).toBeTruthy()
  expect(router.getPathname()).toBe('/account')
})
