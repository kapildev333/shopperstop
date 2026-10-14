import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type StockRow = components['schemas']['StockRow']
// What the URL of /stock holds. Absent means: the first store (admins), no search, every quantity, page 1.
export type StockSearch = { store?: string; q?: string; lowStock?: true; page?: number }

export const pageSize = 24
// Core's rule (services/core/internal/stock): low stock is below 5, zero included.
export const lowStockBelow = 5

// Keys: one page of a store's stock is ['admin', 'stock', storeId, filters].
export const stockQuery = (storeId: string, filters: { q?: string; lowStock?: true; page: number }) =>
  queryOptions({
    queryKey: ['admin', 'stock', storeId, filters],
    queryFn: async () => {
      const query = { q: filters.q, lowStock: filters.lowStock, page: filters.page, pageSize }
      const { data, error } = await api.GET('/admin/stores/{id}/stock', { params: { path: { id: storeId }, query } })
      if (error) throw error.error
      return data
    },
    // The page on screen stays while the next one loads, so the pager keeps keyboard focus; never another store's rows.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === storeId ? keepPreviousData(previous) : undefined),
  })
