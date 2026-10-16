import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Badge, Button, Card, Dialog, DialogFooter, EmptyState, ErrorBanner, PageHeader, Price, Skeleton, StatusMessage, buttonClass } from '@shopperstop/ui'
import { useSince } from '@shopperstop/ui/app'
import { deliveryQuery, rider, type ApiError, type Delivery, type ReadyOrder } from './api'
import { itemCount } from './format'

const readyKey = ['rider', 'ready'] as const
const assignedKey = ['rider', 'deliveries', 'assigned'] as const

// The ready list is read every 10 seconds while the page is open (design Decision 6).
const readyQuery = {
  queryKey: readyKey,
  queryFn: async (): Promise<ReadyOrder[]> => {
    const { data, error } = await rider.GET('/me/ready-orders')
    if (error) throw error.error
    return data.items
  },
  refetchInterval: 10_000,
}

const assignedQuery = {
  queryKey: assignedKey,
  queryFn: async (): Promise<Delivery[]> => {
    const { data, error } = await rider.GET('/me/deliveries', { params: { query: { status: 'assigned' } } })
    if (error) throw error.error
    return data.items
  },
}

// `useSince` re-renders this card each minute; the page does not re-render.
function ReadyCard({ order, onPick }: { order: ReadyOrder; onPick: () => void }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-h3 tabular-nums text-ink">{order.number}</span>
        <time dateTime={order.placedAt} className="text-small text-ink-muted">
          {useSince(order.placedAt)}
        </time>
      </div>
      <div className="flex flex-wrap gap-x-3 text-small text-ink">
        <span>{itemCount(order.itemCount)}</span>
        <span>
          Pincode <span className="tabular-nums">{order.pincode}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Price cents={order.totalCents} className="text-h3" />
        {order.paymentMethod === 'cod' && <Badge>Cash</Badge>}
      </div>
      <Button size="lg" className="w-full" aria-label={`Pick up ${order.number}`} onClick={onPick}>
        Pick up
      </Button>
    </Card>
  )
}

export function ReadyPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const ready = useQuery(readyQuery)
  const assigned = useQuery(assignedQuery)
  const [picking, setPicking] = useState<ReadyOrder>()
  const [taken, setTaken] = useState<string>()

  const claim = useMutation({
    mutationFn: async (order: ReadyOrder) => {
      const { data, error } = await rider.POST('/me/deliveries', { body: { orderId: order.orderId } })
      if (error) throw error.error
      return data
    },
    onSuccess: async (delivery) => {
      queryClient.setQueryData(deliveryQuery(delivery.id).queryKey, delivery)
      void queryClient.invalidateQueries({ queryKey: readyKey })
      void queryClient.invalidateQueries({ queryKey: assignedKey })
      await navigate({ to: '/deliveries/$deliveryId', params: { deliveryId: delivery.id } })
    },
    // Someone else has the order, or it left ready: close, say so, and read the list again. Any other failure keeps the dialog.
    onError: (error, order) => {
      const code = (error as Partial<ApiError>).code
      if (code !== 'conflict' && code !== 'not_found') return
      setPicking(undefined)
      setTaken(order.number)
      void queryClient.invalidateQueries({ queryKey: readyKey })
    },
  })

  function pick(order: ReadyOrder) {
    setTaken(undefined)
    claim.reset()
    setPicking(order)
  }

  // A pick up in flight keeps its dialog: the answer then belongs to the order the rider confirmed.
  function closePick() {
    if (!claim.isPending) setPicking(undefined)
  }

  const assignedItems = assigned.data ?? []
  const readyOrders = ready.data

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Ready to pick up" />
      {assignedItems.length > 0 && (
        <section aria-labelledby="assigned-heading" className="flex flex-col gap-3">
          <h2 id="assigned-heading" className="text-h2 text-ink">
            Your deliveries
          </h2>
          {assignedItems.map((delivery) => (
            <Card key={delivery.id} className="p-2">
              <Link
                to="/deliveries/$deliveryId"
                params={{ deliveryId: delivery.id }}
                className={buttonClass({ variant: 'secondary', size: 'lg' }) + ' w-full'}
              >
                {delivery.orderNumber} {delivery.customerName}
              </Link>
            </Card>
          ))}
        </section>
      )}
      {taken && <StatusMessage tone="warning">{taken} was taken by another rider or is no longer ready.</StatusMessage>}
      {readyOrders === undefined ? (
        ready.isError ? (
          <ErrorBanner message="Could not load ready orders." onRetry={() => void ready.refetch()} />
        ) : (
          <Skeleton variant="list" count={3} />
        )
      ) : (
        <>
          <ul aria-label="Ready orders" aria-live="polite" className="flex flex-col gap-3">
            {readyOrders.map((order) => (
              <li key={order.orderId}>
                <ReadyCard order={order} onPick={() => pick(order)} />
              </li>
            ))}
          </ul>
          {readyOrders.length === 0 && (
            <Card className="p-6">
              <EmptyState title="No orders ready" description="New orders show here as the store packs them." />
            </Card>
          )}
        </>
      )}
      <Dialog open={picking !== undefined} onClose={closePick} title={picking ? `Pick up ${picking.number}?` : ''}>
        {claim.isError && <ErrorBanner message="Could not pick up the order. Try again." className="mt-4" />}
        <DialogFooter onCancel={closePick}>
          <Button loading={claim.isPending} onClick={() => picking && claim.mutate(picking)}>
            Pick up
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
