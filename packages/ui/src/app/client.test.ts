import { afterEach, expect, test, vi } from 'vitest'
import type { paths } from '../api/core'
import { createApiClient } from './client'
import { createTokenStore } from './session'

type Fetch = (request: Request) => Promise<Response>

const json = { 'Content-Type': 'application/json' }
const envelope = (code: string, message: string) => JSON.stringify({ error: { code, message } })
const me = { id: 'staff-1', name: 'Asha' }

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

test('client attaches the bearer token', async () => {
  const session = createTokenStore('test-token')
  session.set('tok')
  const client = createApiClient<paths>({ baseUrl: 'http://localhost/api/core/v1', session })
  const fetch = vi.fn<Fetch>(async () => new Response(JSON.stringify(me), { headers: json }))
  vi.stubGlobal('fetch', fetch)

  const result = await client.GET('/admin/me')

  expect(fetch).toHaveBeenCalledTimes(1)
  const request = fetch.mock.calls[0][0]
  expect(request.url).toBe('http://localhost/api/core/v1/admin/me')
  expect(request.headers.get('Authorization')).toBe('Bearer tok')
  expect(result.data).toEqual(me)
})

test('no session, no header', async () => {
  const client = createApiClient<paths>({ baseUrl: 'http://localhost/api/core/v1' })
  const fetch = vi.fn<Fetch>(async () => new Response(JSON.stringify(me), { headers: json }))
  vi.stubGlobal('fetch', fetch)

  await client.GET('/admin/me')

  expect(fetch.mock.calls[0][0].headers.get('Authorization')).toBeNull()
})

test('empty session, no header', async () => {
  const session = createTokenStore('test-token')
  const client = createApiClient<paths>({ baseUrl: 'http://localhost/api/core/v1', session })
  const fetch = vi.fn<Fetch>(async () => new Response(JSON.stringify(me), { headers: json }))
  vi.stubGlobal('fetch', fetch)

  await client.GET('/admin/me')

  expect(fetch.mock.calls[0][0].headers.get('Authorization')).toBeNull()
})

test('401 to the current token clears it and reports the loss', async () => {
  const session = createTokenStore('test-token')
  session.set('tok')
  const onUnauthorized = vi.fn()
  const client = createApiClient<paths>({ baseUrl: 'http://localhost/api/core/v1', session, onUnauthorized })
  vi.stubGlobal('fetch', vi.fn<Fetch>(async () => new Response(envelope('unauthorized', 'Sign in again.'), { status: 401, headers: json })))

  await client.GET('/admin/me')

  expect(session.get()).toBeUndefined()
  expect(onUnauthorized).toHaveBeenCalledTimes(1)
})

test('401 to a signed-out request keeps a session set meanwhile', async () => {
  const session = createTokenStore('test-token')
  const onUnauthorized = vi.fn()
  const client = createApiClient<paths>({ baseUrl: 'http://localhost/api/core/v1', session, onUnauthorized })
  const fetch = vi.fn<Fetch>(async () => {
    session.set('fresh')
    return new Response(envelope('unauthorized', 'Sign in again.'), { status: 401, headers: json })
  })
  vi.stubGlobal('fetch', fetch)

  await client.GET('/admin/me')

  expect(fetch.mock.calls[0][0].headers.get('Authorization')).toBeNull()
  expect(session.get()).toBe('fresh')
  expect(onUnauthorized).not.toHaveBeenCalled()
})

test('401 to a replaced token keeps the new session', async () => {
  const session = createTokenStore('test-token')
  session.set('old')
  const onUnauthorized = vi.fn()
  const client = createApiClient<paths>({ baseUrl: 'http://localhost/api/core/v1', session, onUnauthorized })
  vi.stubGlobal(
    'fetch',
    vi.fn<Fetch>(async () => {
      session.set('new')
      return new Response(envelope('unauthorized', 'Sign in again.'), { status: 401, headers: json })
    }),
  )

  await client.GET('/admin/me')

  expect(session.get()).toBe('new')
  expect(onUnauthorized).not.toHaveBeenCalled()
})

test('other failures keep the session', async () => {
  const session = createTokenStore('test-token')
  session.set('tok')
  const onUnauthorized = vi.fn()
  const client = createApiClient<paths>({ baseUrl: 'http://localhost/api/core/v1', session, onUnauthorized })
  vi.stubGlobal('fetch', vi.fn<Fetch>(async () => new Response(envelope('forbidden', 'Not for you.'), { status: 403, headers: json })))

  await client.GET('/admin/me')

  expect(session.get()).toBe('tok')
  expect(onUnauthorized).not.toHaveBeenCalled()
})

test('plain-text 502 becomes internal', async () => {
  const client = createApiClient<paths>({ baseUrl: 'http://localhost/api/core/v1' })
  vi.stubGlobal('fetch', vi.fn<Fetch>(async () => new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } })))

  const result = await client.GET('/admin/me')

  expect(result.response.status).toBe(502)
  expect(result.error).toEqual({ error: { code: 'internal', message: 'The server did not answer as expected.' } })
})

test('empty failure uses the client\'s message', async () => {
  const client = createApiClient<paths>({
    baseUrl: 'http://localhost/api/core/v1',
    failureMessage: 'Could not reach ShopperStop. Try again.',
  })
  vi.stubGlobal('fetch', vi.fn<Fetch>(async () => new Response(null, { status: 503 })))

  const result = await client.GET('/admin/me')

  expect(result.response.status).toBe(503)
  expect(result.error).toEqual({ error: { code: 'internal', message: 'Could not reach ShopperStop. Try again.' } })
})

test('enveloped failure passes unchanged', async () => {
  const client = createApiClient<paths>({ baseUrl: 'http://localhost/api/core/v1' })
  const body = { error: { code: 'conflict', message: 'Out of stock.', field: 'quantity' } }
  vi.stubGlobal('fetch', vi.fn<Fetch>(async () => new Response(JSON.stringify(body), { status: 409, headers: json })))

  const result = await client.GET('/admin/me')

  expect(result.response.status).toBe(409)
  expect(result.error).toEqual(body)
})

test('bare 401 ends the session and becomes internal', async () => {
  const session = createTokenStore('test-token')
  session.set('tok')
  const onUnauthorized = vi.fn()
  const client = createApiClient<paths>({ baseUrl: 'http://localhost/api/core/v1', session, onUnauthorized })
  vi.stubGlobal('fetch', vi.fn<Fetch>(async () => new Response(null, { status: 401 })))

  const result = await client.GET('/admin/me')

  expect(session.get()).toBeUndefined()
  expect(onUnauthorized).toHaveBeenCalledTimes(1)
  expect(result.response.status).toBe(401)
  expect(result.error?.error.code).toBe('internal')
})
