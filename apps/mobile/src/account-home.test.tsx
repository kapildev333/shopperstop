import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'
import { setToken } from './session'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The real route files under src/app: the root layout provides the query client, as in the app.
const appDir = `${__dirname}/app`

const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.com', name: 'Asha Rao' }

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('Account button opens the account', async () => {
  setToken('t-acct')
  setPincode('560034')
  fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: [] }),
  })
  const router = await renderRouter(appDir, { initialUrl: '/' })

  await fireEvent.press(await screen.findByRole('button', { name: 'Account' }))

  expect(await screen.findByRole('heading', { name: 'My account' })).toBeTruthy()
  expect(router.getPathname()).toBe('/account')
})
