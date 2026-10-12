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

test('storage that throws is tolerated', async () => {
  const blocked = () => {
    throw new DOMException('storage blocked', 'SecurityError')
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)

  const { renderHook, act } = await import('@testing-library/react')
  const { getToken, setToken, useToken } = await import('./session')
  expect(getToken()).toBeUndefined()

  const { result } = renderHook(() => useToken())
  act(() => setToken('abc'))
  expect(getToken()).toBe('abc')
  expect(result.current).toBe('abc')

  act(() => setToken(undefined))
  expect(getToken()).toBeUndefined()
  expect(result.current).toBeUndefined()
  vi.restoreAllMocks()
})
