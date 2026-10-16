import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, Dialog, DialogFooter, EmptyState, ErrorBanner, Price, Skeleton, StatusMessage, VisuallyHidden } from '@shopperstop/ui'
import { OrderSheet } from './order-sheet'
import { activeStatuses, boardQuery, isActive, itemCount, nextLabel, nextStatus, orderQuery, statusLabel, useSetStatus, useSince, type Order } from './orders'


// Its own component, so a minute passing renders this text and nothing else on the board.
function Since({ at }: { at: string }) {
  return (
    <time dateTime={at} className="text-small text-ink-muted">
      {useSince(at)}
    </time>
  )
}

function OrderCard({ order, busy, saving, onNext, onOpen }: { order: Order; busy: boolean; saving: boolean; onNext: () => void; onOpen: () => void }) {
  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Button variant="ghost" size="compact" id={`number-${order.id}`} className="tabular-nums" onClick={onOpen}>{order.number}</Button>
        <Since at={order.placedAt} />
      </div>
      <p className="text-small text-ink">
        {itemCount(order)}, pincode <span className="tabular-nums">{order.address.pincode}</span>
      </p>
      {order.riderName && <p className="text-small text-ink">Rider: {order.riderName}</p>}
      <Price cents={order.totalCents} />
      {isActive(order.status) && (
        // Named by its own text and the order's number: "Accept SS-…".
        <Button id={`next-${order.id}`} aria-labelledby={`next-${order.id} number-${order.id}`} aria-disabled={busy} onClick={onNext}>
          {saving ? 'Saving…' : nextLabel[order.status]}
        </Button>
      )}
    </Card>
  )
}

// One store's board. The route gives it `key={storeId}`, so nothing kept here outlives a change of store.
export function OrderBoard({ storeId }: { storeId: string }) {
  const board = useQuery(boardQuery(storeId))
  // What the last answer announced, and that answer. A failed poll brings no new answer, and an equal answer is the
  // same object (structural sharing), so neither announces anything; a changed answer with nothing new empties the region.
  // Only an answer core gave since this board was opened counts: orders kept from an earlier visit (the cache shows them
  // at once) are not a baseline, or what was placed while the board was away would be read out on opening it.
  const [heard, setHeard] = useState<{ from: Order[]; news: string }>()
  const answer = board.data?.items
  if (answer && board.isFetchedAfterMount && !board.isError && heard?.from !== answer) {
    const known = new Set(heard?.from.map((order) => order.id))
    // The first answer is what the store already had: nothing in it is new.
    const fresh = heard ? answer.filter((order) => order.status === 'placed' && !known.has(order.id)) : []
    const numbers = fresh.map((order) => order.number).join(', ')
    setHeard({ from: answer, news: fresh.length === 0 ? '' : fresh.length === 1 ? `New order ${numbers}` : `${fresh.length} new orders: ${numbers}` })
  }

  // One status change at a time on a board: while one runs, every card's button waits.
  const move = useSetStatus(storeId)
  const [confirm, setConfirm] = useState<Order>()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<string>()
  const result = useRef<HTMLDivElement>(null)
  const moved = move.data?.order
  // The pressed button went with the card's old place. If that left the keyboard nowhere, go to the card's new button,
  // or to the result when the order has left the board.
  useEffect(() => {
    if (moved && document.activeElement === document.body) (document.getElementById(`next-${moved.id}`) ?? result.current)?.focus()
  }, [moved])

  // The sheet starts from the card, the newest this page knows of the order, and reads the order itself from there.
  function show(order: Order) {
    queryClient.setQueryData(orderQuery(order.id).queryKey, order)
    setOpen(order.id)
  }

  function advance(order: Order) {
    if (move.isPending || !isActive(order.status)) return
    // Delivered ends the order and cannot be taken back: ask first.
    if (order.status === 'out_for_delivery') return setConfirm(order)
    move.mutate({ order, status: nextStatus[order.status] })
  }

  // A poll that fails keeps the board: the alert is only for a board with nothing to show. (The app's root says that a
  // refresh failed, once for the whole page.)
  if (board.data === undefined) {
    return board.isError ? <ErrorBanner message="Could not load the orders." onRetry={() => void board.refetch()} /> : <Skeleton variant="list" count={5} />
  }
  const orders = board.data.items
  const total = board.data.total
  return (
    <>
      <VisuallyHidden live role="status" aria-label="New orders">{heard?.news}</VisuallyHidden>
      <div ref={result} role="group" aria-label="Status change" tabIndex={-1}>
        {move.isError && <ErrorBanner message={`Could not change the status of ${move.variables.order.number}. Try again.`} />}
        {move.data &&
          (move.data.changedElsewhere ? (
            <StatusMessage tone="warning">
              {move.data.order.number} was changed by someone else first: it is now {statusLabel[move.data.order.status]}.
            </StatusMessage>
          ) : (
            <StatusMessage tone="success">
              {move.data.order.number} is now {statusLabel[move.data.order.status]}.
            </StatusMessage>
          ))}
      </div>
      {total > orders.length && <StatusMessage>Showing the newest {orders.length} of {total} active orders.</StatusMessage>}
      {orders.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No active orders" description="New orders show here within 10 seconds." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5 lg:gap-4">
          {activeStatuses.map((status) => {
            // The longest waiting first, by the time itself: core trims zeros, so the strings do not sort ("…00.5Z", "…00.25Z").
            const column = orders.filter((order) => order.status === status).sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt))
            return (
              <section key={status} aria-labelledby={`orders-${status}`} className="flex flex-col gap-3">
                <h2 id={`orders-${status}`} aria-label={`${statusLabel[status]}, ${column.length === 1 ? '1 order' : `${column.length} orders`}`} className="flex items-center gap-2 text-h3 text-ink">
                  {statusLabel[status]}
                  <Badge className="tabular-nums">{column.length}</Badge>
                </h2>
                {column.length === 0 ? (
                  <p className="text-small text-ink">No orders</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {column.map((order) => (
                      <li key={order.id}>
                        <OrderCard order={order} busy={move.isPending} saving={move.isPending && move.variables.order.id === order.id} onNext={() => advance(order)} onOpen={() => show(order)} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
      {open && <OrderSheet orderId={open} onClose={() => setOpen(undefined)} />}
      <Dialog open={confirm !== undefined} onClose={() => setConfirm(undefined)} title={confirm ? `Mark ${confirm.number} delivered?` : ''}>
        <p className="mt-2 text-body text-ink">This finishes the order. It cannot be taken back.</p>
        <DialogFooter onCancel={() => setConfirm(undefined)}>
          <Button
            onClick={() => {
              setConfirm(undefined)
              if (confirm) move.mutate({ order: confirm, status: 'delivered' })
            }}
          >
            Mark delivered
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
