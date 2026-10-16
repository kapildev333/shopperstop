import { afterEach, expect, test, vi } from 'vitest'
import { createTokenStore } from './session'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

test('stored token is read at creation', () => {
  localStorage.setItem('shopperstop:staff-token', 'tok')
  expect(createTokenStore('shopperstop:staff-token').get()).toBe('tok')
})

test('set and clear persist and notify', () => {
  const store = createTokenStore('shopperstop:customer-token')
  const listener = vi.fn()
  store.subscribe(listener)

  store.set('a')
  expect(localStorage.getItem('shopperstop:customer-token')).toBe('a')
  expect(store.get()).toBe('a')

  store.set(undefined)
  expect(localStorage.getItem('shopperstop:customer-token')).toBeNull()
  expect(store.get()).toBeUndefined()
  expect(listener).toHaveBeenCalledTimes(2)
})

test('unsubscribed listener is not called', () => {
  const store = createTokenStore('shopperstop:customer-token')
  const listener = vi.fn()
  const unsubscribe = store.subscribe(listener)
  unsubscribe()

  store.set('a')
  expect(listener).not.toHaveBeenCalled()
})

test('blocked storage keeps the token in memory', () => {
  const blocked = () => {
    throw new Error('storage blocked')
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)

  const store = createTokenStore('shopperstop:customer-token')
  expect(store.get()).toBeUndefined()
  expect(() => store.set('a')).not.toThrow()
  expect(store.get()).toBe('a')
})
