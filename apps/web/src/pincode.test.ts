import { afterEach, expect, test, vi } from 'vitest'

const key = 'shopperstop:pincode'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.resetModules()
})

test('pincode persisted', async () => {
  const { setPincode, getPincode } = await import('./pincode')
  setPincode('560034')
  expect(localStorage.getItem(key)).toBe('560034')
  expect(getPincode()).toBe('560034')
})

test('pincode restored on load', async () => {
  localStorage.setItem(key, '560038')
  const first = await import('./pincode')
  expect(first.getPincode()).toBe('560038')

  localStorage.setItem(key, 'abc')
  vi.resetModules()
  const second = await import('./pincode')
  expect(second.getPincode()).toBeUndefined()
})

test('blocked storage tolerated', async () => {
  const blocked = () => {
    throw new DOMException('storage blocked', 'SecurityError')
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)

  const { setPincode, getPincode } = await import('./pincode')
  expect(getPincode()).toBeUndefined()
  expect(() => setPincode('560034')).not.toThrow()
  expect(getPincode()).toBe('560034')
})
