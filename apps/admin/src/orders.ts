import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { BadgeVariant } from '@shopperstop/ui'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Order = components['schemas']['Order']
export type OrderStatus = Order['status']
export type Finished = 'delivered' | 'cancelled'
// What the URL of /orders holds. Absent means: the first store (admins), the board, delivered orders, page 1.
export type OrdersSearch = { store?: string; tab?: 'history'; status?: 'cancelled'; page?: number }

// The board asks core again this often (Spec 2 §8). TanStack Query stops the interval while the tab is hidden and asks at once when it shows again.
export const pollMs = 10_000
export const pageSize = 24
// A page core does not refuse as too large (its limit at 24 a page is 89478486).
export const maxPage = 100000
// The statuses with a column, in the order an order moves through them (services/core/internal/order/status.go).
export const activeStatuses = ['placed', 'accepted', 'packing', 'ready', 'out_for_delivery'] as const satisfies readonly OrderStatus[]
export const statusLabel: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  packing: 'Packing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
// The one move staff make from each active status, and what the card's button says.
export const nextStatus = { placed: 'accepted', accepted: 'packing', packing: 'ready', ready: 'out_for_delivery', out_for_delivery: 'delivered' } as const satisfies Partial<Record<OrderStatus, OrderStatus>>
export const nextLabel: Record<keyof typeof nextStatus, string> = {
  placed: 'Accept',
  accepted: 'Start packing',
  packing: 'Mark ready',
  ready: 'Send out',
  out_for_delivery: 'Mark delivered',
}
export const isActive = (status: OrderStatus): status is keyof typeof nextStatus => status in nextStatus

async function listOrders(storeId: string, query: { status?: OrderStatus; active?: 'true'; page?: number; pageSize: number }) {
  const { data, error } = await api.GET('/admin/stores/{id}/orders', { params: { path: { id: storeId }, query } })
  if (error) throw error.error
  return data
}

// Keys: everything listed for a store is under ['admin', 'orders', storeId]; the board is ['admin', 'orders', storeId, 'board'].
// The board is one request for every active order, with core's total.
// ponytail: the newest 100 active orders (core's largest page), and the board says so when core holds more; page further if a store ever has that many waiting.
export const boardQuery = (storeId: string) =>
  queryOptions({
    queryKey: ['admin', 'orders', storeId, 'board'],
    queryFn: () => listOrders(storeId, { active: 'true', pageSize: 100 }),
    refetchInterval: pollMs,
  })

// One page of a store's finished orders, newest first: ['admin', 'orders', storeId, 'history', status, page].
export const historyQuery = (storeId: string, status: Finished, page: number) =>
  queryOptions({
    queryKey: ['admin', 'orders', storeId, 'history', status, page],
    queryFn: () => listOrders(storeId, { status, page, pageSize }),
    // The page on screen stays while the next one loads, so the pager keeps keyboard focus; never the other status's rows.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[4] === status ? keepPreviousData(previous) : undefined),
  })

// One order is ['admin', 'order', id]: not under a store's lists, so dropping those never empties an open sheet.
// The sheet follows the order like the board does, until the order is finished: nothing changes after that.
export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'order', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/admin/orders/{id}', { params: { path: { id } } })
      if (error) throw error.error
      return data
    },
    refetchInterval: (query) => (query.state.data && !isActive(query.state.data.status) ? false : pollMs),
  })

// D28, as on the customer site: an order under way is `accent`, delivered `success`, cancelled `neutral`; the badge
// always carries the status as text, and a status is never `danger` or `warning`.
export const statusBadge = (status: OrderStatus) => (status === 'delivered' ? 'success' : status === 'cancelled' ? 'neutral' : 'accent')

// D53: how an order is paid. Core sets `paymentStatus` on online orders only, so its absence is cash. The badge always
// carries the words; a pending payment is the one `warning`, and a cancelled order whose payment never came (core's
// payment timeout) is `unpaid`: nothing is awaited any more.
export type Payment = NonNullable<Order['paymentStatus']> | 'cod' | 'unpaid'
export const payment = (order: Order): Payment =>
  order.status === 'cancelled' && order.paymentStatus === 'pending' ? 'unpaid' : (order.paymentStatus ?? 'cod')
// Core refuses to accept an online order until it is paid (409 payment_pending).
export const awaitsPayment = (order: Order) => order.status === 'placed' && order.paymentStatus === 'pending'
export const paymentBadge: Record<Payment, { variant: BadgeVariant; label: string }> = {
  cod: { variant: 'neutral', label: 'Cash on delivery' },
  pending: { variant: 'warning', label: 'Awaiting payment' },
  paid: { variant: 'success', label: 'Paid' },
  refunded: { variant: 'neutral', label: 'Refunded' },
  unpaid: { variant: 'neutral', label: 'Not paid' },
}

// A status change. Core answers 409 when the order is no longer where this page showed it (someone else moved it, or the
// customer cancelled), or 409 payment_pending when its payment is still pending: the order is then read again, so the
// page can show where it stands and say so.
export function useSetStatus(storeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sent: { order: Order; status: OrderStatus; note?: string }) => {
      const params = { path: { id: sent.order.id } }
      const { data, error } = await api.POST('/admin/orders/{id}/status', { params, body: { status: sent.status, note: sent.note } })
      if (!error) return { order: data, changedElsewhere: false, awaitingPayment: false }
      const code = error.error.code
      if (code !== 'conflict' && code !== 'payment_pending') throw error.error
      const read = await api.GET('/admin/orders/{id}', { params })
      if (read.error) throw read.error.error
      return { order: read.data, changedElsewhere: code === 'conflict', awaitingPayment: code === 'payment_pending' }
    },
    onSuccess: async ({ order }) => {
      const board = boardQuery(storeId).queryKey
      // A poll still in the air was read before this answer: drop it, or it would put the card back where it was.
      await queryClient.cancelQueries({ queryKey: board })
      queryClient.setQueryData(board, (list) => {
        if (!list) return list
        const items = [...list.items.filter((other) => other.id !== order.id), ...(isActive(order.status) ? [order] : [])]
        // Core's total moves with the board: an order that left it, or joined it on a 409, counts.
        return { ...list, items, total: list.total + items.length - list.items.length }
      })
      const detail = orderQuery(order.id).queryKey
      await queryClient.cancelQueries({ queryKey: detail })
      queryClient.setQueryData(detail, order)
      // Lists kept from before (history pages) no longer hold what core holds: the next visit reads them again.
      queryClient.removeQueries({ queryKey: ['admin', 'orders', storeId], type: 'inactive' })
    },
  })
}

export function itemCount(order: Order) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return count === 1 ? '1 item' : `${count} items`
}
