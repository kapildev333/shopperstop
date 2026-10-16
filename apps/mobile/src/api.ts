import { QueryClient, useQuery } from '@tanstack/react-query'
import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from '@shopperstop/ui/api'
import { getToken, setToken, useToken } from './session'

export type ApiError = components['schemas']['Error']['error']

export const unreachable: ApiError = { code: 'internal', message: 'Could not reach ShopperStop. Try again.' }

// Read at build time by Expo; the default is the core's dev port.
export const coreUrl = `${process.env.EXPO_PUBLIC_CORE_URL ?? 'http://localhost:8080'}/api/core/v1`

function isEnvelope(body: unknown): boolean {
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error
  return typeof error?.code === 'string' && typeof error?.message === 'string'
}

export const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = getToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  async onResponse({ request, response }) {
    // Only a 401 to the current token ends the session: not one to a signed-out request or to a token since replaced.
    const token = getToken()
    if (response.status === 401 && token && request.headers.get('Authorization') === `Bearer ${token}`) setToken(undefined)
    if (response.ok) return response
    const body: unknown = await response.clone().json().catch(() => undefined)
    if (isEnvelope(body)) return response
    // Only Content-Type is set: copying Content-Length: 0 would make openapi-fetch drop the error again.
    return new Response(JSON.stringify({ error: unreachable }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

// fetch is looked up per call so tests can replace it.
export const api = createClient<paths>({
  baseUrl: coreUrl,
  fetch: (request) => globalThis.fetch(request),
})
api.use(authMiddleware)

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

// Runs one request; resolves to the envelope's error, or undefined on success. A request that never reaches core is `unreachable`.
export async function call(request: () => Promise<{ error?: { error: ApiError } }>): Promise<ApiError | undefined> {
  try {
    const { error } = await request()
    return error?.error
  } catch {
    return unreachable
  }
}

// The customer read, keyed by the token like the address list. Throws core's envelope so ErrorBanner can tell the cases apart.
export function useMe() {
  const token = useToken()
  return useQuery({
    queryKey: ['me', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await api.GET('/me')
      if (error) throw error.error
      if (!data) throw unreachable
      return data
    },
  })
}
