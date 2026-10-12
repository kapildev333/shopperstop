import { useQuery } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Store = components['schemas']['Store']

export const keys = {
  serviceability: (pincode: string) => ['serviceability', pincode] as const,
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
      if (response.status === 404) return null
      if (error) throw error
      return data.store
    },
  })
}
