import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Card, EmptyState, ErrorBanner, PageHeader, Price, Skeleton, Table, type Column } from '@shopperstop/ui'
import { rider, type Delivery } from '../../api'
import { when } from '../../format'

// The newest 50 delivered deliveries. ponytail: no pager; a rider past 50 sees the newest 50, add the admin pager when riders ask.
const pageSize = 50

const deliveredQuery = {
  queryKey: ['rider', 'deliveries', 'delivered'],
  queryFn: async () => {
    const { data, error } = await rider.GET('/me/deliveries', { params: { query: { status: 'delivered', pageSize } } })
    if (error) throw error.error
    return data
  },
}

const columns: Column<Delivery>[] = [
  {
    key: 'order',
    header: 'Order',
    cell: (delivery) => (
      <Link
        to="/deliveries/$deliveryId"
        params={{ deliveryId: delivery.id }}
        className="inline-flex min-h-11 items-center font-semibold text-accent tabular-nums underline"
      >
        {delivery.orderNumber}
      </Link>
    ),
  },
  { key: 'customer', header: 'Customer', cell: (delivery) => delivery.customerName },
  { key: 'pincode', header: 'Pincode', cell: (delivery) => delivery.address.pincode },
  { key: 'total', header: 'Total', cell: (delivery) => <Price cents={delivery.totalCents} /> },
  { key: 'delivered', header: 'Delivered', cell: (delivery) => (delivery.deliveredAt ? when(delivery.deliveredAt) : '') },
]

function History() {
  const history = useQuery(deliveredQuery)
  const { data } = history

  return (
    <>
      <PageHeader title="History" />
      {data === undefined ? (
        history.isError ? (
          <ErrorBanner message="Could not load your deliveries." onRetry={() => void history.refetch()} />
        ) : (
          <Skeleton variant="table" count={6} />
        )
      ) : data.items.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No deliveries yet" description="Delivered orders show here." />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table stack caption="Delivered deliveries" columns={columns} rows={data.items} rowKey={(delivery) => delivery.id} />
          </Card>
          {data.total > data.items.length && (
            <p className="mt-3 text-body text-ink-muted tabular-nums">Showing the latest {pageSize} of {data.total}.</p>
          )}
        </>
      )}
    </>
  )
}

export const Route = createFileRoute('/_rider/history')({
  component: History,
})
