import { expect, test } from 'vitest'
import { cn } from './cn'

test('falsy parts are dropped', () => {
  expect(cn('a', false, undefined, null, '', 'b')).toBe('a b')
})
