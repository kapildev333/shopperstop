import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { fakeCore, json } from './fake-core'
import { getToken, setToken } from './session'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The real route files under src/app: the root layout provides the query client, as in the app.
const appDir = `${__dirname}/app`

const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.com', name: 'Asha Rao' }

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('Sign out', async () => {
  setToken('t-acct')
  const calls = fakeCore({
    'GET /me': () => json(200, customer),
    'GET /me/addresses': () => json(200, { items: [] }),
    'POST /auth/sign-out': () => json(204),
  })
  const router = await renderRouter(appDir, { initialUrl: '/account' })

  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Groceries in minutes' })).toBeTruthy()
  expect(router.getPathname()).toBe('/')
  await waitFor(() => expect(getToken()).toBeUndefined())
  expect(calls.some((request) => request.method === 'POST' && new URL(request.url).pathname.endsWith('/auth/sign-out'))).toBe(true)
})
