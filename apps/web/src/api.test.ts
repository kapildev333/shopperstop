import { afterEach, expect, test } from 'vitest'
import { api, call } from './api'
import { getToken, setToken } from './session'

const key = 'shopperstop:customer-token'
const internal = { error: { code: 'internal', message: 'Could not reach ShopperStop. Try again.' } }

// The network boundary: globalThis.fetch answers with a real Response; the shipped client runs as is.
let sent: Request[] = []
function answer(response: () => Response) {
  sent = []
  globalThis.fetch = async (request: RequestInfo | URL) => {
    sent.push(request as Request)
    return response()
  }
}

afterEach(() => {
  setToken(undefined)
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed')
  }
})

test('bearer attached', async () => {
  setToken('t-3')
  answer(() => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  await api.GET('/me')
  expect(sent[0].url).toBe(`${location.origin}/api/core/v1/me`)
  expect(sent[0].headers.get('Authorization')).toBe('Bearer t-3')
})

test('expired session dropped', async () => {
  setToken('t-4')
  answer(() => new Response(null, { status: 401 }))
  await api.GET('/me')
  expect(getToken()).toBeUndefined()
  expect(localStorage.getItem(key)).toBeNull()
  await api.GET('/me')
  expect(sent[1].headers.get('Authorization')).toBeNull()
})

test('stale 401 keeps the newer session', async () => {
  setToken('t-old')
  answer(() => {
    setToken('t-new')
    return new Response(null, { status: 401 })
  })
  await api.GET('/me')
  expect(sent[0].headers.get('Authorization')).toBe('Bearer t-old')
  expect(getToken()).toBe('t-new')
  expect(localStorage.getItem(key)).toBe('t-new')
})

test('empty failed answer becomes internal', async () => {
  answer(() => new Response('', { status: 502 }))
  const { error, response } = await api.GET('/me')
  expect(response.status).toBe(502)
  expect(error).toEqual(internal)
})

test('HTML failed answer becomes internal', async () => {
  answer(() => new Response('<html><body>Bad Gateway</body></html>', { status: 502, headers: { 'Content-Type': 'text/html' } }))
  const { error, response } = await api.GET('/me')
  expect(response.status).toBe(502)
  expect(error).toEqual(internal)
})

test('other JSON failed answer becomes internal', async () => {
  answer(() => new Response('{"message":"x"}', { status: 500, headers: { 'Content-Type': 'application/json' } }))
  const { error, response } = await api.GET('/me')
  expect(response.status).toBe(500)
  expect(error).toEqual(internal)
})

test('enveloped failure passes through', async () => {
  const envelope = { error: { code: 'conflict', message: 'Email already registered', field: 'email' } }
  answer(() => new Response(JSON.stringify(envelope), { status: 409, headers: { 'Content-Type': 'application/json' } }))
  const { error, response } = await api.POST('/auth/register', { body: { name: 'A', email: 'a@example.com', password: 'password1' } })
  expect(response.status).toBe(409)
  expect(error).toEqual(envelope)
})

test('bare 401 drops the session and becomes internal', async () => {
  setToken('t-5')
  answer(() => new Response(null, { status: 401 }))
  const { error, response } = await api.GET('/me')
  expect(localStorage.getItem(key)).toBeNull()
  expect(response.status).toBe(401)
  expect(error).toEqual(internal)
})

test('no content answer untouched', async () => {
  setToken('t-6')
  answer(() => new Response(null, { status: 204 }))
  const { error, response } = await api.POST('/auth/sign-out')
  expect(error).toBeUndefined()
  expect(response.status).toBe(204)
  expect(await response.text()).toBe('')
})

test('ok JSON answer untouched', async () => {
  answer(() => new Response('{"items":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  const { data, response } = await api.GET('/me/addresses')
  expect(response.status).toBe(200)
  expect(data).toEqual({ items: [] })
})

test('failed write reports an error', async () => {
  answer(() => new Response('', { status: 502 }))
  const result = await call(() => api.PATCH('/me', { body: { name: 'A', phone: '' } }))
  expect(result).toEqual(internal.error)
})

test('failed answer with a zero content length becomes internal', async () => {
  answer(() => new Response('', { status: 502, headers: { 'Content-Length': '0' } }))
  const result = await call(() => api.PATCH('/me', { body: { name: 'A', phone: '' } }))
  expect(result).toEqual(internal.error)
})

test('JSON that is not the envelope becomes internal', async () => {
  for (const body of ['null', '[]', '{"error":"x"}', '{"error":{"code":1}}']) {
    answer(() => new Response(body, { status: 500, headers: { 'Content-Type': 'application/json' } }))
    const { error, response } = await api.GET('/me')
    expect(response.status, body).toBe(500)
    expect(error, body).toEqual(internal)
  }
})
