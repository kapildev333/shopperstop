import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { Card, EmptyState, ErrorBanner, FormField, PageHeader, Select, Skeleton, TabNav } from '@shopperstop/ui'
import { OrderBoard } from '../../order-board'
import { OrderHistory } from '../../order-history'
import { maxPage, type OrdersSearch } from '../../orders'
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
  const go = useCallback((change: OrdersSearch, replace?: boolean) => void navigate({ search: (current) => ({ ...current, ...change }), replace }), [navigate])

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
                {/* Another store starts again: its board or the first page of its history. */}
                <Select value={storeId} onChange={(event) => void navigate({ search: { store: event.target.value, tab: search.tab } })}>
                  {items.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </Select>
              </FormField>
            </Card>
          )}
          {/* Both tabs are /orders, so the router's own "active" (same path, search contained) would mark Board on
              History too: `exact` leaves it to mark only an equal URL, and `aria-current` here says the rest. */}
          <TabNav label="Orders" className="bg-surface px-4">
            <Link to="/orders" search={{ store: search.store }} activeOptions={{ exact: true }} aria-current={search.tab ? undefined : 'page'}>Board</Link>
            <Link to="/orders" search={{ store: search.store, tab: 'history' }} activeOptions={{ exact: true }} aria-current={search.tab ? 'page' : undefined}>History</Link>
          </TabNav>
          {search.tab ? (
            <OrderHistory key={storeId} storeId={storeId} status={search.status ?? 'delivered'} page={search.page ?? 1} go={go} />
          ) : (
            <OrderBoard key={storeId} storeId={storeId} />
          )}
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
  // The router reads search values as JSON: `page=2` is a number. What core would answer 400 to is not sent:
  // a status that is not one of the two, a page far beyond any list.
  validateSearch: (search: Record<string, unknown>): OrdersSearch => ({
    store: typeof search.store === 'string' ? search.store : undefined,
    tab: search.tab === 'history' ? 'history' : undefined,
    status: search.status === 'cancelled' ? 'cancelled' : undefined,
    page: typeof search.page === 'number' && Number.isInteger(search.page) && search.page > 1 ? Math.min(search.page, maxPage) : undefined,
  }),
  component: Orders,
})
