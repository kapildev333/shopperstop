import { expect, test } from 'vitest'
import { safeReturnTo } from './auth'

test('unsafe returnTo ignored', () => {
  expect(safeReturnTo('https://evil.example/')).toBe('/')
  expect(safeReturnTo('//evil.example/')).toBe('/')
  expect(safeReturnTo('/\\evil.example')).toBe('/')
  expect(safeReturnTo(undefined)).toBe('/')
  expect(safeReturnTo('/account?tab=1')).toBe('/account?tab=1')
})
