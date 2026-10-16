import { createApiClient } from '@shopperstop/ui/app'
import type { components, paths } from '@shopperstop/ui/api/rider'
import type { paths as corePaths } from '@shopperstop/ui/api'
import { session } from './session'

export type Rider = components['schemas']['Rider']
export type ReadyOrder = components['schemas']['ReadyOrder']
export type Delivery = components['schemas']['Delivery']
export type ApiError = components['schemas']['Error']['error']

let unauthorized = () => {}

// The router registers what a lost session does (clear the cache, re-run the guard).
export function onUnauthorized(handler: () => void) {
  unauthorized = handler
}

// Absolute same-origin URLs: jsdom's Request rejects a relative one.
// The rider service carries the token and ends the session on a 401 to it; core never gets it (the store read is public).
export const rider = createApiClient<paths>({
  baseUrl: `${location.origin}/api/rider/v1`,
  session,
  onUnauthorized: () => unauthorized(),
})

export const core = createApiClient<corePaths>({ baseUrl: `${location.origin}/api/core/v1` })

export const meQuery = {
  queryKey: ['rider', 'me'],
  queryFn: async (): Promise<Rider> => {
    const { data, error } = await rider.GET('/me')
    if (error) throw error.error
    return data
  },
  staleTime: Infinity,
}

export const storeQuery = (id: string) => ({
  queryKey: ['core', 'store', id],
  queryFn: async () => {
    const { data, error } = await core.GET('/stores/{id}', { params: { path: { id } } })
    if (error) throw error.error
    return data
  },
  staleTime: Infinity,
})

export const deliveryQuery = (id: string) => ({
  queryKey: ['rider', 'delivery', id],
  queryFn: async (): Promise<Delivery> => {
    const { data, error } = await rider.GET('/me/deliveries/{id}', { params: { path: { id } } })
    if (error) throw error.error
    return data
  },
})
