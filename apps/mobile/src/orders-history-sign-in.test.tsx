import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'

jest.mock('@expo-google-fonts/inter', () => ({
  ...jest.requireActual('@expo-google-fonts/inter'),
  useFonts: () => [true, null],
}))

const appDir = `${__dirname}/app`

// Own file: one navigating test per file.
test('Sign in from the Orders tab', async () => {
  const router = await renderRouter(appDir, { initialUrl: '/orders' })

  await fireEvent.press(await screen.findByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
  expect(router.getPathname()).toBe('/sign-in')
  expect(router.getSearchParams()).toEqual({ returnTo: '/orders' })
})
