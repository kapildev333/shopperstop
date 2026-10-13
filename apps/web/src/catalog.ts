import { useQuery } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Store = components['schemas']['Store']

export const keys = {
  serviceability: (pincode: string) => ['serviceability', pincode] as const,
}

// Only core's 404 not_serviceable means no store delivers; any other 404 is a lookup failure.
export function serviceabilityMissing(status: number, error: components['schemas']['Error'] | undefined) {
  return status === 404 && error?.error?.code === 'not_serviceable'
}

// Core answers 404 not_serviceable for a pincode no store delivers to: null, a notice, not an error.
// ponytail: a resolved store is trusted for a minute, so moving between pages does not ask core again.
export function useServiceability(pincode: string | undefined) {
  return useQuery({
    queryKey: keys.serviceability(pincode ?? ''),
    enabled: !!pincode,
    staleTime: 60_000,
    queryFn: async (): Promise<Store | null> => {
      const { data, error, response } = await api.GET('/serviceability', {
        params: { query: { pincode: pincode ?? '' } },
      })
      if (serviceabilityMissing(response.status, error)) return null
      if (error) throw error
      const store = data?.store
      if (!store) throw new Error(`serviceability answered ${response.status} without a store`)
      return store
    },
  })
}
