import { useId, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatusMessage,
  buttonClass,
} from '@shopperstop/ui'
import { Totals } from './cart-drawer'
import { formatWhen, statusMessage, statusName, useOrder, type Order } from './orders'
import { LineRow } from './order-parts'

export function OrderPage({ id }: { id: string }) {
  const { data: order, isError, refetch } = useOrder(id)

  // A view checks its data before its error: a failed repeat keeps the order on screen.
  if (order === undefined) {
    return (
      <Frame title="Order">
        {isError ? <ErrorBanner message="Could not load this order." onRetry={() => void refetch()} /> : <Skeleton variant="list" count={3} />}
      </Frame>
    )
  }
  if (order === null) {
    return (
      <Frame title="Order not found">
        <Card className="p-6">
          <EmptyState
            title="Nothing at this address"
            description="The link may be old or mistyped."
            action={
              <Link to="/orders" className={buttonClass({ variant: 'secondary' })}>
                Your orders
              </Link>
            }
          />
        </Card>
      </Frame>
    )
  }
  return <OrderContent order={order} />
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      {children}
    </div>
  )
}

function OrderContent({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="tabular-nums"
        title={`Order ${order.number}`}
        actions={
          <Link to="/orders" className={buttonClass({ variant: 'secondary' })}>
            All orders
          </Link>
        }
      />
      {/* The one status message: it stays at this place, so a change is announced in place. */}
      <Card className="p-4 sm:p-6">
        <StatusMessage tone={order.status === 'delivered' ? 'success' : 'neutral'}>{statusMessage(order)}</StatusMessage>
      </Card>
      <History order={order} />
      <Section title="Items">
        <ul className="flex flex-col divide-y divide-line">
          {order.items.map((item) => (
            <LineRow
              key={item.productId}
              name={item.name}
              unitLabel={item.unitLabel}
              imageUrl={item.imageUrl}
              priceCents={item.priceCents}
              quantity={item.quantity}
            />
          ))}
        </ul>
        <Totals subtotalCents={order.subtotalCents} deliveryFeeCents={order.deliveryFeeCents} totalCents={order.totalCents} />
        <p className="flex justify-between text-body text-ink">
          <span>Payment</span>
          <span>Cash on delivery</span>
        </p>
      </Section>
      <Section title="Delivery address">
        <div className="flex flex-col">
          <p className="text-h3 text-ink">{order.address.label}</p>
          <p className="text-body text-ink">{order.address.line1}</p>
          {order.address.line2 && <p className="text-body text-ink">{order.address.line2}</p>}
          <p className="text-body text-ink-muted tabular-nums">{order.address.pincode}</p>
        </div>
      </Section>
    </div>
  )
}

// The events, oldest first; each names its status and its time.
function History({ order }: { order: Order }) {
  const headingId = useId()
  return (
    <Card role="region" aria-labelledby={headingId} className="flex flex-col gap-4 p-4 sm:p-6">
      <h2 id={headingId} className="text-h2 text-ink">
        Status history
      </h2>
      <ol aria-labelledby={headingId} className="flex flex-col gap-3">
        {order.events.map((event) => (
          <li key={`${event.createdAt}-${event.toStatus}`} className="flex flex-col">
            <p className="text-body font-semibold text-ink">{statusName(event.toStatus)}</p>
            <time dateTime={event.createdAt} className="text-small text-ink-muted">
              {formatWhen(event.createdAt)}
            </time>
            {event.note && <p className="text-small text-ink">{event.note}</p>}
          </li>
        ))}
      </ol>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <Card role="region" aria-labelledby={headingId} className="flex flex-col gap-4 p-4 sm:p-6">
      <h2 id={headingId} className="text-h2 text-ink">
        {title}
      </h2>
      {children}
    </Card>
  )
}
