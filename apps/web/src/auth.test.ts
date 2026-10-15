import { afterEach, expect, test, vi } from 'vitest'

// api.ts looks up globalThis.fetch per call, so the stub must be in place before auth.ts loads.
vi.hoisted(() => {
  globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch
})

import { safeReturnTo, signOutAndGoHome } from './auth'
import { getToken, setToken } from './session'

afterEach(() => setToken(undefined))

test('unsafe returnTo ignored', () => {
  expect(safeReturnTo('https://evil.example/')).toBe('/')
  expect(safeReturnTo('//evil.example/')).toBe('/')
  expect(safeReturnTo('/\\evil.example')).toBe('/')
  expect(safeReturnTo(undefined)).toBe('/')
  expect(safeReturnTo('/account?tab=1')).toBe('/account?tab=1')
})

test('sign out awaits navigation before clearing the session', async () => {
  setToken('t-5')
  const order: string[] = []
  await signOutAndGoHome(async () => {
    order.push('navigate')
  })
  order.push(`token:${getToken() ?? 'none'}`)
  expect(order).toEqual(['navigate', 'token:none'])
})

test('sign out clears the session even when navigation fails', async () => {
  setToken('t-6')
  await expect(signOutAndGoHome(() => Promise.reject(new Error('nav')))).rejects.toThrow('nav')
  expect(getToken()).toBeUndefined()
})
