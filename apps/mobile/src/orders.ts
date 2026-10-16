import { queryOptions, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { components } from '@shopperstop/ui/api'
import { api, call, queryClient, type ApiError } from './api'
import { getToken, useToken } from './session'
import type { BadgeVariant } from './ui/badge'

export type Order = components['schemas']['Order']
export type OrderStatus = Order['status']
export type OrderList = components['schemas']['OrderList']
export type OrderResult = { order?: Order; error?: ApiError }

export const ordersKey = (token: string) => ['orders', token] as const
export const orderKey = (token: string, id: string) => ['order', token, id] as const

// One table for the badge, the history and the message. Under way is accent, delivered success, cancelled neutral (PLAN.md D28).
const vocabulary: Record<OrderStatus, { name: string; variant: BadgeVariant; message: string }> = {
  placed: { name: 'Placed', variant: 'accent', message: 'Order placed. Waiting for the store to accept it.' },
  accepted: { name: 'Accepted', variant: 'accent', message: 'The store accepted your order.' },
  packing: { name: 'Packing', variant: 'accent', message: 'Your order is being packed.' },
  ready: { name: 'Ready', variant: 'accent', message: 'Your order is packed and ready to leave the store.' },
  out_for_delivery: { name: 'Out for delivery', variant: 'accent', message: 'Your order is out for delivery.' },
  delivered: { name: 'Delivered', variant: 'success', message: 'Your order was delivered.' },
  cancelled: { name: 'Cancelled', variant: 'neutral', message: 'This order was cancelled.' },
}

export function statusName(status: OrderStatus): string {
  return vocabulary[status].name
}

export function statusVariant(status: OrderStatus): BadgeVariant {
  return vocabulary[status].variant
}

export function statusMessage(order: Order): string {
  const { message } = vocabulary[order.status]
  return order.status === 'cancelled' && order.cancelReason ? `${message} Reason: ${order.cancelReason}` : message
}

export function underWay(status: OrderStatus): boolean {
  return status !== 'delivered' && status !== 'cancelled'
}

export function canCancel(status: OrderStatus): boolean {
  return status === 'placed' || status === 'accepted'
}

// Every 10 seconds while under way; off for a finished, an unknown or an unanswered order.
export function pollInterval(order: Order | null | undefined): number | false {
  return order && underWay(order.status) ? 10_000 : false
}

// Core answers 404 for an order that is not the customer's, or not one: null, the "Order not found" state, not an error.
export function orderOptions(token: string, id: string) {
  return queryOptions({
    queryKey: orderKey(token, id),
    refetchInterval: (query) => pollInterval(query.state.data),
    queryFn: async (): Promise<Order | null> => {
      const { data, error, response } = await api.GET('/orders/{id}', { params: { path: { id } } })
      if (response.status === 404) return null
      if (error || !data) throw error ?? new Error('no answer')
      return data
    },
  })
}

// No staleTime: every visit reads the order from core.
export function useOrder(id: string) {
  const token = useToken()
  return useQuery({ ...orderOptions(token ?? '', id), enabled: !!token })
}

// ponytail: first page only (the API default of 24); "Load more" when a customer has more.
export function useOrders() {
  const token = useToken()
  return useQuery({
    queryKey: ordersKey(token ?? ''),
    enabled: !!token,
    queryFn: async (): Promise<OrderList> => {
      const { data, error } = await api.GET('/orders')
      if (error || !data) throw error ?? new Error('no answer')
      return data
    },
  })
}

// The clock the screen reads for "in N min" and "Last seen": one tick a second, as web.
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

const pad = (n: number) => String(n).padStart(2, '0')

// Local 24-hour clock, from the device zone: tests build their times with local constructors.
export function clockTime(iso: string): string {
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// English month names from a table, not Intl: deterministic in Jest and on Hermes.
export function placedLabel(iso: string, now: number): string {
  const placed = new Date(iso)
  const today = new Date(now)
  const time = clockTime(iso)
  if (placed.toDateString() === today.toDateString()) return `Today, ${time}`
  const day = `${placed.getDate()} ${months[placed.getMonth()]}`
  return placed.getFullYear() === today.getFullYear() ? `${day}, ${time}` : `${day} ${placed.getFullYear()}, ${time}`
}

export function itemCountLabel(order: Order): string {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return count === 1 ? '1 item' : `${count} items`
}

export function productCountLabel(order: Order): string {
  const count = order.items.length
  return count === 1 ? '1 product' : `${count} products`
}

// Under way the headline counts down to the promise; past it, "Running late".
export function headline(order: Order, now: number): string {
  if (order.status === 'delivered') return 'Delivered'
  if (order.status === 'cancelled') return 'Cancelled'
  const left = Date.parse(order.placedAt) + order.promisedMinutes * 60_000 - now
  if (left <= 0) return 'Running late'
  return `Arriving in ${Math.ceil(left / 60_000)} min`
}

export type Step = { label: string; time?: string; actor?: string; state: 'done' | 'current' | 'future' }

const steps: OrderStatus[] = ['placed', 'accepted', 'packing', 'ready', 'out_for_delivery', 'delivered']
const stepNames: Record<OrderStatus, string> = {
  placed: 'Order placed',
  accepted: 'Accepted by store',
  packing: 'Packing your order',
  ready: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

type Event = Order['events'][number]

// Only a rider's own step names the rider: picked up on the way out, delivered at the door.
function actorLine(event: Event): string | undefined {
  if (event.actorType !== 'rider' || !event.actorName) return undefined
  if (event.toStatus === 'out_for_delivery') return `Picked up by ${event.actorName}`
  if (event.toStatus === 'delivered') return `Delivered by ${event.actorName}`
  return undefined
}

// The step's last event: its time and actor.
function lastEvent(order: Order, status: OrderStatus): Event | undefined {
  const hits = order.events.filter((event) => event.toStatus === status)
  return hits[hits.length - 1]
}

// A cancelled order's steps are its events, oldest first; the last one is where it stopped.
export function timeline(order: Order): Step[] {
  if (order.status === 'cancelled') {
    return order.events.map((event, i) => ({
      label: stepNames[event.toStatus],
      time: clockTime(event.createdAt),
      actor: actorLine(event),
      state: i === order.events.length - 1 ? 'current' : 'done',
    }))
  }
  const at = steps.indexOf(order.status)
  const delivered = order.status === 'delivered'
  return steps.map((status, i) => {
    const state = i < at || delivered ? 'done' : i === at ? 'current' : 'future'
    const event = state === 'future' ? undefined : lastEvent(order, status)
    return {
      label: stepNames[status],
      time: event ? clockTime(event.createdAt) : undefined,
      actor: event ? actorLine(event) : undefined,
      state,
    }
  })
}

// One cancel. A cancel is done only when its answer holds the order (an ok answer with no body is internal).
// The reason is optional: core refuses an empty body, so no reason sends {}.
export async function postCancel(id: string, reason?: string): Promise<OrderResult> {
  const answered: { order?: Order } = {}
  const error = await call(async () => {
    const result = await api.POST('/orders/{id}/cancel', {
      params: { path: { id } },
      body: reason ? { reason } : {},
    })
    answered.order = result.data
    return result
  })
  if (error) return { error }
  if (!answered.order) return { error: { code: 'internal', message: 'Core answered without an order.' } }
  return { order: answered.order }
}

// The answered order is cached at once; a refusal reads the order again, so a 409 shows what core now holds.
export async function cancelOrder(id: string, reason?: string): Promise<OrderResult> {
  const token = getToken() ?? ''
  const result = await postCancel(id, reason)
  if (result.order) {
    queryClient.setQueryData(orderKey(token, id), result.order)
    void queryClient.invalidateQueries({ queryKey: ordersKey(token) })
  } else if (result.error?.code === 'conflict') {
    await queryClient.invalidateQueries({ queryKey: orderKey(token, id) })
  }
  return result
}
