import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Badge, Button, Card, EmptyState, ErrorBanner, FormField, PageHeader, Select, Skeleton, StatusMessage, Table, type Column } from '@shopperstop/ui'
import type { Rider } from '../../api'
import { RiderDialog } from '../../rider-dialog'
import { pageSize, ridersQuery } from '../../riders'
import { storeNameQuery } from '../../stock'
import { storesQuery } from '../../stores'

function Riders() {
  const { staff } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const isAdmin = !staff.storeId
  // Admins name each rider's store and choose one; store staff may not list stores (403) and see their own.
  const stores = useQuery({ ...storesQuery, enabled: isAdmin })
  const ownStore = useQuery({ ...storeNameQuery(staff.storeId ?? ''), enabled: !isAdmin })
  const storeItems = stores.data?.items
  // A `store` in the URL that is not a store is not sent (the service answers 400 to a non-uuid): all stores.
  const store = isAdmin ? storeItems?.find((each) => each.id === search.store)?.id : undefined
  const riders = useQuery({ ...ridersQuery(store), enabled: !isAdmin || storeItems !== undefined })
  const [editing, setEditing] = useState<Rider | 'new'>()
  const list = riders.data
  const storeName = new Map(storeItems?.map((each) => [each.id, each.name]))
  const rider = editing === 'new' ? undefined : editing && (list?.items.find((row) => row.id === editing.id) ?? editing)
  const ready = list !== undefined && (!isAdmin || storeItems !== undefined)

  const columns: Column<Rider>[] = [
    { key: 'name', header: 'Name', cell: (each) => <span className="font-semibold text-ink">{each.name}</span> },
    { key: 'email', header: 'Email', cell: (each) => each.email },
    { key: 'phone', header: 'Phone', cell: (each) => <span className="tabular-nums">{each.phone ?? 'None'}</span> },
    ...(isAdmin ? [{ key: 'store', header: 'Store', cell: (each: Rider) => storeName.get(each.storeId) ?? 'Unknown store' }] : []),
    { key: 'status', header: 'Status', cell: (each) => <Badge variant={each.isActive ? 'success' : 'neutral'}>{each.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', header: 'Actions', cell: (each) => <Button variant="ghost" aria-label={`Edit ${each.email}`} onClick={() => setEditing(each)}>Edit</Button> },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Riders" actions={ready && <Button onClick={() => setEditing('new')}>New rider</Button>} />
      {ownStore.data && (
        <p className="text-body text-ink">
          Store: <span className="font-semibold">{ownStore.data}</span>
        </p>
      )}
      {isAdmin && storeItems && (
        <Card className="flex flex-wrap items-end gap-4 p-4">
          <FormField label="Store">
            <Select value={store ?? ''} onChange={(event) => void navigate({ search: { store: event.target.value || undefined } })}>
              <option value="">All stores</option>
              {storeItems.map((each) => (
                <option key={each.id} value={each.id}>{each.name}</option>
              ))}
            </Select>
          </FormField>
        </Card>
      )}
      {!ready ? (
        (riders.isError && list === undefined) || (stores.isError && storeItems === undefined) ? (
          <ErrorBanner message="Could not load the riders." onRetry={() => void Promise.all([riders.refetch(), isAdmin && stores.refetch()])} />
        ) : (
          <Skeleton variant="table" count={4} />
        )
      ) : list.items.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No riders yet" description="Create a rider, then they can sign in to the rider app." />
        </Card>
      ) : (
        <>
          {list.total > list.items.length && <StatusMessage>Showing the first {pageSize} of {list.total} riders, by email.</StatusMessage>}
          <Card className="overflow-hidden">
            <Table stack caption="Riders" columns={columns} rows={list.items} rowKey={(each) => each.id} />
          </Card>
        </>
      )}
      {editing && ready && (
        <RiderDialog rider={rider} stores={storeItems} ownStoreId={staff.storeId} defaultStoreId={store} onClose={() => setEditing(undefined)} />
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/riders')({
  validateSearch: (search: Record<string, unknown>): { store?: string } => ({ store: typeof search.store === 'string' ? search.store : undefined }),
  component: Riders,
})
