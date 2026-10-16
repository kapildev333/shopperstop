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
test('sign in after the reset', async () => {
  setPincode('560034')
  setToken('t-1')
  fakeCore({ 'POST /auth/password-reset/confirm': () => json(204) })
  const router = await renderRouter(appDir, { initialUrl: '/reset-password?token=r-1' })
  await screen.findByRole('heading', { name: 'Reset password' })
  await fireEvent.changeText(screen.getByLabelText('New password'), 'newpass123')
  await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'newpass123')
  await fireEvent.press(screen.getByRole('button', { name: 'Set password' }))
  await screen.findByRole('button', { name: 'Sign in' })

  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
  expect(router.getPathname()).toBe('/sign-in')
})
