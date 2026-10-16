import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { setToken } from './session'
import { renderAt } from './test-data'

afterEach(() => vi.unstubAllGlobals())

const me = (emailVerified: boolean) => ({
  id: '00000000-0000-4000-8000-000000000201',
  email: 'asha@example.com',
  name: 'Asha',
  emailVerified,
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const banner = 'Verify your email to pay online'
const send = 'Send verification email'

test('unverified customer sees the banner', async () => {
  setToken('t')
  vi.stubGlobal('fetch', async (request: Request) => {
    if (new URL(request.url).pathname === '/api/core/v1/me') return json(me(false))
    throw new TypeError('fetch failed')
  })
  renderAt('/account')
  expect(await screen.findByText(banner)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: send })).toBeInTheDocument()
  cleanup()
  renderAt('/checkout')
  expect(await screen.findByText(banner)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: send })).toBeInTheDocument()
})

test('verified customer sees no banner', async () => {
  setToken('t')
  vi.stubGlobal('fetch', async (request: Request) => {
    if (new URL(request.url).pathname === '/api/core/v1/me') return json(me(true))
    throw new TypeError('fetch failed')
  })
  renderAt('/account')
  expect(await screen.findByRole('heading', { level: 1, name: 'Your account' })).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Sign out' })).toBeInTheDocument())
  expect(screen.queryByText(banner)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: send })).not.toBeInTheDocument()
})

test('verification email sent', async () => {
  setToken('t')
  const seen: string[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    const path = new URL(request.url).pathname
    if (path === '/api/core/v1/me') return json(me(false))
    if (path === '/api/core/v1/me/email-verification') {
      seen.push(`${request.method} ${path}`)
      return new Response(null, { status: 202 })
    }
    throw new TypeError('fetch failed')
  })
  renderAt('/account')
  await userEvent.click(await screen.findByRole('button', { name: send }))
  expect(await screen.findByText('Verification email sent')).toBeInTheDocument()
  expect(seen).toEqual(['POST /api/core/v1/me/email-verification'])
  expect(screen.queryByRole('button', { name: send })).not.toBeInTheDocument()
})

test('already verified when sending', async () => {
  setToken('t')
  let verified = false
  const seen: string[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    const path = new URL(request.url).pathname
    seen.push(`${request.method} ${path}`)
    if (path === '/api/core/v1/me') return json(me(verified))
    if (path === '/api/core/v1/me/email-verification') {
      verified = true
      return json({ error: { code: 'conflict', message: 'Your email is already verified' } }, 409)
    }
    throw new TypeError('fetch failed')
  })
  renderAt('/account')
  await userEvent.click(await screen.findByRole('button', { name: send }))
  await waitFor(() => expect(screen.queryByText(banner)).not.toBeInTheDocument())
  expect(seen.filter((line) => line === 'GET /api/core/v1/me')).toHaveLength(2)
})

test('sending fails', async () => {
  setToken('t')
  vi.stubGlobal('fetch', async (request: Request) => {
    const path = new URL(request.url).pathname
    if (path === '/api/core/v1/me') return json(me(false))
    throw new TypeError('fetch failed')
  })
  renderAt('/account')
  await userEvent.click(await screen.findByRole('button', { name: send }))
  // The addresses card also shows an alert here, so the banner's is found by its text.
  expect(await screen.findByText('Could not reach ShopperStop. Try again.')).toHaveAttribute('role', 'alert')
  const button = screen.getByRole('button', { name: send })
  expect(button).toBeEnabled()
  expect(button).not.toHaveAttribute('aria-busy')
})
