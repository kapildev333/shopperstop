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

  expect(getToken()).toBeNull()
  expect(localStorage.getItem('shopperstop:staff-token')).toBeNull()
  expect(lost).toHaveBeenCalledOnce()
})

test('401 without a session reports nothing', async () => {
  const lost = vi.fn()
  onUnauthorized(lost)
  fakeCore({ 'POST /admin/auth/sign-in': () => apiError(401, 'unauthorized') })

  await api.POST('/admin/auth/sign-in', { body: { email: 'admin@example.test', password: 'wrong' } })

  expect(lost).not.toHaveBeenCalled()
})
