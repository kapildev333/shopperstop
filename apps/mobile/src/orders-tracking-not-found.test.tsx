import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { apiError, fakeCore } from './fake-core'
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
test('Your orders from an unknown order', async () => {
  setToken('t-order')
  fakeCore({ [`GET /orders/${id}`]: () => apiError(404, 'not_found') })
  const router = await renderRouter(appDir, { initialUrl: `/orders/${id}` })

  await fireEvent.press(await screen.findByRole('button', { name: 'Your orders' }))

  await waitFor(() => expect(router.getPathname()).toBe('/orders'))
})
