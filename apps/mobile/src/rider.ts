import { queryOptions, useQuery } from '@tanstack/react-query'
import createClient from 'openapi-fetch'
import type { components } from '@shopperstop/ui/api'
import type { components as RiderComponents, paths as RiderPaths } from '@shopperstop/ui/api/rider'
import { authMiddleware } from './api'
import { useToken } from './session'

type OrderStatus = components['schemas']['Order']['status']
export type Delivery = RiderComponents['schemas']['CustomerDelivery']

// Read at build time by Expo; the default is the rider's dev port.
export const riderUrl = `${process.env.EXPO_PUBLIC_RIDER_URL ?? 'http://localhost:8081'}/api/rider/v1`

// fetch is looked up per call so tests can replace it.
export const riderApi = createClient<RiderPaths>({
  baseUrl: riderUrl,
  fetch: (request) => globalThis.fetch(request),
})
riderApi.use(authMiddleware)

export const deliveryKey = (token: string, orderId: string) => ['delivery', token, orderId] as const

// A rider's claim is what moves an order out for delivery: before that there is no delivery to read.
export function riderStage(status: OrderStatus): boolean {
  return status === 'out_for_delivery' || status === 'delivered'
}

// Every 10 s while out for delivery, once when delivered. 404 (no rider claimed it, or not this customer's) is null; any other failure throws and keeps what is held.
export function deliveryOptions(token: string, orderId: string, status: OrderStatus) {
  return queryOptions({
    queryKey: deliveryKey(token, orderId),
    enabled: !!token && riderStage(status),
    refetchInterval: status === 'out_for_delivery' ? 10_000 : false,
    queryFn: async (): Promise<Delivery | null> => {
      const { data, error, response } = await riderApi.GET('/orders/{orderId}/delivery', {
        params: { path: { orderId } },
      })
      if (response.status === 404) return null
      if (error || !data) throw error ?? new Error('no answer')
      return data
    },
  })
}

export function useDelivery(orderId: string, status: OrderStatus) {
  const token = useToken()
  return useQuery(deliveryOptions(token ?? '', orderId, status))
}

// Whole minutes since the position was recorded, rounded down; a clock ahead of ours is "just now".
export function lastSeen(recordedAt: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(recordedAt)) / 60_000)
  if (minutes < 1) return 'Last seen just now'
  if (minutes < 60) return minutes === 1 ? 'Last seen 1 minute ago' : `Last seen ${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  return hours === 1 ? 'Last seen 1 hour ago' : `Last seen ${hours} hours ago`
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
