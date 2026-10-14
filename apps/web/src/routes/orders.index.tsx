import type { ReactNode } from 'react'
import { Link, createFileRoute, Navigate } from '@tanstack/react-router'
import { Card, EmptyState, ErrorBanner, PageHeader, Price, Skeleton, StatusMessage, buttonClass } from '@shopperstop/ui'
import { StatusBadge } from '../order-parts'
import { formatWhen, useOrders, type Order } from '../orders'
import { useToken } from '../session'

function Orders() {
  const token = useToken()
  if (!token) return <Navigate to="/sign-in" search={{ returnTo: '/orders' }} replace />
  return <History />
}

function History() {
  const { data, error, refetch } = useOrders()
  // A view checks its data before its error: a failed refetch keeps the list on screen.
  if (data === undefined) {
    return (
      <Frame>
        {error ? <ErrorBanner message="Could not load your orders." onRetry={() => void refetch()} /> : <Skeleton variant="list" count={3} />}
      </Frame>
    )
  }
  if (data.items.length === 0) {
    return (
      <Frame>
        <Card className="p-6">
          <EmptyState
            title="No orders yet"
            action={
              <Link to="/" className={buttonClass({ variant: 'primary' })}>
                Start shopping
              </Link>
            }
          />
        </Card>
      </Frame>
    )
  }
  return (
    <Frame>
      <ul className="flex flex-col gap-3">
        {data.items.map((order) => (
          <li key={order.id}>
            <OrderCard order={order} />
          </li>
        ))}
      </ul>
      {data.total > data.items.length && <StatusMessage>Showing your latest {data.items.length} orders.</StatusMessage>}
    </Frame>
  )
}

function OrderCard({ order }: { order: Order }) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <h2 className="text-h3 tabular-nums text-ink">{order.number}</h2>
      <StatusBadge status={order.status} />
      <time dateTime={order.placedAt} className="text-small text-ink-muted">
        {formatWhen(order.placedAt)}
      </time>
      <span className="text-small text-ink-muted">{count === 1 ? '1 item' : `${count} items`}</span>
      <Price cents={order.totalCents} />
      <Link
        to="/orders/$id"
        params={{ id: order.id }}
        aria-label={`View order ${order.number}`}
        className={buttonClass({ variant: 'secondary' })}
      >
        View order
      </Link>
    </Card>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Your orders" />
      {children}
    </div>
  )
}

export const Route = createFileRoute('/orders/')({
  component: Orders,
})
