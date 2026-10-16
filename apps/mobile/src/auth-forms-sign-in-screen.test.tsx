import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Text } from 'react-native'
import SignIn from './app/sign-in'
import Register from './app/register'

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('sign-in screen', async () => {
  await renderRouter({ index: () => <Text>Home</Text>, 'sign-in': SignIn, register: Register }, { initialUrl: '/sign-in?returnTo=%2Faccount' })

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
  expect(screen.getByLabelText('Email')).toBeTruthy()
  expect(screen.getByLabelText('Password')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()

  await fireEvent.press(screen.getByRole('link', { name: 'Create an account' }))

  expect(await screen.findByRole('heading', { name: 'Create account' })).toBeTruthy()
  expect(screen).toHavePathname('/register')
  expect(screen).toHaveSearchParams({ returnTo: '/account' })
})
