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

// Every 10 seconds while under way; off for a finished, an unknown or an unanswered order.
export function pollInterval(order: Order | null | undefined): number | false {
  return order && underWay(order.status) ? 10_000 : false
}

// Core answers 404 for an order that is not the customer's, or not one: null, the "Order not found" state, not an error.
// The poll is off in the background (TanStack's default): one read when the tab comes back.
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

// The promise is placedAt plus the store's promised minutes; `now` is passed in, so the sentence is a function of its inputs.
export function arrival(placedAt: string, promisedMinutes: number, now: number): string {
  const left = Date.parse(placedAt) + promisedMinutes * 60_000 - now
  if (left <= 0) return 'Running late. We are getting your order to you.'
  const minutes = Math.ceil(left / 60_000)
  return minutes === 1 ? 'Arriving in 1 minute' : `Arriving in ${minutes} minutes`
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

// One cancel. A cancel is done only when its answer holds the order (an ok answer with no body is internal).
export async function postCancel(id: string): Promise<OrderResult> {
  const answered: { order?: Order } = {}
  const error = await call(async () => {
    // The body is {}: no reason. An empty body is refused by core.
    const result = await api.POST('/orders/{id}/cancel', { params: { path: { id } }, body: {} })
    answered.order = result.data
    return result
  })
  if (error) return { error }
  if (!answered.order) return { error: { code: 'internal', message: 'Core answered without an order.' } }
  return { order: answered.order }
}

// The answered order is cached at once; a refusal reads the order again, so a 409 shows what core now holds.
export async function cancelOrder(id: string, send = postCancel): Promise<OrderResult> {
  const token = getToken() ?? ''
  const result = await send(id)
  if (result.order) {
    queryClient.setQueryData(orderKey(token, id), result.order)
    void queryClient.invalidateQueries({ queryKey: ordersKey(token) })
  } else if (result.error?.code === 'conflict') {
    await queryClient.invalidateQueries({ queryKey: orderKey(token, id) })
  }
  return result
}
