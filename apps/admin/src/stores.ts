import { queryOptions } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type AdminStore = components['schemas']['AdminStore']

// Keys: the list is ['admin', 'stores'] (exact), one store ['admin', 'stores', id], its pincodes one level below.
// ponytail: first 100 stores by name, no pager; add one when a city passes 100 stores.
export const storesQuery = queryOptions({
  queryKey: ['admin', 'stores'],
  queryFn: async () => {
    const { data, error } = await api.GET('/admin/stores', { params: { query: { pageSize: 100 } } })
    if (error) throw error.error
    return data
  },
})

export const storeQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'stores', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/admin/stores/{id}', { params: { path: { id } } })
      if (error) throw error.error
      return data
    },
  })

export const serviceAreasQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'stores', id, 'service-areas'],
    queryFn: async () => {
      const { data, error } = await api.GET('/admin/stores/{id}/service-areas', { params: { path: { id } } })
      if (error) throw error.error
      return data
    },
  })

// Rupees as typed (whole or two decimals, up to 7 digits) to paise; anything else is not sendable.
export function toCents(rupees: string) {
  const value = rupees.trim()
  return /^\d{1,7}(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : undefined
}

export function toRupees(cents: number) {
  return cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100)
}
