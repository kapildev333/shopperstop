import { screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The real route files under src/app: the root layout provides the query client, as in the app.
const appDir = `${__dirname}/app`

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('Signed-out account redirect', async () => {
  const router = await renderRouter(appDir, { initialUrl: '/account' })

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
  expect(router.getPathname()).toBe('/sign-in')
  expect(router.getSearchParams()).toEqual({ returnTo: '/account' })
})
