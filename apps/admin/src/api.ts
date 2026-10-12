import createClient from 'openapi-fetch'
import type { components, paths } from '@shopperstop/ui/api'
import { clearToken, getToken } from './session'

export type Staff = components['schemas']['Staff']
export type ApiError = components['schemas']['Error']['error']

let unauthorized = () => {}

// The router registers what a lost session does (clear the cache, re-run the guard).
export function onUnauthorized(handler: () => void) {
  unauthorized = handler
}

// Absolute same-origin URL: jsdom's Request rejects a relative one. fetch is looked up per call so tests can stub it.
export const api = createClient<paths>({
  baseUrl: `${location.origin}/api/core/v1`,
  fetch: (request) => globalThis.fetch(request),
})

api.use({
  onRequest({ request }) {
    const token = getToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onResponse({ request, response }) {
    // Only a 401 to the current token ends the session: not one to a signed-out request or to a token since replaced.
    const token = getToken()
    if (response.status === 401 && token && request.headers.get('Authorization') === `Bearer ${token}`) {
      clearToken()
      unauthorized()
    }
    return response
  },
})

export const meQuery = {
  queryKey: ['admin', 'me'],
  queryFn: async (): Promise<Staff> => {
    const { data, error } = await api.GET('/admin/me')
    if (error) throw error.error
    return data
  },
  staleTime: Infinity,
}
