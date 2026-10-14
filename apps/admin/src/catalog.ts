import { queryOptions } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Category = components['schemas']['Category']
export type CategoryNode = components['schemas']['CategoryNode']
export type Product = components['schemas']['Product']
export type ProductFilters = { q: string; categoryId: string; isActive: '' | 'true' | 'false'; page: number }

export const pageSize = 24

// Keys: the tree is ['admin', 'categories']; a product list page ['admin', 'products', filters]; one product ['admin', 'products', id].
export const categoriesQuery = queryOptions({
  queryKey: ['admin', 'categories'],
  queryFn: async () => {
    const { data, error } = await api.GET('/admin/categories')
    if (error) throw error.error
    return data
  },
})

export const productsQuery = (filters: ProductFilters) =>
  queryOptions({
    queryKey: ['admin', 'products', filters],
    queryFn: async () => {
      // Empty filters are left out: core reads an absent filter as "all".
      const query = {
        q: filters.q || undefined,
        categoryId: filters.categoryId || undefined,
        isActive: filters.isActive || undefined,
        page: filters.page,
        pageSize,
      }
      const { data, error } = await api.GET('/admin/products', { params: { query } })
      if (error) throw error.error
      return data
    },
  })

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'products', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/admin/products/{id}', { params: { path: { id } } })
      if (error) throw error.error
      return data
    },
  })

// Every category as a choice, in tree order: a parent by its name, a child as "Parent › Child".
export function categoryOptions(tree: CategoryNode[]) {
  return tree.flatMap((parent) => [
    { id: parent.id, label: parent.name },
    ...parent.children.map((child) => ({ id: child.id, label: `${parent.name} › ${child.name}` })),
  ])
}
