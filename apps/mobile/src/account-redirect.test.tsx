import { screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import Account from './app/account'
import SignIn from './app/sign-in'
import { Text } from 'react-native'

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('Signed-out account redirect', async () => {
  const router = await renderRouter({ index: () => <Text>Home</Text>, account: Account, 'sign-in': SignIn }, { initialUrl: '/account' })

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
  expect(router.getPathname()).toBe('/sign-in')
  expect(router.getSearchParams()).toEqual({ returnTo: '/account' })
})
