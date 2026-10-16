import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// Own file: expo-router keeps its navigation ref at module level and no reset is exported, so a
// tab press here would leak into later renderRouter calls in the same file. Per-file isolation is the rule.
test('tab switch', async () => {
  const store = {
    id: '00000000-0000-4000-8000-000000000401',
    name: 'Koramangala',
    isOpen: true,
    deliveryFeeCents: 2500,
    freeDeliveryAboveCents: 19900,
    minOrderCents: 9900,
    promisedMinutes: 10,
  }
  setPincode('560034')
  fakeCore({
    'GET /serviceability': () => json(200, { store }),
    [`GET /stores/${store.id}/categories`]: () => json(200, { items: [] }),
    [`GET /stores/${store.id}/products`]: () => json(200, { items: [], page: 1, pageSize: 24, total: 0 }),
  })
  await renderRouter(`${__dirname}/app`, { initialUrl: '/' })
  expect(await screen.findByRole('heading', { name: /^ShopperStop/ })).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Orders' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Orders', selected: true })).toBeTruthy())
  expect(screen.queryByRole('heading', { name: /^ShopperStop/ })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Your orders' })).toBeTruthy()
})
