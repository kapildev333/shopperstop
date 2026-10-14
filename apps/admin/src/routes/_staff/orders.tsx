import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Card, EmptyState, ErrorBanner, FormField, PageHeader, Select, Skeleton } from '@shopperstop/ui'
import { OrderBoard } from '../../order-board'
import type { OrdersSearch } from '../../orders'
import { storeNameQuery } from '../../stock'
import { storesQuery } from '../../stores'

function Orders() {
  const { staff } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  // Store staff carry their store and may not list stores (403); an admin has none and picks one.
  const stores = useQuery({ ...storesQuery, enabled: !staff.storeId })
  // Store staff get no selector; their store's name is shown when it can be read, and left out when it cannot.
  const ownStore = useQuery({ ...storeNameQuery(staff.storeId ?? ''), enabled: !!staff.storeId })
  const items = stores.data?.items ?? []
  // ponytail: a `store` in the URL that is not in the list falls back to the first store, without a message.
  const storeId = staff.storeId ?? items.find((store) => store.id === search.store)?.id ?? items[0]?.id

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Orders" />
      {!staff.storeId && stores.data === undefined ? (
        stores.isError ? (
          <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
        ) : (
          <Skeleton variant="list" count={5} />
        )
      ) : storeId ? (
        <>
          {ownStore.data && (
            <p className="text-body text-ink">
              Store: <span className="font-semibold">{ownStore.data}</span>
            </p>
          )}
          {!staff.storeId && (
            <Card className="flex flex-wrap items-end gap-4 p-4">
              <FormField label="Store">
                <Select value={storeId} onChange={(event) => void navigate({ search: { store: event.target.value } })}>
                  {items.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </Select>
              </FormField>
            </Card>
          )}
          <OrderBoard key={storeId} storeId={storeId} />
        </>
      ) : (
        <Card className="p-6">
          <EmptyState title="No stores yet" description="Create a store, then its orders show here." />
        </Card>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/orders')({
  validateSearch: (search: Record<string, unknown>): OrdersSearch => ({
    store: typeof search.store === 'string' ? search.store : undefined,
  }),
  component: Orders,
})
