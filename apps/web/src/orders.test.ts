import { expect, test } from 'vitest'
import type { BadgeVariant } from '@shopperstop/ui'
import { statusName, statusVariant, type OrderStatus } from './orders'

// Typed over core's status enum: a status added to the contract without a row here is a type error, not a silent gap.
const table: Record<OrderStatus, [string, BadgeVariant]> = {
  placed: ['Placed', 'accent'],
  accepted: ['Accepted', 'accent'],
  packing: ['Packing', 'accent'],
  ready: ['Ready', 'accent'],
  out_for_delivery: ['Out for delivery', 'accent'],
  delivered: ['Delivered', 'success'],
  cancelled: ['Cancelled', 'neutral'],
}

test('status names and badges', () => {
  const statuses = Object.keys(table) as OrderStatus[]
  expect(statuses).toHaveLength(7)
  for (const status of statuses) {
    const [name, variant] = table[status]
    expect(statusName(status), status).toBe(name)
    expect(statusVariant(status), status).toBe(variant)
  }
})
