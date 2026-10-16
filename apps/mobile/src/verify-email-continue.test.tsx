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

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('continue opens the account', async () => {
  setPincode('560034')
  setToken('t-1')
  fakeCore({
    'GET /me': () => json(200, { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.com', name: 'Asha Rao', emailVerified: true }),
    'GET /me/addresses': () => json(200, { items: [] }),
    'POST /auth/verify-email': () => json(204),
  })
  const router = await renderRouter(appDir, { initialUrl: '/verify-email?token=c-1' })
  await screen.findByText('Your email is verified')

  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))

  expect(await screen.findByRole('heading', { name: 'My account' })).toBeTruthy()
  expect(router.getPathname()).toBe('/account')
})
