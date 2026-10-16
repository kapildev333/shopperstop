import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Text } from 'react-native'
import { fakeCore, json } from './fake-core'
import { getToken } from './session'
import SignIn from './app/sign-in'
import Register from './app/register'

const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.test', name: 'Asha Rao' }

// Own file: expo-router keeps its navigation store at module level, so only one navigating test runs per file.
test('register lands on Home', async () => {
  fakeCore({
    'POST /auth/register': () => json(201, { token: 't-reg', customer }),
  })
  await renderRouter({ index: () => <Text>Home</Text>, 'sign-in': SignIn, register: Register }, { initialUrl: '/register' })
  await screen.findByRole('heading', { name: 'Create account' })

  fireEvent.changeText(screen.getByLabelText('Name'), customer.name)
  fireEvent.changeText(screen.getByLabelText('Email'), customer.email)
  fireEvent.changeText(screen.getByLabelText('Password'), 'secret-pass')
  fireEvent.press(screen.getByRole('button', { name: 'Create account' }))

  await waitFor(() => expect(screen).toHavePathname('/'))
  expect(getToken()).toBe('t-reg')
})
