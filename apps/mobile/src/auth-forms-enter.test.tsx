import { fireEvent, render, screen } from '@testing-library/react-native'
import { RegisterScreen, SignInScreen } from './auth-forms'
import { apiError, fakeCore } from './fake-core'

// Non-navigating: the forms only send and show the answer here; no success path, so no route change.

test('enter in password signs in', async () => {
  const calls = fakeCore({
    'POST /auth/sign-in': () => apiError(401, 'unauthorized', 'Wrong email or password'),
  })
  await render(<SignInScreen />)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.test')
  await fireEvent.changeText(screen.getByLabelText('Password'), 'password123')

  await fireEvent(screen.getByLabelText('Password'), 'submitEditing')

  expect(await screen.findByText('Wrong email or password')).toBeTruthy()
  expect(calls.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toEqual([
    'POST /api/core/v1/auth/sign-in',
  ])
})

test('enter in password registers', async () => {
  const calls = fakeCore({
    'POST /auth/register': () => apiError(409, 'conflict', 'Email already registered', 'email'),
  })
  await render(<RegisterScreen />)
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Asha Rao')
  await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.test')
  await fireEvent.changeText(screen.getByLabelText('Password'), 'password123')

  await fireEvent(screen.getByLabelText('Password'), 'submitEditing')

  expect(await screen.findByText('Email already registered')).toBeTruthy()
  expect(calls.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toEqual([
    'POST /api/core/v1/auth/register',
  ])
})
