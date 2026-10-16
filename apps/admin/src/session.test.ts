import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const KEY = 'shopperstop:staff-token'

// session.ts reads storage once at import, so each test imports a fresh copy.
async function freshSession() {
  vi.resetModules()
  return import('./session')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  localStorage.clear()
})

test('token is kept in memory and localStorage', async () => {
  const { getToken, setToken } = await freshSession()
  setToken('t1')
  expect(getToken()).toBe('t1')
  expect(localStorage.getItem(KEY)).toBe('t1')
})

test('token survives a reload', async () => {
  localStorage.setItem(KEY, 't2')
  const { getToken } = await freshSession()
  expect(getToken()).toBe('t2')
})

test('clear removes the token from memory and storage', async () => {
  const { clearToken, getToken, setToken } = await freshSession()
  setToken('t3')
  clearToken()
  expect(getToken()).toBeUndefined()
  expect(localStorage.getItem(KEY)).toBeNull()
})

test('blocked storage keeps the token in memory', async () => {
  const blocked = () => {
    throw new DOMException('blocked', 'SecurityError')
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)

  const { clearToken, getToken, setToken } = await freshSession()
  expect(getToken()).toBeUndefined()
  expect(() => setToken('t4')).not.toThrow()
  expect(getToken()).toBe('t4')
  expect(() => clearToken()).not.toThrow()
  expect(getToken()).toBeUndefined()
})
