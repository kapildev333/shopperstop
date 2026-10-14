import { afterEach, expect, test } from 'vitest'
import createClient from 'openapi-fetch'
import type { paths } from '@shopperstop/ui/api'
import { authMiddleware, call } from './api'
import { setToken } from './session'

const key = 'shopperstop:customer-token'
const url = 'http://localhost/api/core/v1/me'

afterEach(() => setToken(undefined))

test('bearer attached', async () => {
  setToken('t-3')
  const request = new Request(url)
  const out = await authMiddleware.onRequest!({ request } as never)
  expect((out as Request).headers.get('Authorization')).toBe('Bearer t-3')
})

test('expired session dropped', async () => {
  setToken('t-4')
  await authMiddleware.onResponse!({ response: new Response(null, { status: 401 }) } as never)
  expect(localStorage.getItem(key)).toBeNull()
  const request = new Request(url)
  const out = await authMiddleware.onRequest!({ request } as never)
  expect((out as Request).headers.get('Authorization')).toBeNull()
})

const internal = { error: { code: 'internal', message: 'Could not reach ShopperStop. Try again.' } }

test('empty failed answer becomes internal', async () => {
  const response = new Response('', { status: 502 })
  const out = (await authMiddleware.onResponse!({ response } as never)) as Response
  expect(out.status).toBe(502)
  expect(await out.json()).toEqual(internal)
})

test('HTML failed answer becomes internal', async () => {
  const response = new Response('<html><body>Bad Gateway</body></html>', {
    status: 502,
    headers: { 'Content-Type': 'text/html' },
  })
  const out = (await authMiddleware.onResponse!({ response } as never)) as Response
  expect(out.status).toBe(502)
  expect(await out.json()).toEqual(internal)
})

test('other JSON failed answer becomes internal', async () => {
  const response = new Response('{"message":"x"}', {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  })
  const out = (await authMiddleware.onResponse!({ response } as never)) as Response
  expect(out.status).toBe(500)
  expect(await out.json()).toEqual(internal)
})

test('enveloped failure passes through', async () => {
  const envelope = { error: { code: 'conflict', message: 'Email already registered', field: 'email' } }
  const response = new Response(JSON.stringify(envelope), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  })
  const out = (await authMiddleware.onResponse!({ response } as never)) as Response
  expect(out).toBe(response)
  expect(await out.json()).toEqual(envelope)
})

test('bare 401 drops the session and becomes internal', async () => {
  setToken('t-5')
  const response = new Response(null, { status: 401 })
  const out = (await authMiddleware.onResponse!({ response } as never)) as Response
  expect(localStorage.getItem(key)).toBeNull()
  expect(out.status).toBe(401)
  expect(await out.json()).toEqual(internal)
})

test('no content answer untouched', async () => {
  const response = new Response(null, { status: 204 })
  const out = (await authMiddleware.onResponse!({ response } as never)) as Response
  expect(out).toBe(response)
  expect(out.status).toBe(204)
  expect(await out.text()).toBe('')
})

test('ok JSON answer untouched', async () => {
  const response = new Response('{"items":[]}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  const out = (await authMiddleware.onResponse!({ response } as never)) as Response
  expect(out).toBe(response)
  expect(await out.json()).toEqual({ items: [] })
})

test('failed write reports an error', async () => {
  // The fetch option is the network boundary: it returns a real Response; the client, middleware and call() run as shipped.
  const client = createClient<paths>({
    baseUrl: 'http://localhost/api/core/v1',
    fetch: async () => new Response('', { status: 502 }),
  })
  client.use(authMiddleware)
  const result = await call(() => client.PATCH('/me', { body: { name: 'A', phone: '' } }))
  expect(result).toEqual({ code: 'internal', message: 'Could not reach ShopperStop. Try again.' })
})
