import { queryOptions } from '@tanstack/react-query'
import { riderApi } from './api'

// The rider service takes at most 100 a page.
export const pageSize = 100

// Keys: every riders list is under ['rider', 'riders']; one list is ['rider', 'riders', store or 'all'].
// ponytail: the first 100 riders by email, no pager; the page says so when the service holds more. Add a pager when a store passes 100.
export const ridersQuery = (store?: string) =>
  queryOptions({
    queryKey: ['rider', 'riders', store ?? 'all'],
    queryFn: async () => {
      const { data, error } = await riderApi.GET('/admin/riders', { params: { query: { pageSize, ...(store && { store }) } } })
      if (error) throw error.error
      return data
    },
  })
