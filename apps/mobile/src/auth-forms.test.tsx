import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Text } from 'react-native'
import { apiError, fakeCore, json } from './fake-core'
import { getToken } from './session'
import SignIn from './app/sign-in'
import Register from './app/register'

const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.test', name: 'Asha Rao' }

// The real sign-in and register routes, with a one-line Home so the redirect after success has a target.
function routes() {
  return { index: () => <Text>Home</Text>, 'sign-in': SignIn, register: Register }
}

test('sign-in screen', async () => {
  await renderRouter(routes(), { initialUrl: '/sign-in?returnTo=%2Faccount' })

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
  expect(screen.getByLabelText('Email')).toBeTruthy()
  expect(screen.getByLabelText('Password')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()

  fireEvent.press(screen.getByRole('link', { name: 'Create an account' }))

  expect(await screen.findByRole('heading', { name: 'Create account' })).toBeTruthy()
  expect(screen).toHavePathname('/register')
  expect(screen).toHaveSearchParams({ returnTo: '/account' })
})

test('password shown on request', async () => {
  await renderRouter(routes(), { initialUrl: '/sign-in' })
  await screen.findByRole('heading', { name: 'Sign in' })

  expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true)
  fireEvent.press(screen.getByRole('button', { name: 'Show password' }))

  expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', false)
  expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy()
})

test('required fields checked', async () => {
  const calls = fakeCore({})
  await renderRouter(routes(), { initialUrl: '/sign-in' })
  await screen.findByRole('heading', { name: 'Sign in' })

  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('Enter your email')).toBeTruthy()
  expect(screen.getByText('Enter your password')).toBeTruthy()
  expect(calls).toEqual([])
})

test('required fields checked on register', async () => {
  const calls = fakeCore({})
  await renderRouter(routes(), { initialUrl: '/register' })
  await screen.findByRole('heading', { name: 'Create account' })

  fireEvent.press(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByText('Enter your name')).toBeTruthy()
  expect(screen.getByText('Enter your email')).toBeTruthy()
  expect(screen.getByText('Enter your password')).toBeTruthy()
  expect(calls).toEqual([])
})

test('short password on register', async () => {
  const calls = fakeCore({})
  await renderRouter(routes(), { initialUrl: '/register' })
  await screen.findByRole('heading', { name: 'Create account' })

  fireEvent.changeText(screen.getByLabelText('Name'), customer.name)
  fireEvent.changeText(screen.getByLabelText('Email'), customer.email)
  fireEvent.changeText(screen.getByLabelText('Password'), 'x'.repeat(7))
  fireEvent.press(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByText('Use 8 to 72 characters')).toBeTruthy()
  expect(calls).toEqual([])
})

test('field error from the envelope', async () => {
  fakeCore({
    'POST /auth/register': () => apiError(409, 'conflict', 'Email already registered', 'email'),
  })
  await renderRouter(routes(), { initialUrl: '/register' })
  await screen.findByRole('heading', { name: 'Create account' })

  fireEvent.changeText(screen.getByLabelText('Name'), customer.name)
  fireEvent.changeText(screen.getByLabelText('Email'), customer.email)
  fireEvent.changeText(screen.getByLabelText('Password'), 'secret-pass')
  fireEvent.press(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByText('Email already registered')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('non-field error in an alert', async () => {
  fakeCore({
    'POST /auth/sign-in': () => apiError(401, 'unauthorized', 'Wrong email or password'),
  })
  await renderRouter(routes(), { initialUrl: '/sign-in' })
  await screen.findByRole('heading', { name: 'Sign in' })

  fireEvent.changeText(screen.getByLabelText('Email'), customer.email)
  fireEvent.changeText(screen.getByLabelText('Password'), 'wrong-pass')
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))

  expect(within(await screen.findByRole('alert')).getByText('Wrong email or password')).toBeTruthy()
  expect(getToken()).toBeUndefined()
})

test('register lands on Home', async () => {
  fakeCore({
    'POST /auth/register': () => json(201, { token: 't-reg', customer }),
  })
  await renderRouter(routes(), { initialUrl: '/register' })
  await screen.findByRole('heading', { name: 'Create account' })

  fireEvent.changeText(screen.getByLabelText('Name'), customer.name)
  fireEvent.changeText(screen.getByLabelText('Email'), customer.email)
  fireEvent.changeText(screen.getByLabelText('Password'), 'secret-pass')
  fireEvent.press(screen.getByRole('button', { name: 'Create account' }))

  await waitFor(() => expect(screen).toHavePathname('/'))
  expect(getToken()).toBe('t-reg')
})
