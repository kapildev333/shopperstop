import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type StockRow = components['schemas']['StockRow']
// What the URL of /stock holds. Absent means: the first store (admins), no search, every quantity, page 1.
export type StockSearch = { store?: string; q?: string; lowStock?: true; page?: number }
// Unsaved quantities as typed, by product id, with the product's name for messages about rows on another page.
export type Edits = Record<string, { name: string; value: string }>

export const pageSize = 24
// Core's rules (services/core/internal/stock): low stock is below 5, a quantity is 0 to 100000, one PUT takes 1 to 500 rows.
export const lowStockBelow = 5
export const maxQuantity = 100000
export const maxRows = 500
// What the URL may ask core for: q of at most 100 characters; a page core does not refuse as too large (its limit at 24 a page is 89478486).
export const maxSearch = 100
export const maxPage = 100000

// A search as core takes it: no NUL byte, no half of a surrogate pair (the request URL could not be built from one), and at
// most 100 characters counted as core counts them, by code point, so an emoji is kept whole or left out, never cut through.
export function cleanSearch(q: string) {
  return Array.from(q)
    .filter((character) => character !== '\0' && !/^[\uD800-\uDFFF]$/.test(character))
    .slice(0, maxSearch)
    .join('')
}

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

// A store's name from the public route: store staff may not list the stores, anyone may read this.
export const storeNameQuery = (storeId: string) =>
  queryOptions({
    queryKey: ['stores', storeId, 'name'],
    queryFn: async () => {
      const { data, error } = await api.GET('/stores/{id}', { params: { path: { id: storeId } } })
      if (error) throw error.error
      return data.name
    },
  })

// A quantity as typed to the number core takes; anything else is not sendable.
export function parseQuantity(value: string) {
  const text = value.trim()
  return /^\d{1,6}$/.test(text) && Number(text) <= maxQuantity ? Number(text) : undefined
}

// The rows of one PUT, in the order the edits were made. A value that is not a quantity is left out, never sent as a made-up
// number; the page refuses to save before that.
// ponytail: one save sends the first 500 rows (core's limit) and the rest stay unsaved for the next press; send several PUTs if anyone ever types that many.
export function toRows(edits: Edits) {
  return Object.entries(edits)
    .flatMap(([productId, edit]) => {
      const quantity = parseQuantity(edit.value)
      return quantity === undefined ? [] : [{ productId, quantity }]
    })
    .slice(0, maxRows)
}
