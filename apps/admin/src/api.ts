import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from '@shopperstop/ui/api'
import type { components as riderComponents, paths as riderPaths } from '@shopperstop/ui/api/rider'
import { clearToken, getToken } from './session'

export type Staff = components['schemas']['Staff']
export type ApiError = components['schemas']['Error']['error']
export type Rider = riderComponents['schemas']['Rider']

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

// One rule for both services: the staff token on every request, a 401 to it ends the session, a failure without the
// error envelope (both services write the same one) is handed on as one with code `internal`.
const staffSession: Middleware = {
  onRequest({ request }) {
    const token = getToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  async onResponse({ request, response }) {
    // Only a 401 to the current token ends the session: not one to a signed-out request or to a token since replaced.
    const token = getToken()
    if (response.status === 401 && token && request.headers.get('Authorization') === `Bearer ${token}`) {
      clearToken()
      unauthorized()
    }
    if (response.ok) return response
    // A failure core did not write (a proxy's empty or plain-text 502 while core is down) carries no error envelope, and
    // openapi-fetch then hands callers a falsy `error`: every `if (error) throw error.error` would read it as success.
    // Such an answer is given the envelope here, with its status kept, so no caller needs to know.
    const body = (await response.clone().json().catch(() => undefined)) as { error?: { code?: unknown } } | undefined
    if (typeof body?.error?.code === 'string') return response
    return Response.json({ error: { code: 'internal', message: 'The server did not answer as expected.' } }, { status: response.status })
  },
}
api.use(staffSession)

// The rider service (`services/rider`), same origin; it checks the staff token with core itself.
export const riderApi = createClient<riderPaths>({
  baseUrl: `${location.origin}/api/rider/v1`,
  fetch: (request) => globalThis.fetch(request),
})
riderApi.use(staffSession)

export const meQuery = {
  queryKey: ['admin', 'me'],
  queryFn: async (): Promise<Staff> => {
    const { data, error } = await api.GET('/admin/me')
    if (error) throw error.error
    return data
  },
  staleTime: Infinity,
}
