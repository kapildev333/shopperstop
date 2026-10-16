import { expect, test } from 'vitest'
import { itemCount, since } from './format'

const now = Date.parse('2026-10-15T10:00:00Z')
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString()

test('since and itemCount wording', () => {
  expect(since(ago(0), now)).toBe('just now')
  expect(since(ago(12), now)).toBe('12 min ago')
  expect(since(ago(65), now)).toBe('1 h 5 min ago')
  expect(itemCount(1)).toBe('1 item')
  expect(itemCount(3)).toBe('3 items')
})
