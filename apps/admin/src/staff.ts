import { queryOptions } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api, type Staff } from './api'

export type StaffList = components['schemas']['StaffList']

// Core takes at most 100 a page.
export const pageSize = 100

export const roleNames: Record<Staff['role'], string> = { admin: 'Admin', store_staff: 'Store staff' }

// Key: the list is ['admin', 'staff-users'] (exact); there is no read of one staff user in core.
// ponytail: the first 100 staff users by email, no pager; the page says so when core holds more. Add a pager when a panel passes 100.
export const staffUsersQuery = queryOptions({
  queryKey: ['admin', 'staff-users'],
  queryFn: async () => {
    const { data, error } = await api.GET('/admin/staff-users', { params: { query: { pageSize } } })
    if (error) throw error.error
    return data
  },
})

// The list with core's answer to a create or a change written into it, in core's order (by email), with no second read.
// ponytail: core orders a citext column, so emails compare lowercased; punctuation follows the database's collation
// (`a.b@` against `ab@`), which the client does not copy: such a row may sit one place off until the next read.
export function withStaff(list: StaffList, saved: Staff): StaffList {
  const others = list.items.filter((user) => user.id !== saved.id)
  const key = (user: Staff) => user.email.toLowerCase()
  const items = [...others, saved].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
  return { ...list, items, total: list.total + items.length - list.items.length }
}
