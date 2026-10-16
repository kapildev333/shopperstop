import * as SecureStore from 'expo-secure-store'
import { api, call, unreachable } from './api'
import { getToken, setToken } from './session'
import { apiError, fakeCore, json } from './fake-core'

const key = 'shopperstop.customer-token'
const internal = { error: { code: 'internal', message: 'Could not reach ShopperStop. Try again.' } }

test('default core URL', async () => {
  const saved = process.env.EXPO_PUBLIC_CORE_URL
  delete process.env.EXPO_PUBLIC_CORE_URL
  try {
    let fresh!: typeof import('./api')
    jest.isolateModules(() => {
      fresh = require('./api') as typeof import('./api')
    })
    const calls = fakeCore({ 'GET /me': () => json(200, {}) })

    await fresh.api.GET('/me')

    expect(calls[0].url).toBe('http://localhost:8080/api/core/v1/me')
  } finally {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_CORE_URL
    else process.env.EXPO_PUBLIC_CORE_URL = saved
  }
})

test('bearer attached', async () => {
  setToken('t-3')
  const calls = fakeCore({ 'GET /me': () => json(200, {}) })

  await api.GET('/me')

  expect(calls[0].headers.get('Authorization')).toBe('Bearer t-3')
})

test('401 to the current token', async () => {
  setToken('t-4')
  fakeCore({ 'GET /me': () => apiError(401, 'unauthorized') })

  await api.GET('/me')

  expect(getToken()).toBeUndefined()
  expect(SecureStore.getItem(key)).toBeNull()
})

test('401 without a token keeps a new session', async () => {
  const calls = fakeCore({
    'GET /me': () => {
      setToken('fresh')
      return apiError(401, 'unauthorized')
    },
  })

  await api.GET('/me')

  expect(calls[0].headers.has('Authorization')).toBe(false)
  expect(getToken()).toBe('fresh')
  expect(SecureStore.getItem(key)).toBe('fresh')
})

test('401 to a replaced token keeps the new session', async () => {
  setToken('old')
  fakeCore({
    'GET /me': () => {
      setToken('new')
      return apiError(401, 'unauthorized')
    },
  })

  await api.GET('/me')

  expect(getToken()).toBe('new')
  expect(SecureStore.getItem(key)).toBe('new')
})

test('empty failed answer becomes internal', async () => {
  setToken('tok')
  fakeCore({ 'GET /me': () => new Response('', { status: 502 }) })

  const { error, response } = await api.GET('/me')

  expect(response.status).toBe(502)
  expect(error).toEqual(internal)
})

test('HTML failed answer becomes internal', async () => {
  setToken('tok')
  fakeCore({
    'GET /me': () =>
      new Response('<html><body>Bad Gateway</body></html>', { status: 502, headers: { 'Content-Type': 'text/html' } }),
  })

  const { error, response } = await api.GET('/me')

  expect(response.status).toBe(502)
  expect(error).toEqual(internal)
})

test('enveloped failure passes through', async () => {
  setToken('tok')
  fakeCore({ 'GET /me': () => apiError(409, 'conflict', 'Email already registered', 'email') })

  const { error, response } = await api.GET('/me')

  expect(response.status).toBe(409)
  expect(error).toEqual({ error: { code: 'conflict', message: 'Email already registered', field: 'email' } })
})

test('bare 401 ends the session and becomes internal', async () => {
  setToken('t-5')
  fakeCore({ 'GET /me': () => new Response(null, { status: 401 }) })

  const { error, response } = await api.GET('/me')

  expect(getToken()).toBeUndefined()
  expect(SecureStore.getItem(key)).toBeNull()
  expect(response.status).toBe(401)
  expect(error).toEqual(internal)
})

test('no content answer untouched', async () => {
  setToken('tok')
  fakeCore({ 'DELETE /me/addresses/a-1': () => json(204) })

  const { error, response } = await api.DELETE('/me/addresses/{id}', { params: { path: { id: 'a-1' } } })

  expect(error).toBeUndefined()
  expect(response.status).toBe(204)
})

test('failed write reports an error', async () => {
  setToken('tok')
  fakeCore({ 'PATCH /me': () => new Response('', { status: 502 }) })

  const result = await call(() => api.PATCH('/me', { body: { name: 'Asha Rao', phone: '9876543210' } }))

  expect(result).toEqual(unreachable)
})

test('unreachable core reports an error', async () => {
  // No fakeCore: the process boundary refuses the connection, as a dead core would.
  const result = await call(() => api.POST('/auth/sign-in', { body: { email: 'asha@example.test', password: 'secret-pass' } }))

  expect(result).toEqual(unreachable)
})
