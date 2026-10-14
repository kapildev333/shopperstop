import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Card, EmptyState, ErrorBanner, Price, Skeleton } from '@shopperstop/ui'
import { activeStatuses, boardQuery, itemCount, statusLabel, useSince, type Order } from './orders'

// Its own component, so a minute passing renders this text and nothing else on the board.
function Since({ at }: { at: string }) {
  return (
    <time dateTime={at} className="text-small text-ink-muted">
      {useSince(at)}
    </time>
  )
}

function OrderCard({ order }: { order: Order }) {
  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink tabular-nums">{order.number}</span>
        <Since at={order.placedAt} />
      </div>
      <p className="text-small text-ink">
        {itemCount(order)}, pincode <span className="tabular-nums">{order.address.pincode}</span>
      </p>
      <Price cents={order.totalCents} />
    </Card>
  )
}

// One store's board. The route gives it `key={storeId}`, so nothing kept here outlives a change of store.
export function OrderBoard({ storeId }: { storeId: string }) {
  const board = useQuery(boardQuery(storeId))
  // What the last answer announced, and that answer. A failed poll brings no new answer, and an equal answer is the
  // same object (structural sharing), so neither announces anything; a changed answer with nothing new empties the region.
  const [heard, setHeard] = useState<{ from: Order[]; news: string }>()
  if (board.data && heard?.from !== board.data) {
    const known = new Set(heard?.from.map((order) => order.id))
    // The first answer is what the store already had: nothing in it is new.
    const fresh = heard ? board.data.filter((order) => order.status === 'placed' && !known.has(order.id)) : []
    const numbers = fresh.map((order) => order.number).join(', ')
    setHeard({ from: board.data, news: fresh.length === 0 ? '' : fresh.length === 1 ? `New order ${numbers}` : `${fresh.length} new orders: ${numbers}` })
  }

  // A poll that fails keeps the board: the alert is only for a board with nothing to show. (The app's root says that a
  // refresh failed, once for the whole page.)
  if (board.data === undefined) {
    return board.isError ? <ErrorBanner message="Could not load the orders." onRetry={() => void board.refetch()} /> : <Skeleton variant="list" count={5} />
  }
  const orders = board.data
  return (
    <>
      <p role="status" aria-label="New orders" className="sr-only">{heard?.news}</p>
      {orders.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No active orders" description="New orders show here within 10 seconds." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5 lg:gap-4">
          {activeStatuses.map((status) => {
            // The longest waiting first.
            const column = orders.filter((order) => order.status === status).sort((a, b) => a.placedAt.localeCompare(b.placedAt))
            return (
              <section key={status} aria-labelledby={`orders-${status}`} className="flex flex-col gap-3">
                <h2 id={`orders-${status}`} className="flex items-center gap-2 text-h3 text-ink">
                  {statusLabel[status]}
                  <Badge className="tabular-nums">{column.length}</Badge>
                </h2>
                {column.length === 0 ? (
                  <p className="text-small text-ink">No orders</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {column.map((order) => (
                      <li key={order.id}>
                        <OrderCard order={order} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
