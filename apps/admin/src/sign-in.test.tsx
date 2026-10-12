import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, getToken } from './session'
import { admin, apiError, fakeCore, json } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const session = { token: 'tok', staff: admin }

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(await screen.findByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

test('sign-in form has labelled fields and one h1', async () => {
  const calls = fakeCore({})

  renderApp('/sign-in')

  expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit')
  expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument()
  expect(calls).toHaveLength(0)
})

test('empty fields are flagged without a request', async () => {
  const calls = fakeCore({})

  renderApp('/sign-in')
  await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('Enter your email.')).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email.')
  expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.')
  expect(calls).toHaveLength(0)
})

test.each([
  ['wrong credentials', () => apiError(401, 'unauthorized'), 'Email or password is wrong, or the account is inactive.'],
  ['rate limited', () => apiError(429, 'rate_limited'), 'Too many sign-in attempts. Try again later.'],
  ['any other error', () => apiError(500, 'internal'), 'Something went wrong. Try again.'],
  ['network error', () => Promise.reject(new TypeError('Failed to fetch')), 'Could not reach the server. Check your connection and try again.'],
])('%s shows an error banner', async (_name, answer, message) => {
  fakeCore({ 'POST /admin/auth/sign-in': answer })

  renderApp('/sign-in')
  await fillAndSubmit('admin@example.test', 'secret-test')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(message)
  expect(getToken()).toBeNull()
  expect(localStorage.getItem('shopperstop:staff-token')).toBeNull()
})

test('validation error is shown on its field', async () => {
  fakeCore({
    'POST /admin/auth/sign-in': () => apiError(400, 'validation', 'must be a valid email address', 'email'),
  })

  renderApp('/sign-in')
  await fillAndSubmit('not-an-email', 'secret-test')

  expect(await screen.findByText('must be a valid email address')).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('must be a valid email address')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(getToken()).toBeNull()
})

test('submit is disabled while signing in', async () => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  fakeCore({
    'POST /admin/auth/sign-in': async () => {
      await gate
      return apiError(500, 'internal')
    },
  })

  renderApp('/sign-in')
  await fillAndSubmit('admin@example.test', 'secret-test')

  const button = screen.getByRole('button', { name: 'Sign in' })
  await waitFor(() => expect(button).toBeDisabled())

  release()
  await waitFor(() => expect(button).toBeEnabled())
})

test('success stores the token and returns to the redirect', async () => {
  const calls = fakeCore({
    'POST /admin/auth/sign-in': () => json(200, session),
    'GET /admin/me': () => json(200, admin),
  })

  const router = renderApp('/sign-in?redirect=%2Fstock')
  await fillAndSubmit('admin@example.test', 'secret-test')

  expect(await screen.findByRole('heading', { level: 1, name: 'Stock' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/stock')
  expect(getToken()).toBe('tok')
  expect(localStorage.getItem('shopperstop:staff-token')).toBe('tok')
  expect(calls.filter((call) => call.url.endsWith('/admin/me'))).toHaveLength(0)
  const nav = screen.getByRole('navigation', { name: 'Admin' })
  expect(within(nav).getByRole('link', { name: 'Stock' })).toHaveAttribute('aria-current', 'page')
})

test.each([['%2F%2Fevil.example'], ['%2F%5Cevil.example']])('an outside redirect is ignored: %s', async (redirect) => {
  fakeCore({ 'POST /admin/auth/sign-in': () => json(200, session) })

  const router = renderApp(`/sign-in?redirect=${redirect}`)
  await fillAndSubmit('admin@example.test', 'secret-test')

  expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
  expect(getToken()).toBe('tok')
})
