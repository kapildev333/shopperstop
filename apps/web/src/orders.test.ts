import { expect, test } from 'vitest'
import type { BadgeVariant } from '@shopperstop/ui'
import { order } from './test-data'
import { deliveryOptions, lastSeen, orderOptions, pollInterval, statusName, statusVariant, type Order, type OrderStatus } from './orders'

const id = '00000000-0000-4000-8000-000000000703'

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

// Every 10 seconds while under way; never for a finished order, an unknown one or one not yet answered. Background polling stays off.
test('poll interval follows the status', () => {
  for (const status of ['placed', 'accepted', 'packing', 'ready', 'out_for_delivery'] as const) {
    expect(pollInterval(order({ status })), status).toBe(10_000)
  }
  expect(pollInterval(order({ status: 'delivered' }))).toBe(false)
  expect(pollInterval(order({ status: 'cancelled' }))).toBe(false)
  expect(pollInterval(null)).toBe(false)
  expect(pollInterval(undefined)).toBe(false)

  const options = orderOptions('t', id)
  const poll = options.refetchInterval as unknown as (query: { state: { data: Order | null | undefined } }) => unknown
  expect(poll({ state: { data: order({ status: 'placed' }) } })).toBe(10_000)
  expect(poll({ state: { data: order({ status: 'delivered' }) } })).toBe(false)
  expect(poll({ state: { data: undefined } })).toBe(false)
  expect(options.refetchIntervalInBackground).not.toBe(true)
})

// Whole minutes rounded down, then whole hours; a clock ahead of ours is "just now".
test('last seen wording', () => {
  const now = Date.parse('2026-10-13T12:00:00.000Z')
  const at = (seconds: number) => new Date(now - seconds * 1000).toISOString()
  expect(lastSeen(at(30), now)).toBe('Last seen just now')
  expect(lastSeen(at(60), now)).toBe('Last seen 1 minute ago')
  expect(lastSeen(at(59 * 60), now)).toBe('Last seen 59 minutes ago')
  expect(lastSeen(at(60 * 60), now)).toBe('Last seen 1 hour ago')
  expect(lastSeen(at(150 * 60), now)).toBe('Last seen 2 hours ago')
  expect(lastSeen(at(-120), now)).toBe('Last seen just now')
})

// Only from out for delivery on: polled every 10 s while out, read once when delivered, never before.
test('rider read follows the status', () => {
  for (const status of ['placed', 'accepted', 'packing', 'ready', 'cancelled'] as const) {
    expect(deliveryOptions('t', order({ status })).enabled, status).toBe(false)
  }
  const out = deliveryOptions('t', order({ status: 'out_for_delivery' }))
  expect(out.enabled).toBe(true)
  expect(out.refetchInterval).toBe(10_000)
  expect(out.refetchIntervalInBackground).not.toBe(true)
  const delivered = deliveryOptions('t', order({ status: 'delivered' }))
  expect(delivered.enabled).toBe(true)
  expect(delivered.refetchInterval).toBe(false)
  expect(deliveryOptions('', order({ status: 'out_for_delivery' })).enabled).toBe(false)
})
