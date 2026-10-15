import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Order = components['schemas']['Order']
export type OrderStatus = Order['status']
// What the URL of /orders holds. Absent means: the first store (admins).
export type OrdersSearch = { store?: string }

// The board asks core again this often (Spec 2 §8). TanStack Query stops the interval while the tab is hidden and asks at once when it shows again.
export const pollMs = 10_000
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

async function listOrders(storeId: string, query: { status: OrderStatus; page?: number; pageSize: number }) {
  const { data, error } = await api.GET('/admin/stores/{id}/orders', { params: { path: { id: storeId }, query } })
  if (error) throw error.error
  return data
}

// Keys: everything listed for a store is under ['admin', 'orders', storeId]; the board is ['admin', 'orders', storeId, 'board'].
// Core lists one status per request, so the board is five requests, answered together or not at all.
// ponytail: a column holds the newest 100 orders of its status (core's largest page); ask core for an "active" filter with a total if a store ever has more waiting.
export const boardQuery = (storeId: string) =>
  queryOptions({
    queryKey: ['admin', 'orders', storeId, 'board'],
    queryFn: async () => (await Promise.all(activeStatuses.map((status) => listOrders(storeId, { status, pageSize: 100 })))).flatMap((list) => list.items),
    refetchInterval: pollMs,
  })

// One order is ['admin', 'order', id]: not under a store's lists, so dropping those never empties an open sheet.
// The sheet follows the order like the board does.
export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'order', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/admin/orders/{id}', { params: { path: { id } } })
      if (error) throw error.error
      return data
    },
    refetchInterval: pollMs,
  })

// D28, as on the customer site: an order under way is `accent`, delivered `success`, cancelled `neutral`; the badge
// always carries the status as text, and a status is never `danger` or `warning`.
export const statusBadge = (status: OrderStatus) => (status === 'delivered' ? 'success' : status === 'cancelled' ? 'neutral' : 'accent')

// A status change. Core answers 409 when the order is no longer where this page showed it (someone else moved it, or the
// customer cancelled): the order is then read again, so the page can show where it stands and say so.
export function useSetStatus(storeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sent: { order: Order; status: OrderStatus; note?: string }) => {
      const params = { path: { id: sent.order.id } }
      const { data, error } = await api.POST('/admin/orders/{id}/status', { params, body: { status: sent.status, note: sent.note } })
      if (!error) return { order: data, changedElsewhere: false }
      if (error.error.code !== 'conflict') throw error.error
      const read = await api.GET('/admin/orders/{id}', { params })
      if (read.error) throw read.error.error
      return { order: read.data, changedElsewhere: true }
    },
    onSuccess: async ({ order }) => {
      const board = boardQuery(storeId).queryKey
      // A poll still in the air was read before this answer: drop it, or it would put the card back where it was.
      await queryClient.cancelQueries({ queryKey: board })
      queryClient.setQueryData(board, (orders) => orders && [...orders.filter((other) => other.id !== order.id), ...(isActive(order.status) ? [order] : [])])
      const detail = orderQuery(order.id).queryKey
      await queryClient.cancelQueries({ queryKey: detail })
      queryClient.setQueryData(detail, order)
    },
  })
}

// "12 min ago" for a card; whole minutes, hours above 59.
export function since(placedAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(placedAt)) / 60_000))
  if (minutes === 0) return 'just now'
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`
}

// The text of `since`, kept current: only the component that calls this renders again, and only when the text changes.
function everyFewSeconds(tick: () => void) {
  const id = setInterval(tick, 5_000)
  return () => clearInterval(id)
}
export const useSince = (placedAt: string) => useSyncExternalStore(everyFewSeconds, () => since(placedAt, Date.now()))

// "13 Oct 2026, 2:50 pm", in the stores' time zone whatever the browser's is.
const stamp = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
export const when = (at: string) => stamp.format(new Date(at))

export function itemCount(order: Order) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return count === 1 ? '1 item' : `${count} items`
}
