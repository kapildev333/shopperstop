import { useQuery } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Store = components['schemas']['Store']
export type StoreProduct = components['schemas']['StoreProduct']
export type CategoryNode = components['schemas']['CategoryNode']

export const keys = {
  serviceability: (pincode: string) => ['serviceability', pincode] as const,
  categories: (storeId: string) => ['categories', storeId] as const,
  picked: (storeId: string) => ['picked', storeId] as const,
}
// ponytail: a resolved store, category tree or first page is trusted for a minute, so moving between pages does not ask core again.
const staleTime = 60_000

// Only core's 404 not_serviceable means no store delivers; any other 404 is a lookup failure.
export function serviceabilityMissing(status: number, error: components['schemas']['Error'] | undefined) {
  return status === 404 && error?.error?.code === 'not_serviceable'
}

// Core answers 404 not_serviceable for a pincode no store delivers to: null, a notice, not an error.
export function useServiceability(pincode: string | undefined) {
  return useQuery({
    queryKey: keys.serviceability(pincode ?? ''),
    enabled: !!pincode,
    staleTime,
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

export function useCategories(storeId: string) {
  return useQuery({
    queryKey: keys.categories(storeId),
    staleTime,
    queryFn: async (): Promise<CategoryNode[]> => {
      const { data, error } = await api.GET('/stores/{id}/categories', { params: { path: { id: storeId } } })
      if (error) throw error
      return data.items
    },
  })
}

// Client-side: the first 12 in-stock products of core's first page, in core's order.
function inStockPicks(items: StoreProduct[]) {
  return items.filter((product) => product.inStock).slice(0, 12)
}

export function usePicked(storeId: string) {
  return useQuery({
    queryKey: keys.picked(storeId),
    staleTime,
    queryFn: async (): Promise<StoreProduct[]> => {
      const { data, error } = await api.GET('/stores/{id}/products', {
        params: { path: { id: storeId }, query: { pageSize: 24 } },
      })
      if (error) throw error
      return data.items
    },
    select: inStockPicks,
  })
}
