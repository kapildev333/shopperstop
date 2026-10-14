import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Badge, Card, ErrorBanner, PageHeader, Skeleton, StatusMessage, Table, type Column } from '@shopperstop/ui'
import type { Staff } from '../../../api'
import { pageSize, roleNames, staffUsersQuery } from '../../../staff'
import { storesQuery } from '../../../stores'

function StaffUsers() {
  const { staff: me } = Route.useRouteContext()
  const users = useQuery(staffUsersQuery)
  // The stores name each store-staff row.
  const stores = useQuery(storesQuery)
  const list = users.data
  const storeItems = stores.data?.items
  const storeName = new Map(storeItems?.map((store) => [store.id, store.name]))

  const columns: Column<Staff>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (user) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{user.name}</span>
          {user.id === me.id && <Badge variant="accent">You</Badge>}
        </span>
      ),
    },
    { key: 'email', header: 'Email', cell: (user) => user.email },
    { key: 'role', header: 'Role', cell: (user) => roleNames[user.role] },
    {
      key: 'store',
      header: 'Store',
      // ponytail: a store beyond the first 100 by name has no name here; core never deletes a store that staff refer to.
      cell: (user) => (user.storeId ? (storeName.get(user.storeId) ?? 'Unknown store') : 'All stores'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (user) => <Badge variant={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff" />
      {list === undefined || storeItems === undefined ? (
        users.isError || stores.isError ? (
          <ErrorBanner message="Could not load the staff users." onRetry={() => void Promise.all([users.refetch(), stores.refetch()])} />
        ) : (
          <Skeleton variant="table" count={4} />
        )
      ) : (
        <>
          {list.total > list.items.length && (
            <StatusMessage>Showing the first {pageSize} of {list.total} staff users, by email.</StatusMessage>
          )}
          <Card className="overflow-hidden">
            <Table stack caption="Staff users" columns={columns} rows={list.items} rowKey={(user) => user.id} />
          </Card>
        </>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/staff')({ component: StaffUsers })
