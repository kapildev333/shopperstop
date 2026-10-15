import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button, Card, Chip, EmptyState, ErrorBanner, Price, Skeleton, Table, cn, type Column } from '@shopperstop/ui'
import { idle } from './idle'
import { OrderSheet } from './order-sheet'
import { historyQuery, itemCount, orderQuery, pageSize, statusLabel, when, type Finished, type Order, type OrdersSearch } from './orders'

// One store's finished orders. The route gives it `key={storeId}`, so nothing kept here outlives a change of store.
// `go` changes the URL; the status filter starts again at page 1.
export function OrderHistory({ storeId, status, page, go }: { storeId: string; status: Finished; page: number; go: (change: OrdersSearch, replace?: boolean) => void }) {
  const queryClient = useQueryClient()
  const history = useQuery(historyQuery(storeId, status, page))
  const [open, setOpen] = useState<string>()
  // Rows kept from the page before, while the one asked for loads: shown dimmed.
  const stale = history.isPlaceholderData
  const total = history.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))

  // A page past the end (a typed URL) moves to the last page that has rows.
  const pastEnd = page > 1 && !stale && history.data?.items.length === 0
  useEffect(() => {
    const last = Math.ceil(total / pageSize)
    if (pastEnd) go({ page: last > 1 ? last : undefined }, true)
  }, [pastEnd, total, go])

  // The sheet starts from the row and reads the order itself from there.
  function show(order: Order) {
    queryClient.setQueryData(orderQuery(order.id).queryKey, order)
    setOpen(order.id)
  }

  const columns: Column<Order>[] = [
    { key: 'order', header: 'Order', cell: (order) => <Button variant="ghost" className="tabular-nums" onClick={() => show(order)}>{order.number}</Button> },
    { key: 'placed', header: 'Placed', cell: (order) => when(order.placedAt) },
    { key: 'customer', header: 'Customer', cell: (order) => order.customerName },
    { key: 'items', header: 'Items', cell: (order) => itemCount(order) },
    { key: 'total', header: 'Total', cell: (order) => <Price cents={order.totalCents} /> },
    { key: 'finished', header: statusLabel[status], cell: (order) => when(order.deliveredAt ?? order.cancelledAt ?? order.placedAt) },
  ]

  return (
    <>
      <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
        <Chip selected={status === 'delivered'} onClick={() => go({ status: undefined, page: undefined })}>Delivered</Chip>
        <Chip selected={status === 'cancelled'} onClick={() => go({ status: 'cancelled', page: undefined })}>Cancelled</Chip>
      </div>
      {history.data === undefined ? (
        history.isError ? (
          <ErrorBanner message="Could not load the orders." onRetry={() => void history.refetch()} />
        ) : (
          <Skeleton variant="table" count={6} />
        )
      ) : (
        <>
          {history.data.items.length === 0 ? (
            <Card className="p-6">
              <EmptyState title={`No ${status} orders`} description="Orders show here once they are delivered or cancelled." />
            </Card>
          ) : (
            <>
              <Card aria-busy={stale} className={cn('overflow-hidden', stale && 'opacity-50')}>
                <Table stack caption="Order history" columns={columns} rows={history.data.items} rowKey={(order) => order.id} />
              </Card>
              <nav aria-label="Pages" className="flex items-center justify-between gap-4">
                <Button variant="secondary" aria-disabled={page <= 1} className={idle} onClick={() => page > 1 && go({ page: page - 1 })}>
                  Previous
                </Button>
                <p className="text-body text-ink tabular-nums">
                  Page {history.data.page} of {pages}, {total} orders
                </p>
                <Button variant="secondary" aria-disabled={page >= pages} className={idle} onClick={() => page < pages && go({ page: page + 1 })}>
                  Next
                </Button>
              </nav>
            </>
          )}
        </>
      )}
      {open && <OrderSheet orderId={open} onClose={() => setOpen(undefined)} />}
    </>
  )
}
