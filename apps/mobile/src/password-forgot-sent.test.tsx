import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { fakeCore, json } from './fake-core'
import { setPincode } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

// The real route files under src/app: the root layout provides the query client, as in the app.
const appDir = `${__dirname}/app`

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('enter the code opens the reset screen', async () => {
  setPincode('560034')
  fakeCore({ 'POST /auth/password-reset': () => json(202) })
  const router = await renderRouter(appDir, { initialUrl: '/forgot-password' })
  await screen.findByRole('heading', { name: 'Forgot password' })
  await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com')
  await fireEvent.press(screen.getByRole('button', { name: 'Send reset code' }))
  await screen.findByRole('button', { name: 'Enter the code' })

  await fireEvent.press(screen.getByRole('button', { name: 'Enter the code' }))

  expect(await screen.findByRole('heading', { name: 'Reset password' })).toBeTruthy()
  expect(router.getPathname()).toBe('/reset-password')
})
