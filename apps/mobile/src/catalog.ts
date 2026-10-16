import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api, coreUrl, unreachable } from './api'

export type Category = components['schemas']['Category']
export type CategoryNode = components['schemas']['CategoryNode']
export type StoreProduct = components['schemas']['StoreProduct']

export type StoreProductList = components['schemas']['StoreProductList']

export type ProductFilter = { categoryId?: string; q?: string }

export const pageSize = 24
const pickCount = 12

// Core answers image paths; the origin is core's, not the API base.
export function imageUri(path: string | undefined): string | undefined {
  return path === undefined ? undefined : `${coreUrl.replace('/api/core/v1', '')}${path}`
}

// Core caps the count at 10 for display, so 10 reads "10+ left".
export function stockLabel(quantity: number): string | undefined {
  if (quantity <= 0) return undefined
  return quantity >= 10 ? '10+ left' : `Only ${quantity} left`
}

// A child is found under its parent; a parent selects itself.
export function findCategory(tree: CategoryNode[], slug: string): { parent: CategoryNode; selected: Category } | undefined {
  for (const parent of tree) {
    if (parent.slug === slug) return { parent, selected: parent }
    const child = parent.children.find((node) => node.slug === slug)
    if (child) return { parent, selected: child }
  }
  return undefined
}

// Home's "Picked for you": the first in-stock products of page one, in core's order.
export function usePicks(storeId: string) {
  return useQuery({
    queryKey: ['products', storeId, 'picks'],
    queryFn: async () => {
      const { data, error } = await api.GET('/stores/{id}/products', {
        params: { path: { id: storeId }, query: { page: 1, pageSize } },
      })
      if (error) throw error.error
      if (!data) throw unreachable
      return data.items.filter((product) => product.inStock).slice(0, pickCount)
    },
  })
}

// The paged products of a store, filtered; the next page while the ones so far fall short of `total`.
export function useProductPages(storeId: string, filter: ProductFilter) {
  return useInfiniteQuery({
    queryKey: ['products', storeId, filter],
    initialPageParam: 1,
    getNextPageParam: (last: StoreProductList) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    queryFn: async ({ pageParam }): Promise<StoreProductList> => {
      const { data, error } = await api.GET('/stores/{id}/products', {
        params: { path: { id: storeId }, query: { ...filter, page: pageParam, pageSize } },
      })
      if (error) throw error.error
      if (!data) throw unreachable
      return data
    },
  })
}
