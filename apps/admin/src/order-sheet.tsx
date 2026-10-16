import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Badge, Button, Dialog, DialogFooter, ErrorBanner, FormField, Input, Price, Sheet, StatusMessage } from '@shopperstop/ui'
import { when } from '@shopperstop/ui/app'
import { orderQuery, payment, paymentBadge, statusBadge, statusLabel, useSetStatus, type Order } from './orders'

// Core takes a note of at most 500 characters (services/core/internal/order/handlers.go).
const maxReason = 500
const actor = { customer: 'the customer', staff: 'staff', system: 'the system', rider: 'the rider' }

// The order's payment in words, on its card, its sheet and its History row.
export function PaymentBadge({ order }: { order: Order }) {
  const { variant, label } = paymentBadge[payment(order)]
  return <Badge variant={variant}>{label}</Badge>
}

function Details({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-4 text-body text-ink">
      <p className="flex flex-wrap items-center gap-2">
        <Badge variant={statusBadge(order.status)}>{statusLabel[order.status]}</Badge>
        <PaymentBadge order={order} />
        Placed {when(order.placedAt)}
      </p>
      {order.cancelReason && <p>Reason for cancelling: {order.cancelReason}</p>}
      {order.riderName && <p>Rider: {order.riderName}</p>}
      {order.paymentReference && (
        <p>
          Payment reference: <span className="tabular-nums">{order.paymentReference}</span>
        </p>
      )}
      <section aria-labelledby="order-items" className="flex flex-col gap-2">
        <h3 id="order-items" className="text-h3">Items</h3>
        <ul className="flex flex-col gap-1">
          {order.items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3">
              <span>
                <span className="tabular-nums">{item.quantity}</span> × {item.name}, {item.unitLabel}
              </span>
              <Price cents={item.priceCents * item.quantity} />
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-1 border-t border-line pt-2">
          <dt>Subtotal</dt>
          <dd className="text-right"><Price cents={order.subtotalCents} /></dd>
          <dt>Delivery fee</dt>
          <dd className="text-right"><Price cents={order.deliveryFeeCents} /></dd>
          <dt className="font-semibold">Total, {order.paymentMethod === 'online' ? 'online payment' : 'cash on delivery'}</dt>
          <dd className="text-right"><Price cents={order.totalCents} /></dd>
        </dl>
      </section>
      <section aria-labelledby="order-customer" className="flex flex-col gap-1">
        <h3 id="order-customer" className="text-h3">Customer</h3>
        <p>{order.customerName}</p>
        {order.customerPhone ? (
          <a href={`tel:${order.customerPhone}`} className="text-accent underline tabular-nums">{order.customerPhone}</a>
        ) : (
          <p>No phone number</p>
        )}
      </section>
      <section aria-labelledby="order-address" className="flex flex-col gap-1">
        <h3 id="order-address" className="text-h3">Address</h3>
        <p>
          {order.address.label}: {order.address.line1}
          {order.address.line2 && `, ${order.address.line2}`}, <span className="tabular-nums">{order.address.pincode}</span>
        </p>
      </section>
      <section aria-labelledby="order-events" className="flex flex-col gap-1">
        <h3 id="order-events" className="text-h3">History</h3>
        <ol className="flex flex-col gap-1">
          {order.events.map((event, i) => (
            <li key={i}>
              {/* A payment event leaves the status where it was: its note says what happened. */}
              {event.fromStatus === event.toStatus ? (
                `${event.note}, by ${event.actorName ?? actor[event.actorType]}, ${when(event.createdAt)}`
              ) : (
                <>
                  {statusLabel[event.toStatus]} by {event.actorName ?? actor[event.actorType]}, {when(event.createdAt)}
                  {event.note && `: ${event.note}`}
                </>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

// One order, opened from a card or a history row that put what it knew of the order in the cache.
// The cancel dialog opens over the sheet; Escape closes the top one first (ui's modal stack).
export function OrderSheet({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const query = useQuery(orderQuery(orderId))
  const order = query.data
  const cancel = useSetStatus(order?.storeId ?? '')
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [missing, setMissing] = useState(false)
  const result = useRef<HTMLDivElement>(null)
  // The dialog gave the keyboard back to the sheet's "Cancel order", which a finished cancel removed: go to the result.
  useEffect(() => {
    if (cancel.data && !asking && document.activeElement === document.body) result.current?.focus()
  }, [cancel.data, asking])
  if (!order) return null

  // The dialog stays while the cancel runs: closing it would hide a request that is still changing the order.
  function closeDialog() {
    if (cancel.isPending) return
    setAsking(false)
    setMissing(false)
    if (cancel.isError) cancel.reset()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (cancel.isPending || !order) return
    const note = reason.trim()
    if (!note) return setMissing(true)
    cancel.mutate({ order, status: 'cancelled', note }, { onSuccess: () => setAsking(false) })
  }

  return (
    <>
      <Sheet open onClose={onClose} title={`Order ${order.number}`}>
        <div className="flex flex-col gap-4">
          {/* The one notice a page of this lane shows itself: the sheet is a modal over the app's own notice. */}
          {query.isError && <StatusMessage tone="warning">Could not refresh. Showing what was loaded last.</StatusMessage>}
          <div ref={result} role="group" aria-label="Cancel result" tabIndex={-1} className="empty:hidden">
            {cancel.data &&
              (cancel.data.changedElsewhere ? (
                <StatusMessage tone="warning">Someone else changed this order first: it is now {statusLabel[cancel.data.order.status]}.</StatusMessage>
              ) : (
                <StatusMessage tone="success">Order cancelled.</StatusMessage>
              ))}
          </div>
          <Details order={order} />
          {(order.status === 'placed' || order.status === 'accepted') && (
            <Button variant="secondary" onClick={() => setAsking(true)}>Cancel order</Button>
          )}
        </div>
      </Sheet>
      <Dialog open={asking} onClose={closeDialog} title={`Cancel order ${order.number}?`}>
        <form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <p className="text-body text-ink">Its items go back into stock. The customer sees the reason.</p>
          {cancel.isError && <ErrorBanner message="Could not cancel the order. Try again." />}
          <FormField label="Reason" error={missing ? 'Enter a reason.' : undefined}>
            <Input
              maxLength={maxReason}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setMissing(false)
              }}
            />
          </FormField>
          <DialogFooter onCancel={closeDialog} cancelLabel="Keep order">
            <Button type="submit" aria-disabled={cancel.isPending}>
              {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}
