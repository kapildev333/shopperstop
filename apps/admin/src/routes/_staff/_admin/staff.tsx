import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Badge, Button, Card, ErrorBanner, PageHeader, Skeleton, StatusMessage, Table, type Column } from '@shopperstop/ui'
import type { Staff } from '../../../api'
import { pageSize, roleNames, staffUsersQuery } from '../../../staff'
import { StaffDialog } from '../../../staff-dialog'
import { storesQuery } from '../../../stores'

function StaffUsers() {
  const { staff: me } = Route.useRouteContext()
  const users = useQuery(staffUsersQuery)
  // The stores name each store-staff row and fill the dialog's "Store" choice.
  const stores = useQuery(storesQuery)
  const [editing, setEditing] = useState<Staff | 'new'>()
  const list = users.data
  const storeItems = stores.data?.items
  const storeName = new Map(storeItems?.map((store) => [store.id, store.name]))
  // The dialog diffs against the row as the list holds it now, so a refetch while it is open counts; the row as opened
  // only when the list no longer holds it (a cut list that moved), so an edit never turns into a create.
  const user = editing === 'new' ? undefined : editing && (list?.items.find((row) => row.id === editing.id) ?? editing)

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
    {
      key: 'actions',
      header: 'Actions',
      cell: (user) => <Button variant="ghost" aria-label={`Edit ${user.email}`} onClick={() => setEditing(user)}>Edit</Button>,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff" actions={list && storeItems && <Button onClick={() => setEditing('new')}>New staff user</Button>} />
      {/* The alert only for a read that failed holding nothing; a held read that fails waits under the skeleton for the other. */}
      {list === undefined || storeItems === undefined ? (
        (users.isError && list === undefined) || (stores.isError && storeItems === undefined) ? (
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
      {editing && storeItems && (
        <StaffDialog
          user={user}
          self={user?.id === me.id}
          stores={storeItems}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/staff')({ component: StaffUsers })
