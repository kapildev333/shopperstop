import { expect, test } from 'vitest'
import { itemCount } from './format'

test('itemCount wording', () => {
  expect(itemCount(1)).toBe('1 item')
  expect(itemCount(3)).toBe('3 items')
})
