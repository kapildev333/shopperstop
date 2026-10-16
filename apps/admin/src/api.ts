import { createApiClient } from '@shopperstop/ui/app'
import type { components, paths } from '@shopperstop/ui/api'
import type { components as riderComponents, paths as riderPaths } from '@shopperstop/ui/api/rider'
import { session } from './session'

export type Staff = components['schemas']['Staff']
export type ApiError = components['schemas']['Error']['error']
export type Rider = riderComponents['schemas']['Rider']

let unauthorized = () => {}

// The router registers what a lost session does (clear the cache, re-run the guard).
export function onUnauthorized(handler: () => void) {
  unauthorized = handler
}

// One rule for both services (they write the same error envelope): the staff token on every request, a 401 to the
// current token ends the session, a failure without the envelope reaches callers as `internal` with its status.
// Absolute same-origin URL: jsdom's Request rejects a relative one; the shared client looks fetch up per call so tests can stub it.
const options = { session, onUnauthorized: () => unauthorized() }
export const api = createApiClient<paths>({ baseUrl: `${location.origin}/api/core/v1`, ...options })

// The rider service (`services/rider`), same origin; it checks the staff token with core itself.
export const riderApi = createApiClient<riderPaths>({ baseUrl: `${location.origin}/api/rider/v1`, ...options })

export const meQuery = {
  queryKey: ['admin', 'me'],
  queryFn: async (): Promise<Staff> => {
    const { data, error } = await api.GET('/admin/me')
    if (error) throw error.error
    return data
  },
  staleTime: Infinity,
}
