import { useId, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import {
  Button,
  ButtonLink,
  Card,
  Dialog,
  DialogFooter,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatusMessage,
  VisuallyHidden,
  buttonClass,
} from '@shopperstop/ui'
import { Totals } from './cart-drawer'
import { cancelOrder, canCancel, formatWhen, lastSeen, postCancel, riderStage, statusMessage, statusName, underWay, useDelivery, useOrder, type Order } from './orders'
import { Countdown, LineRow, StatusBadge, useNow } from './order-parts'

export function OrderPage({ id, send = postCancel }: { id: string; send?: typeof postCancel }) {
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
  return <OrderContent id={id} order={order} send={send} />
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      {children}
    </div>
  )
}

function OrderContent({ id, order, send }: { id: string; order: Order; send: typeof postCancel }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cancelError, setCancelError] = useState<string>()

  const open = () => {
    setCancelError(undefined)
    setConfirming(true)
  }
  const close = () => setConfirming(false)

  // An answered cancel closes the dialog; a refusal keeps it open with the reason.
  async function confirm() {
    setBusy(true)
    const result = await cancelOrder(id, send)
    setBusy(false)
    if (result.order) setConfirming(false)
    else setCancelError(result.error?.code === 'conflict' ? 'This order can no longer be cancelled.' : 'Could not cancel the order. Try again.')
  }

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
      {/* The one status message: it stays at this place, so a change is announced in place. The countdown is beside it, not in it. */}
      <Card className="flex flex-col gap-4 p-4 sm:p-6">
        <StatusMessage tone={order.status === 'delivered' ? 'success' : 'neutral'}>{statusMessage(order)}</StatusMessage>
        {underWay(order.status) && <Countdown placedAt={order.placedAt} promisedMinutes={order.promisedMinutes} />}
        {canCancel(order.status) && (
          <div>
            <Button variant="ghost-danger" onClick={open}>
              Cancel order
            </Button>
          </div>
        )}
      </Card>
      <RiderCard order={order} />
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
      {/* Outside the cancel condition, so it stays open when a refusal re-reads the order. */}
      <Dialog open={confirming} onClose={close} title="Cancel this order?">
        <p className="text-body text-ink">Order {order.number} will be cancelled and nothing will be delivered.</p>
        {cancelError && <ErrorBanner className="mt-4" message={cancelError} />}
        <DialogFooter onCancel={close} cancelLabel="Keep order">
          {canCancel(order.status) && (
            <Button loading={busy} onClick={() => void confirm()}>
              Cancel order
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </div>
  )
}

// From out for delivery on: who carries the order and where they were last seen. Nothing while no rider is known.
function RiderCard({ order }: { order: Order }) {
  const { data: delivery } = useDelivery(order)
  const now = useNow()
  // Core's snapshot first; the rider read names the rider when core has none (the demo seed's delivered order).
  const name = order.riderName ?? delivery?.riderName
  if (!riderStage(order.status) || !name) return null
  const location = delivery?.location
  return (
    <Section title="Rider">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-h3 text-ink">{name}</p>
        <StatusBadge status={order.status} />
      </div>
      {location && (
        <>
          <time dateTime={location.recordedAt} className="text-small text-ink-muted">
            {lastSeen(location.recordedAt, now)}
          </time>
          <div>
            <ButtonLink
              variant="secondary"
              href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
              target="_blank"
              rel="noopener"
            >
              <MapPin size={16} aria-hidden />
              Open in Maps{" "}
              <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
            </ButtonLink>
          </div>
        </>
      )}
    </Section>
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
            {event.actorType === 'rider' && event.actorName && (
              <p className="text-small text-ink">
                {event.toStatus === 'out_for_delivery' ? 'Picked up' : 'Delivered'} by {event.actorName}
              </p>
            )}
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
