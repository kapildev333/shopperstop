import { createElement, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'
import { queryClient } from './api'
import { apiError, fakeCore } from './fake-core'
import {
  canCancel,
  clockTime,
  headline,
  itemCountLabel,
  orderOptions,
  placedLabel,
  pollInterval,
  postCancel,
  productCountLabel,
  statusMessage,
  statusName,
  statusVariant,
  timeline,
  useOrders,
  type Order,
  type OrderStatus,
} from './orders'
import { setToken } from './session'

const local = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute).toISOString()

function order(over: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    number: 'SS-DEMOAAAD',
    storeId: 'store-1',
    storeName: 'Koramangala',
    promisedMinutes: 10,
    status: 'placed',
    customerName: 'Asha',
    address: { label: 'Home', line1: '12 MG Road', pincode: '560034' },
    subtotalCents: 4000,
    deliveryFeeCents: 0,
    totalCents: 4000,
    paymentMethod: 'cod',
    placedAt: local(16, 10, 2),
    items: [
      { productId: 'p1', name: 'Toned milk', unitLabel: '1 L', priceCents: 2000, mrpCents: 2200, quantity: 1 },
      { productId: 'p2', name: 'Brown bread', unitLabel: '400 g', priceCents: 1000, mrpCents: 1000, quantity: 2 },
    ],
    events: [{ toStatus: 'placed', actorType: 'customer', createdAt: local(16, 10, 2) }],
    ...over,
  }
}

describe('Placed time wording', () => {
  it('Placed time wording', () => {
    const now = new Date(2026, 9, 16, 15, 0).getTime()
    expect(placedLabel(local(16, 10, 2), now)).toBe('Today, 10:02')
    expect(placedLabel(local(12, 19, 40), now)).toBe('12 Oct, 19:40')
    expect(placedLabel(new Date(2025, 9, 4, 21, 5).toISOString(), now)).toBe('4 Oct 2025, 21:05')
  })
})

describe('Status names and badges', () => {
  it('Status names and badges', () => {
    const names: [OrderStatus, string, ReturnType<typeof statusVariant>][] = [
      ['placed', 'Placed', 'accent'],
      ['accepted', 'Accepted', 'accent'],
      ['packing', 'Packing', 'accent'],
      ['ready', 'Ready', 'accent'],
      ['out_for_delivery', 'Out for delivery', 'accent'],
      ['delivered', 'Delivered', 'success'],
      ['cancelled', 'Cancelled', 'neutral'],
    ]
    for (const [status, name, variant] of names) {
      expect(statusName(status)).toBe(name)
      expect(statusVariant(status)).toBe(variant)
    }
  })

  it('cancel is offered only while placed or accepted', () => {
    expect(canCancel('placed')).toBe(true)
    expect(canCancel('accepted')).toBe(true)
    expect(canCancel('packing')).toBe(false)
  })

  it('status message carries the cancel reason', () => {
    expect(statusMessage(order({ status: 'cancelled', cancelReason: 'Ordered by mistake' }))).toBe(
      'This order was cancelled. Reason: Ordered by mistake',
    )
  })
})

describe('Headline wording', () => {
  it('Headline wording', () => {
    const now = new Date(2026, 9, 16, 10, 10).getTime()
    const placedAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString()
    expect(headline(order({ placedAt: placedAgo(3) }), now)).toBe('Arriving in 7 min')
    expect(headline(order({ placedAt: placedAgo(9.5) }), now)).toBe('Arriving in 1 min')
    expect(headline(order({ placedAt: placedAgo(10) }), now)).toBe('Running late')
    expect(headline(order({ placedAt: placedAgo(180) }), now)).toBe('Running late')
    expect(headline(order({ status: 'delivered' }), now)).toBe('Delivered')
    expect(headline(order({ status: 'cancelled' }), now)).toBe('Cancelled')
  })
})

describe('Poll interval follows the status', () => {
  it('Poll interval follows the status', () => {
    const under: OrderStatus[] = ['placed', 'accepted', 'packing', 'ready', 'out_for_delivery']
    for (const status of under) expect(pollInterval(order({ status }))).toBe(10_000)
    expect(pollInterval(order({ status: 'delivered' }))).toBe(false)
    expect(pollInterval(order({ status: 'cancelled' }))).toBe(false)
    expect(pollInterval(null)).toBe(false)
    expect(pollInterval(undefined)).toBe(false)
  })
})

describe('timeline and labels', () => {
  it('timeline steps of a packing order', () => {
    const packing = order({
      status: 'packing',
      events: [
        { toStatus: 'placed', actorType: 'customer', createdAt: local(16, 10, 2) },
        { toStatus: 'accepted', actorType: 'staff', createdAt: local(16, 10, 3) },
        { toStatus: 'packing', actorType: 'staff', createdAt: local(16, 10, 4) },
      ],
    })
    const steps = timeline(packing)
    expect(steps.map((step) => step.label)).toEqual([
      'Order placed',
      'Accepted by store',
      'Packing your order',
      'Ready for pickup',
      'Out for delivery',
      'Delivered',
    ])
    expect(steps.map((step) => step.time)).toEqual(['10:02', '10:03', '10:04', undefined, undefined, undefined])
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'current', 'future', 'future', 'future'])
  })

  it('timeline steps of a cancelled order', () => {
    const cancelled = order({
      status: 'cancelled',
      events: [
        { toStatus: 'placed', actorType: 'customer', createdAt: local(16, 10, 2) },
        { toStatus: 'cancelled', actorType: 'customer', createdAt: local(16, 10, 5) },
      ],
    })
    expect(timeline(cancelled)).toEqual([
      { label: 'Order placed', time: '10:02', state: 'done' },
      { label: 'Cancelled', time: '10:05', state: 'current' },
    ])
  })

  it('timeline names the rider on the rider steps', () => {
    const delivered = order({
      status: 'delivered',
      events: [
        { toStatus: 'placed', actorType: 'customer', createdAt: local(16, 10, 2) },
        { toStatus: 'accepted', actorType: 'staff', createdAt: local(16, 10, 3) },
        { toStatus: 'packing', actorType: 'staff', createdAt: local(16, 10, 4) },
        { toStatus: 'ready', actorType: 'staff', createdAt: local(16, 10, 6) },
        { toStatus: 'out_for_delivery', actorType: 'rider', actorName: 'Asha', createdAt: local(16, 10, 8) },
        { toStatus: 'delivered', actorType: 'rider', actorName: 'Asha', createdAt: local(16, 10, 20) },
      ],
    })
    const steps = timeline(delivered)
    expect(steps.map((step) => step.actor)).toEqual([undefined, undefined, undefined, undefined, 'Picked up by Asha', 'Delivered by Asha'])
    expect(steps.every((step) => step.state === 'done')).toBe(true)
  })

  it('itemCountLabel sums the quantities', () => {
    expect(itemCountLabel(order({ items: [order().items[0]!] }))).toBe('1 item')
    expect(itemCountLabel(order())).toBe('3 items')
  })

  it('productCountLabel counts the lines', () => {
    expect(productCountLabel(order({ items: [order().items[0]!] }))).toBe('1 product')
    expect(productCountLabel(order())).toBe('2 products')
  })

  it('clockTime is local 24-hour with padding', () => {
    expect(clockTime(local(16, 9, 5))).toBe('09:05')
    expect(clockTime(local(16, 21, 40))).toBe('21:40')
  })
})

// A failed read rejects with core's inner error (code and message), as useMe does, not the whole envelope.
describe('failed order reads', () => {
  const token = 't-orders'
  const id = 'order-1'

  it('a 500 on the order read rejects with the inner error', async () => {
    setToken(token)
    fakeCore({ [`GET /orders/${id}`]: () => apiError(500, 'internal', 'Something went wrong') })
    await expect(queryClient.fetchQuery(orderOptions(token, id))).rejects.toMatchObject({ code: 'internal', message: 'Something went wrong' })
  })

  it('a 500 on the order list rejects with the inner error', async () => {
    setToken(token)
    fakeCore({ 'GET /orders': () => apiError(500, 'internal', 'Something went wrong') })
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children)
    const { result } = renderHook(() => useOrders(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ code: 'internal', message: 'Something went wrong' })
  })

  it('a refused cancel answers the inner error', async () => {
    setToken(token)
    fakeCore({ [`POST /orders/${id}/cancel`]: () => apiError(409, 'conflict', 'This order can no longer be cancelled.') })
    expect(await postCancel(id)).toEqual({ error: { code: 'conflict', message: 'This order can no longer be cancelled.' } })
  })
})
