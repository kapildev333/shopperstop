import { queryOptions, useQuery } from '@tanstack/react-query'
import type { BadgeVariant } from '@shopperstop/ui'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'
import { useToken } from './session'

export type Order = components['schemas']['Order']
export type OrderStatus = Order['status']
export type OrderList = components['schemas']['OrderList']

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

// The browser's zone, en-IN wording; tests assert the <time> dateTime, never this text.
export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

// Core answers 404 for an order that is not the customer's, or not one: null, the "Order not found" state, not an error.
export function orderOptions(token: string, id: string) {
  return queryOptions({
    queryKey: orderKey(token, id),
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
