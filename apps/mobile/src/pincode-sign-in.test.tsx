import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { openPincodeSheet } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const appDir = `${__dirname}/app`

test('sign-in link when signed out', async () => {
  const router = await renderRouter(appDir, { initialUrl: '/' })
  // Home's first state is on screen before the sheet opens, so the Stack has settled before the press.
  await screen.findByRole('heading', { name: 'Groceries in minutes' })
  await act(async () => {
    openPincodeSheet()
  })
  await fireEvent.press(await screen.findByRole('link', { name: 'Have an account? Sign in to use a saved address' }))
  await waitFor(() => expect(router.getPathname()).toBe('/sign-in'))
  expect(router.getSearchParams()).toEqual({ returnTo: '/' })
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
})
