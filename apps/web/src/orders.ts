import { queryOptions, useQuery } from '@tanstack/react-query'
import type { BadgeVariant } from '@shopperstop/ui'
import type { components } from '@shopperstop/ui/api'
import { api, call, queryClient, type ApiError } from './api'
import { cartKey, queued } from './cart'
import { cartView, emptyCart, type CartView } from './guest-cart'
import { getToken, useToken } from './session'

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

// One request. A placement is done only when the answer holds the order.
export async function postOrder(addressId: string): Promise<OrderResult> {
  const answered: { order?: Order } = {}
  const error = await call(async () => {
    const result = await api.POST('/orders', { body: { addressId } })
    answered.order = result.data
    return result
  })
  if (error) return { error }
  if (!answered.order) return { error: { code: 'internal', message: 'Core answered without an order.' } }
  return { order: answered.order }
}

// The cart is empty: a second press after a placement the page did not see. Matched on the code and the absent field, never the message.
export const cartEmptied = (error: ApiError) => error.code === 'validation' && !error.field

// Runs inside the cart's write queue, so a Stepper tap before the press is placed too.
export function placeOrder(addressId: string, send = postOrder): Promise<OrderResult> {
  const token = getToken()
  if (!token) return Promise.resolve({ error: { code: 'unauthorized', message: 'sign in required' } })
  return queued(async () => {
    if (getToken() !== token) return { error: { code: 'unauthorized', message: 'sign in required' } }
    let result = await send(addressId)
    // An order-number collision is rare: one more try, then the page shows the failure.
    if (result.error?.code === 'conflict') result = await send(addressId)
    const { order, error } = result
    if (order || (error && cartEmptied(error))) {
      await queryClient.cancelQueries({ queryKey: cartKey(token) })
      // Core emptied the cart in the same transaction: the cache is set, not invalidated, so the bar drops its count at once.
      queryClient.setQueryData<CartView>(cartKey(token), cartView(emptyCart))
      if (order) queryClient.setQueryData(orderKey(token, order.id), order)
      void queryClient.invalidateQueries({ queryKey: ordersKey(token) })
    } else if (error?.field === 'addressId' && error.code === 'validation') {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] })
    } else if (error?.code !== 'not_serviceable') {
      // out_of_stock, subtotal, internal: the lines as they are now. internal may still have placed the order (design Decision 21).
      await queryClient.invalidateQueries({ queryKey: cartKey(token) })
    }
    return result
  })
}
