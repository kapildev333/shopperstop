import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { setPincode } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The real route files under src/app: the root layout provides the query client, as in the app.
const appDir = `${__dirname}/app`

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('forgot-password link on sign-in', async () => {
  setPincode('560034')
  const router = await renderRouter(appDir, { initialUrl: '/sign-in' })
  await screen.findByRole('heading', { name: 'Sign in' })

  await fireEvent.press(screen.getByRole('link', { name: 'Forgot password?' }))

  expect(await screen.findByRole('heading', { name: 'Forgot password' })).toBeTruthy()
  expect(router.getPathname()).toBe('/forgot-password')
})
