import createClient from 'openapi-fetch'
import type { components, paths } from '@shopperstop/ui/api/rider'
import type { paths as corePaths } from '@shopperstop/ui/api'
import { clearToken, getToken } from './session'

export type Rider = components['schemas']['Rider']
export type ReadyOrder = components['schemas']['ReadyOrder']
export type Delivery = components['schemas']['Delivery']
export type ApiError = components['schemas']['Error']['error']

let unauthorized = () => {}

// The router registers what a lost session does (clear the cache, re-run the guard).
export function onUnauthorized(handler: () => void) {
  unauthorized = handler
}

// Absolute same-origin URLs: jsdom's Request rejects a relative one. fetch is looked up per call so tests can stub it.
// The rider service carries the token; core never does (the store read is public and a rider token means nothing to core).
export const rider = createClient<paths>({
  baseUrl: `${location.origin}/api/rider/v1`,
  fetch: (request) => globalThis.fetch(request),
})

export const core = createClient<corePaths>({
  baseUrl: `${location.origin}/api/core/v1`,
  fetch: (request) => globalThis.fetch(request),
})

// A failure another party wrote (a proxy's empty or plain-text 502 while the service is down) carries no error envelope, and
// openapi-fetch then hands callers a falsy `error`: every `if (error) throw error.error` would read it as success.
// Such an answer is given the envelope here, with its status kept, so no caller needs to know.
async function withEnvelope(response: Response) {
  if (response.ok) return response
  const body = (await response.clone().json().catch(() => undefined)) as { error?: { code?: unknown } } | undefined
  if (typeof body?.error?.code === 'string') return response
  return Response.json({ error: { code: 'internal', message: 'The server did not answer as expected.' } }, { status: response.status })
}

core.use({
  onResponse: ({ response }) => withEnvelope(response),
})

rider.use({
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
    return withEnvelope(response)
  },
})

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
