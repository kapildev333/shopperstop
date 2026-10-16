import { afterEach, expect, test, vi } from 'vitest'
import { api, onUnauthorized } from './api'
import { clearToken, getToken, setToken } from './session'
import { admin, apiError, fakeCore, json } from './fake-core'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

test('client attaches the bearer token', async () => {
  setToken('tok')
  const calls = fakeCore({ 'GET /admin/me': () => json(200, admin) })

  const { data } = await api.GET('/admin/me')

  expect(data).toEqual(admin)
  expect(calls[0].url).toBe(`${location.origin}/api/core/v1/admin/me`)
  expect(calls[0].headers.get('Authorization')).toBe('Bearer tok')
})

test('401 with a session clears it and reports the loss', async () => {
  setToken('tok')
  const lost = vi.fn()
  onUnauthorized(lost)
  fakeCore({ 'GET /admin/me': () => apiError(401, 'unauthorized') })

  await api.GET('/admin/me')

  expect(getToken()).toBeUndefined()
  expect(localStorage.getItem('shopperstop:staff-token')).toBeNull()
  expect(lost).toHaveBeenCalledOnce()
})

test('a 401 to a signed-out request keeps a session set meanwhile', async () => {
  const lost = vi.fn()
  onUnauthorized(lost)
  const calls = fakeCore({
    'POST /admin/auth/sign-in': () => {
      setToken('fresh')
      return apiError(401, 'unauthorized')
    },
  })

  await api.POST('/admin/auth/sign-in', { body: { email: 'admin@example.test', password: 'wrong' } })

  expect(calls[0].headers.has('Authorization')).toBe(false)
  expect(getToken()).toBe('fresh')
  expect(lost).not.toHaveBeenCalled()
})

test('a 401 to a replaced token keeps the new session', async () => {
  setToken('old')
  const lost = vi.fn()
  onUnauthorized(lost)
  fakeCore({
    'GET /admin/me': () => {
      setToken('new')
      return apiError(401, 'unauthorized')
    },
  })

  await api.GET('/admin/me')

  expect(getToken()).toBe('new')
  expect(localStorage.getItem('shopperstop:staff-token')).toBe('new')
  expect(lost).not.toHaveBeenCalled()
})

test.each([
  ['no body', () => new Response(null, { status: 502 })],
  ['an empty body with its length', () => new Response(null, { status: 502, headers: { 'Content-Length': '0' } })],
  ['a plain-text body', () => new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } })],
  ['JSON that is not core\'s error', () => Response.json({ message: 'upstream down' }, { status: 502 })],
  ['an error code without a message', () => Response.json({ error: { code: 'bad_gateway' } }, { status: 502 })],
])('a failure answer with %s reaches the caller as an internal error with its status', async (_, answer) => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': answer })

  const { data, error, response } = await api.GET('/admin/me')

  expect(data).toBeUndefined()
  expect(error).toEqual({ error: { code: 'internal', message: 'The server did not answer as expected.' } })
  expect(response.status).toBe(502)
  expect(getToken()).toBe('tok')
})

test('a failure answer with core\'s error body reaches the caller unchanged', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => apiError(400, 'validation', 'must be true or false', 'lowStock') })

  const { error, response } = await api.GET('/admin/me')

  expect(error).toEqual({ error: { code: 'validation', message: 'must be true or false', field: 'lowStock' } })
  expect(response.status).toBe(400)
})

test('a success answer without a body is still a success', async () => {
  setToken('tok')
  fakeCore({ 'POST /admin/auth/sign-out': () => json(204) })

  const { error, response } = await api.POST('/admin/auth/sign-out')

  expect(error).toBeUndefined()
  expect(response.status).toBe(204)
})

test('a 401 without core\'s error body still ends the session and is an error to the caller', async () => {
  setToken('tok')
  const lost = vi.fn()
  onUnauthorized(lost)
  fakeCore({ 'GET /admin/me': () => new Response(null, { status: 401 }) })

  const { error, response } = await api.GET('/admin/me')

  expect(getToken()).toBeUndefined()
  expect(lost).toHaveBeenCalledOnce()
  expect(error).toEqual({ error: { code: 'internal', message: 'The server did not answer as expected.' } })
  expect(response.status).toBe(401)
})
