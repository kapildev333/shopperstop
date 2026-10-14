import { queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Store = components['schemas']['Store']
export type StoreProduct = components['schemas']['StoreProduct']
export type StoreProductList = components['schemas']['StoreProductList']
export type Category = components['schemas']['Category']
export type CategoryNode = components['schemas']['CategoryNode']

export const keys = {
  serviceability: (pincode: string) => ['serviceability', pincode] as const,
  categories: (storeId: string) => ['categories', storeId] as const,
  picked: (storeId: string) => ['picked', storeId] as const,
  feed: (storeId: string, filter: { categoryId?: string; q?: string }) => ['feed', storeId, filter] as const,
  product: (storeId: string, slug: string) => ['product', storeId, slug] as const,
}
// ponytail: a resolved store, category tree or first page is trusted for a minute, so moving between pages does not ask core again.
const staleTime = 60_000

// Only core's 404 not_serviceable means no store delivers; any other 404 is a lookup failure.
export function serviceabilityMissing(status: number, error: components['schemas']['Error'] | undefined) {
  return status === 404 && error?.error?.code === 'not_serviceable'
}

// The lookup the pages and the store-change check share: one request per pincode for a minute.
export function serviceabilityOptions(pincode: string) {
  return queryOptions({
    queryKey: keys.serviceability(pincode),
    staleTime,
    // Core answers 404 not_serviceable for a pincode no store delivers to: null, a notice, not an error.
    queryFn: async (): Promise<Store | null> => {
      const { data, error, response } = await api.GET('/serviceability', {
        params: { query: { pincode } },
      })
      if (serviceabilityMissing(response.status, error)) return null
      if (error) throw error
      const store = data?.store
      if (!store) throw new Error(`serviceability answered ${response.status} without a store`)
      return store
    },
  })
}

export function useServiceability(pincode: string | undefined) {
  return useQuery({ ...serviceabilityOptions(pincode ?? ''), enabled: !!pincode })
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

export const feedPageSize = 24

// Pages of 24; the next page exists while page × pageSize is below total.
export function useProductFeed(storeId: string, filter: { categoryId?: string; q?: string }) {
  return useInfiniteQuery({
    queryKey: keys.feed(storeId, filter),
    staleTime,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<StoreProductList> => {
      const { data, error } = await api.GET('/stores/{id}/products', {
        params: { path: { id: storeId }, query: { ...filter, page: pageParam, pageSize: feedPageSize } },
      })
      if (error) throw error
      return data
    },
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  })
}

// The parent of a slug, and the selected node: the parent itself, or one of its children.
export function findCategory(tree: CategoryNode[], slug: string): { parent: CategoryNode; selected: Category } | undefined {
  for (const parent of tree) {
    if (parent.slug === slug) return { parent, selected: parent }
    const child = parent.children.find((node) => node.slug === slug)
    if (child) return { parent, selected: child }
  }
  return undefined
}

// Core answers 404 for a slug no active product has: null, the "Product not found" state, not an error.
export function useProduct(storeId: string, slug: string) {
  return useQuery({
    queryKey: keys.product(storeId, slug),
    staleTime,
    queryFn: async (): Promise<StoreProduct | null> => {
      const { data, error, response } = await api.GET('/stores/{id}/products/{slug}', {
        params: { path: { id: storeId, slug } },
      })
      if (response.status === 404) return null
      if (error) throw error
      return data
    },
  })
}
