import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { queryClient } from './api'
import { getToken, setToken } from './session'
import { renderAt } from './test-data'

afterEach(() => vi.unstubAllGlobals())

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const accepted = 'If that email has an account, a reset link is on its way'
const expired = 'This reset link is invalid or has expired.'

test('forgot-password link on sign-in', async () => {
  renderAt('/sign-in')
  expect(await screen.findByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
})

test('empty email checked', async () => {
  const requests: string[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    requests.push(new URL(request.url).pathname)
    throw new TypeError('fetch failed')
  })
  renderAt('/forgot-password')
  await userEvent.click(await screen.findByRole('button', { name: 'Send reset link' }))
  expect(await screen.findByText('Enter your email')).toBeInTheDocument()
  expect(requests).toEqual([])
})

test('reset link requested', async () => {
  const posts: unknown[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    if (new URL(request.url).pathname === '/api/core/v1/auth/password-reset') {
      posts.push(await request.clone().json())
      return new Response(null, { status: 202 })
    }
    throw new TypeError('fetch failed')
  })
  renderAt('/forgot-password')
  await userEvent.type(await screen.findByLabelText('Email'), ' asha@example.com ')
  await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  expect(await screen.findByText(accepted)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Send reset link' })).not.toBeInTheDocument()
  expect(posts).toEqual([{ email: 'asha@example.com' }])
})

test('malformed email from core', async () => {
  vi.stubGlobal('fetch', async (request: Request) => {
    if (new URL(request.url).pathname === '/api/core/v1/auth/password-reset')
      return json({ error: { code: 'validation', field: 'email', message: 'must be a valid email address' } }, 400)
    throw new TypeError('fetch failed')
  })
  renderAt('/forgot-password')
  await userEvent.type(await screen.findByLabelText('Email'), 'asha')
  await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  expect(await screen.findByText('must be a valid email address')).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
})

test('too many reset requests', async () => {
  vi.stubGlobal('fetch', async (request: Request) => {
    if (new URL(request.url).pathname === '/api/core/v1/auth/password-reset')
      return json({ error: { code: 'rate_limited', message: 'too many attempts, try again later' } }, 429)
    throw new TypeError('fetch failed')
  })
  renderAt('/forgot-password')
  await userEvent.type(await screen.findByLabelText('Email'), 'asha@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('too many attempts, try again later')
  expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument()
})

test('reset form checks fields', async () => {
  const posts: string[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    if (request.method === 'POST') posts.push(new URL(request.url).pathname)
    throw new TypeError('fetch failed')
  })
  renderAt('/reset-password?token=r-1')
  await userEvent.click(await screen.findByRole('button', { name: 'Set password' }))
  expect(await screen.findByText('Enter a new password')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('New password'), 'short1')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'short1')
  await userEvent.click(screen.getByRole('button', { name: 'Set password' }))
  expect(await screen.findByText('Use 8 to 72 characters')).toBeInTheDocument()
  await userEvent.clear(screen.getByLabelText('New password'))
  await userEvent.type(screen.getByLabelText('New password'), 'newpass123')
  await userEvent.clear(screen.getByLabelText('Confirm password'))
  await userEvent.type(screen.getByLabelText('Confirm password'), 'newpass124')
  await userEvent.click(screen.getByRole('button', { name: 'Set password' }))
  expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
  expect(screen.getByLabelText('Confirm password')).toHaveAttribute('aria-invalid', 'true')
  expect(posts).toEqual([])
})

test('password reset', async () => {
  setToken('t')
  queryClient.setQueryData(['me', 't'], { id: '00000000-0000-4000-8000-000000000201', email: 'asha@example.com', name: 'Asha', emailVerified: true })
  const posts: unknown[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    if (new URL(request.url).pathname === '/api/core/v1/auth/password-reset/confirm') {
      posts.push(await request.clone().json())
      return new Response(null, { status: 204 })
    }
    throw new TypeError('fetch failed')
  })
  renderAt('/reset-password?token=r-1')
  await userEvent.type(await screen.findByLabelText('New password'), 'newpass123')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'newpass123')
  await userEvent.click(screen.getByRole('button', { name: 'Set password' }))
  expect(await screen.findByText('Your password is changed. Sign in with your new password.')).toBeInTheDocument()
  expect(posts).toEqual([{ token: 'r-1', password: 'newpass123' }])
  expect(getToken()).toBeUndefined()
  // The cache is cleared: no ['me'] query still holds the customer. (The header's disabled ['me', undefined] query may be re-created by the token drop; it holds no data.)
  expect(queryClient.getQueryData(['me', 't'])).toBeUndefined()
  expect(queryClient.getQueryCache().findAll({ queryKey: ['me'] }).filter((q) => q.state.data !== undefined)).toHaveLength(0)
  expect(within(screen.getByRole('main')).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
})

test('password refused by core', async () => {
  vi.stubGlobal('fetch', async (request: Request) => {
    if (new URL(request.url).pathname === '/api/core/v1/auth/password-reset/confirm')
      return json({ error: { code: 'validation', field: 'password', message: 'must be 8 to 72 bytes' } }, 400)
    throw new TypeError('fetch failed')
  })
  renderAt('/reset-password?token=r-1')
  await userEvent.type(await screen.findByLabelText('New password'), 'newpass123')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'newpass123')
  await userEvent.click(screen.getByRole('button', { name: 'Set password' }))
  expect(await screen.findByText('must be 8 to 72 bytes')).toBeInTheDocument()
  expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByRole('button', { name: 'Set password' })).toBeInTheDocument()
})

test('expired reset code', async () => {
  vi.stubGlobal('fetch', async (request: Request) => {
    if (new URL(request.url).pathname === '/api/core/v1/auth/password-reset/confirm')
      return json({ error: { code: 'validation', field: 'token', message: 'token is not valid' } }, 400)
    throw new TypeError('fetch failed')
  })
  renderAt('/reset-password?token=old')
  await userEvent.type(await screen.findByLabelText('New password'), 'newpass123')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'newpass123')
  await userEvent.click(screen.getByRole('button', { name: 'Set password' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(expired)
  expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
})

test('missing reset code', async () => {
  renderAt('/reset-password')
  expect(await screen.findByRole('alert')).toHaveTextContent(expired)
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
})
