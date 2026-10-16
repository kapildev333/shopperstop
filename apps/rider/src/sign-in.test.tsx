import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, getToken } from './session'
import { apiError, arjun, fakeApi, json, signedInRoutes } from './fake-api'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const session = { token: 'tok', rider: arjun }

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(await screen.findByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

test('empty fields are flagged', async () => {
  const calls = fakeApi({})

  renderApp('/sign-in')
  expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('Enter your email.')).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email.')
  expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.')
  expect(calls).toHaveLength(0)
})

test('submit disabled while pending', async () => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  fakeApi({
    'POST /api/rider/v1/auth/sign-in': async () => {
      await gate
      return apiError(500, 'internal')
    },
  })

  renderApp('/sign-in')
  await fillAndSubmit('arjun@example.test', 'secret-test')

  const button = screen.getByRole('button', { name: 'Sign in' })
  await waitFor(() => expect(button).toBeDisabled())

  release()
  await waitFor(() => expect(button).toBeEnabled())
})

test('return to the page after sign-in', async () => {
  const calls = fakeApi({
    'POST /api/rider/v1/auth/sign-in': () => json(200, session),
    ...signedInRoutes(),
  })

  const router = renderApp('/sign-in?redirect=%2Fhistory')
  await fillAndSubmit('arjun@example.test', 'secret-test')

  expect(await screen.findByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/history')
  expect(getToken()).toBe('tok')
  expect(localStorage.getItem('shopperstop:rider-token')).toBe('tok')
  expect(calls.filter((call) => call.url.endsWith('/api/rider/v1/me'))).toHaveLength(0)
  const nav = screen.getByRole('navigation', { name: 'Rider' })
  expect(within(nav).getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
})

test.each([['%2F%2Fevil.example'], ['%2F%5Cevil.example']])('outside redirect ignored: %s', async (redirect) => {
  fakeApi({ 'POST /api/rider/v1/auth/sign-in': () => json(200, session), ...signedInRoutes() })

  const router = renderApp(`/sign-in?redirect=${redirect}`)
  await fillAndSubmit('arjun@example.test', 'secret-test')

  expect(await screen.findByRole('heading', { level: 1, name: 'Ready to pick up' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
  expect(getToken()).toBe('tok')
})

test('wrong credentials or inactive rider', async () => {
  fakeApi({ 'POST /api/rider/v1/auth/sign-in': () => apiError(401, 'unauthorized') })

  renderApp('/sign-in')
  await fillAndSubmit('arjun@example.test', 'wrong')

  expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is wrong, or the account is inactive.')
  expect(getToken()).toBeUndefined()
  expect(localStorage.getItem('shopperstop:rider-token')).toBeNull()
})

test('rate limited', async () => {
  fakeApi({ 'POST /api/rider/v1/auth/sign-in': () => apiError(429, 'rate_limited') })

  renderApp('/sign-in')
  await fillAndSubmit('arjun@example.test', 'secret-test')

  expect(await screen.findByRole('alert')).toHaveTextContent('Too many sign-in attempts. Try again later.')
  expect(getToken()).toBeUndefined()
})

test('service unreachable or failing', async () => {
  let attempt = 0
  fakeApi({
    'POST /api/rider/v1/auth/sign-in': () => {
      attempt += 1
      if (attempt === 1) throw new TypeError('Failed to fetch')
      return new Response(null, { status: 502 })
    },
  })

  renderApp('/sign-in')
  await fillAndSubmit('arjun@example.test', 'secret-test')
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server. Check your connection and try again.')

  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Try again.'))
  expect(getToken()).toBeUndefined()
})

test('field validation from the service', async () => {
  fakeApi({
    'POST /api/rider/v1/auth/sign-in': () => apiError(400, 'validation', 'must be a valid email address', 'email'),
  })

  renderApp('/sign-in')
  await fillAndSubmit('not-an-email', 'secret-test')

  expect(await screen.findByText('must be a valid email address')).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('must be a valid email address')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(getToken()).toBeUndefined()
})
