import { expect, test } from 'vitest'
import { parseQuantity, toRows, type Edits } from './stock'

test.each([
  ['0', 0],
  ['100000', 100000],
  [' 7 ', 7],
  ['007', 7],
  ['100001', undefined],
  ['-1', undefined],
  ['1.5', undefined],
  ['1e3', undefined],
  ['', undefined],
])('quantity %j is read as %j', (typed, quantity) => {
  expect(parseQuantity(typed)).toBe(quantity)
})

test('a value that is not a quantity is never sent as a number', () => {
  const edits: Edits = { a: { name: 'A', value: '12' }, b: { name: 'B', value: 'twelve' } }

  expect(toRows(edits)).toEqual([{ productId: 'a', quantity: 12 }])
})
