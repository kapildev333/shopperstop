import { queryOptions } from '@tanstack/react-query'
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

export function itemCount(order: Order) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return count === 1 ? '1 item' : `${count} items`
}
