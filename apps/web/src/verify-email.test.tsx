import { screen } from '@testing-library/react'
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

const expired = 'This verification link is invalid or has expired.'

test('email verified with the code', async () => {
  setToken('t')
  const seen: string[] = []
  const posts: unknown[] = []
  let verified = false
  vi.stubGlobal('fetch', async (request: Request) => {
    const path = new URL(request.url).pathname
    seen.push(`${request.method} ${path}`)
    if (path === '/api/core/v1/me') return json(me(verified))
    if (path === '/api/core/v1/auth/verify-email') {
      posts.push(await request.clone().json())
      verified = true
      return new Response(null, { status: 204 })
    }
    throw new TypeError('fetch failed')
  })
  renderAt('/verify-email?token=c-1')
  expect(await screen.findByText('Your email is verified')).toBeInTheDocument()
  expect(posts).toEqual([{ token: 'c-1' }])
  // The site reads /me again after the 204, so the banner and header see the new answer.
  const posted = seen.indexOf('POST /api/core/v1/auth/verify-email')
  expect(seen.slice(posted + 1)).toContain('GET /api/core/v1/me')
  expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/account')
})

test('expired code while signed in', async () => {
  setToken('t')
  vi.stubGlobal('fetch', async (request: Request) => {
    const path = new URL(request.url).pathname
    if (path === '/api/core/v1/me') return json(me(false))
    if (path === '/api/core/v1/auth/verify-email')
      return json({ error: { code: 'validation', field: 'token', message: 'token is not valid' } }, 400)
    throw new TypeError('fetch failed')
  })
  renderAt('/verify-email?token=old')
  expect(await screen.findByRole('alert')).toHaveTextContent(expired)
  expect(await screen.findByRole('button', { name: 'Send verification email' })).toBeInTheDocument()
})

test('missing code while signed out', async () => {
  const posts: string[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    if (request.method === 'POST') posts.push(new URL(request.url).pathname)
    throw new TypeError('fetch failed')
  })
  renderAt('/verify-email')
  expect(await screen.findByRole('alert')).toHaveTextContent(expired)
  expect(screen.getByRole('link', { name: 'Sign in to get a new link' })).toHaveAttribute(
    'href',
    '/sign-in?returnTo=%2Faccount',
  )
  expect(posts).toEqual([])
})

test('verification unreachable then retried', async () => {
  let attempts = 0
  vi.stubGlobal('fetch', async (request: Request) => {
    if (new URL(request.url).pathname === '/api/core/v1/auth/verify-email') {
      attempts += 1
      if (attempts === 1) throw new TypeError('fetch failed')
      return new Response(null, { status: 204 })
    }
    throw new TypeError('fetch failed')
  })
  renderAt('/verify-email?token=c-1')
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach ShopperStop. Try again.')
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Your email is verified')).toBeInTheDocument()
  expect(attempts).toBe(2)
})
