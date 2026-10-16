import { queryOptions, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Price, Skeleton, buttonClass } from '@shopperstop/ui'
import type { components } from '@shopperstop/ui/api'
import { api } from '../../api'

type DashboardStore = components['schemas']['DashboardStore']

// One line per store the staff member may see: every store by name for an admin, their own for store staff.
const dashboardQuery = queryOptions({
  queryKey: ['admin', 'dashboard'],
  queryFn: async () => {
    const { data, error } = await api.GET('/admin/dashboard')
    if (error) throw error.error
    return data.items
  },
})

// The seven statuses, in the order an order moves through them.
const counts: [keyof DashboardStore['ordersToday'], string][] = [
  ['placed', 'Placed'],
  ['accepted', 'Accepted'],
  ['packing', 'Packing'],
  ['ready', 'Ready'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
]

function StoreCard({ store }: { store: DashboardStore }) {
  const total = counts.reduce((sum, [status]) => sum + store.ordersToday[status], 0)
  const heading = `dashboard-${store.storeId}`
  return (
    <Card role="region" aria-labelledby={heading} className="flex flex-col gap-4 p-4 text-body text-ink">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={heading} className="text-h2">{store.storeName}</h2>
        <Badge variant={store.isOpen ? 'success' : 'neutral'}>{store.isOpen ? 'Open' : 'Closed'}</Badge>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt className="font-semibold">Orders today</dt>
        <dd className="text-right font-semibold tabular-nums">{total}</dd>
        {counts.flatMap(([status, label]) => [
          <dt key={status}>{label}</dt>,
          <dd key={`${status}-count`} className="text-right tabular-nums">{store.ordersToday[status]}</dd>,
        ])}
        <dt className="mt-2 font-semibold">Revenue today</dt>
        <dd className="mt-2 text-right"><Price cents={store.revenueTodayCents} /></dd>
        <dt className="font-semibold">Low stock</dt>
        <dd className="text-right tabular-nums">{store.lowStockCount === 1 ? '1 product' : `${store.lowStockCount} products`}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Link to="/orders" search={{ store: store.storeId }} className={buttonClass({ variant: 'secondary' })} aria-label={`Orders at ${store.storeName}`}>Orders</Link>
        <Link to="/stock" search={{ store: store.storeId, lowStock: true }} className={buttonClass({ variant: 'secondary' })} aria-label={`Low stock at ${store.storeName}`}>Low stock</Link>
      </div>
    </Card>
  )
}

function Dashboard() {
  const dashboard = useQuery(dashboardQuery)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" />
      {dashboard.data === undefined ? (
        dashboard.isError ? (
          <ErrorBanner message="Could not load the dashboard." onRetry={() => void dashboard.refetch()} />
        ) : (
          <Skeleton variant="list" count={2} />
        )
      ) : (
        <>
          {dashboard.data.length === 0 ? (
            <Card className="p-6">
              <EmptyState title="No stores yet" description="Create a store, then its day shows here." />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.data.map((store) => (
                <StoreCard key={store.storeId} store={store} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/')({
  component: Dashboard,
})
