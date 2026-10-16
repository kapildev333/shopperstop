import { QueryClient, useQuery } from '@tanstack/react-query'
import { createApiClient } from '@shopperstop/ui/app'
import type { components, paths } from '@shopperstop/ui/api'
import type { paths as RiderPaths } from '@shopperstop/ui/api/rider'
import { getToken, setToken, useToken } from './session'

export type ApiError = components['schemas']['Error']['error']

export const unreachable: ApiError = { code: 'internal', message: 'Could not reach ShopperStop. Try again.' }

const session = { get: getToken, set: setToken }

// Absolute same-origin URL: jsdom's Request rejects a relative one. The shared client looks fetch up per call so tests can stub it.
export const api = createApiClient<paths>({
  baseUrl: `${location.origin}/api/core/v1`,
  session,
  failureMessage: unreachable.message,
})

// The rider service, same origin (/api/rider is proxied like /api/core), with the customer's core token.
export const riderApi = createApiClient<RiderPaths>({
  baseUrl: `${location.origin}/api/rider/v1`,
  session,
  failureMessage: unreachable.message,
})

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
