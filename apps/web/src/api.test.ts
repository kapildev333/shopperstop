import { afterEach, expect, test } from 'vitest'
import { authMiddleware } from './api'
import { setToken } from './session'

const key = 'shopperstop:customer-token'
const url = 'http://localhost/api/core/v1/me'

afterEach(() => setToken(undefined))

test('bearer attached', async () => {
  setToken('t-3')
  const request = new Request(url)
  const out = await authMiddleware.onRequest!({ request } as never)
  expect((out as Request).headers.get('Authorization')).toBe('Bearer t-3')
})

test('expired session dropped', async () => {
  setToken('t-4')
  await authMiddleware.onResponse!({ response: new Response(null, { status: 401 }) } as never)
  expect(localStorage.getItem(key)).toBeNull()
  const request = new Request(url)
  const out = await authMiddleware.onRequest!({ request } as never)
  expect((out as Request).headers.get('Authorization')).toBeNull()
})
