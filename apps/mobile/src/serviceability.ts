import { useQuery } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api, queryClient, unreachable } from './api'
import { usePincode } from './pincode'

export type Store = components['schemas']['Store']

export type StoreState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'open'; store: Store; pincode: string }
  | { kind: 'closed'; store: Store; pincode: string }
  | { kind: 'notServiceable'; pincode: string }
  | { kind: 'error'; error: unknown; retry: () => void }

// ponytail: a closed store reopens within a minute; raise it if the lookup is too chatty.
const staleTime = 60_000

// A pincode no store serves is an answer, not a failure: it resolves to no store.
async function lookup(pincode: string): Promise<{ store?: Store }> {
  const { data, error } = await api.GET('/serviceability', { params: { query: { pincode } } })
  if (error) {
    if (error.error.code === 'not_serviceable') return {}
    throw error.error
  }
  if (!data) throw unreachable
  return { store: data.store }
}

// The sheet resolves the pincode before the screen that opens next reads it, so that screen finds the answer cached.
export function resolvePincode(pincode: string): Promise<{ store?: Store }> {
  return queryClient.fetchQuery({
    queryKey: ['serviceability', pincode],
    queryFn: () => lookup(pincode),
    staleTime,
  })
}

export function useStore(): StoreState {
  const { pincode, loaded } = usePincode()
  const query = useQuery({
    queryKey: ['serviceability', pincode],
    queryFn: () => lookup(pincode ?? ''),
    enabled: loaded && !!pincode,
    staleTime,
  })
  if (!loaded) return { kind: 'loading' }
  if (!pincode) return { kind: 'none' }
  // Held data survives a failed refetch: only a lookup with no answer at all is an error.
  if (query.data) {
    const { store } = query.data
    if (!store) return { kind: 'notServiceable', pincode }
    return store.isOpen ? { kind: 'open', store, pincode } : { kind: 'closed', store, pincode }
  }
  if (query.isError) return { kind: 'error', error: query.error, retry: () => void query.refetch() }
  return { kind: 'loading' }
}
