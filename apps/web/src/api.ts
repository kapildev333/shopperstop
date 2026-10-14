import { QueryClient, useQuery } from '@tanstack/react-query'
import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from '@shopperstop/ui/api'
import { getToken, setToken, useToken } from './session'

export type ApiError = components['schemas']['Error']['error']

const unreachable: ApiError = { code: 'internal', message: 'Could not reach ShopperStop. Try again.' }

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
  async onResponse({ response }) {
    if (response.status === 401) setToken(undefined)
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

export const api = createClient<paths>({ baseUrl: '/api/core/v1' })
api.use(authMiddleware)

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

// Runs one request; resolves to the envelope's error, or undefined on success.
export async function call(request: () => Promise<{ error?: { error: ApiError } }>): Promise<ApiError | undefined> {
  try {
    const { error } = await request()
    return error?.error
  } catch {
    return unreachable
  }
}

export function splitError(error: ApiError | undefined, fields: readonly string[]) {
  if (!error) return { fields: {} as Record<string, string> }
  if (error.field && fields.includes(error.field)) return { fields: { [error.field]: error.message } }
  return { fields: {} as Record<string, string>, banner: error.message }
}

export function useMe() {
  const token = useToken()
  return useQuery({
    queryKey: ['me', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await api.GET('/me')
      if (error) throw error
      return data
    },
  })
}
