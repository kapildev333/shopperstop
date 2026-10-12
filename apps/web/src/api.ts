import { QueryClient } from '@tanstack/react-query'
import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from '@shopperstop/ui/api'
import { getToken, setToken } from './session'

export type ApiError = components['schemas']['Error']['error']

export const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = getToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onResponse({ response }) {
    if (response.status === 401) setToken(undefined)
    return response
  },
}

export const api = createClient<paths>({ baseUrl: '/api/core/v1' })
api.use(authMiddleware)

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const unreachable: ApiError = { code: 'internal', message: 'Could not reach ShopperStop. Try again.' }

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
