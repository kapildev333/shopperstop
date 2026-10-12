import { afterEach, expect, test, vi } from 'vitest'

const key = 'shopperstop:customer-token'

afterEach(() => {
  localStorage.clear()
  vi.resetModules()
})

test('token persisted and cleared', async () => {
  const { setToken, getToken } = await import('./session')
  setToken('t-1')
  expect(localStorage.getItem(key)).toBe('t-1')
  expect(getToken()).toBe('t-1')
  setToken(undefined)
  expect(localStorage.getItem(key)).toBeNull()
  expect(getToken()).toBeUndefined()
})

test('token restored on load', async () => {
  localStorage.setItem(key, 't-2')
  const { getToken } = await import('./session')
  expect(getToken()).toBe('t-2')
})
