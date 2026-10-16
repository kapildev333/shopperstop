import { act, fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { openPincodeSheet } from './pincode'

// The font loader is native: under Jest it never reports loaded, so the root layout would never render.
jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const appDir = `${__dirname}/app`

test('sign-in link when signed out', async () => {
  await renderRouter(appDir, { initialUrl: '/' })
  act(() => {
    openPincodeSheet()
  })
  await fireEvent.press(await screen.findByRole('link', { name: 'Have an account? Sign in to use a saved address' }))
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
  expect(screen).toHavePathname('/sign-in')
  expect(screen).toHaveSearchParams({ returnTo: '/' })
})
