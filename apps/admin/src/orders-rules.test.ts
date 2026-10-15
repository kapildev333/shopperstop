import { expect, test } from 'vitest'
import { itemCount, since } from './orders'
import { order } from './orders-fake'

const placed = '2026-10-13T09:20:00Z'
const after = (seconds: number) => Date.parse(placed) + seconds * 1000

test.each([
  [0, 'just now'],
  [59, 'just now'],
  [60, '1 min ago'],
  [599, '9 min ago'],
  [3599, '59 min ago'],
  [3600, '1 h 0 min ago'],
  [7500, '2 h 5 min ago'],
  [-30, 'just now'],
])('an order placed %i seconds ago reads %j', (seconds, text) => {
  expect(since(placed, after(seconds))).toBe(text)
})

test('the item count of a card is the quantities added up', () => {
  expect(itemCount(order(1, 'placed'))).toBe('4 items')
  expect(itemCount({ ...order(1, 'placed'), items: [order(1, 'placed').items[0]] })).toBe('1 item')
})
