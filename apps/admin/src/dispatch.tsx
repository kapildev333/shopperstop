import { queryOptions, useQuery } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api/rider'
import { api, riderApi } from './api'
import { pollMs, type Order } from './orders'

type OrderDispatch = components['schemas']['OrderDispatch']

// ['rider', 'dispatch', orderId]: the card and the sheet share one read, asked again with the board's poll.
// ponytail: one read per ready order per poll; ask the rider service for a per-store read if stores hold many ready orders.
export const dispatchQuery = (orderId: string) =>
  queryOptions({
    queryKey: ['rider', 'dispatch', orderId],
    queryFn: async () => {
      const { data, error } = await riderApi.GET('/admin/orders/{orderId}/dispatch', { params: { path: { orderId } } })
      if (error) throw error.error
      return data
    },
    refetchInterval: pollMs,
  })

// The store as customers see it (both staff roles may read it): only its `location` is used, to say why dispatch is off.
const storeQuery = (storeId: string) =>
  queryOptions({
    queryKey: ['stores', storeId],
    queryFn: async () => {
      const { data, error } = await api.GET('/stores/{id}', { params: { path: { id: storeId } } })
      if (error) throw error.error
      return data
    },
  })

// D57's line: the open offer first, then why there is none. `located` is false only for a loaded store without a location.
export function dispatchText({ online, dispatch, offers }: OrderDispatch, located: boolean) {
  const open = offers.find((offer) => offer.status === 'offered')
  if (open) return `Offered to ${open.riderName}, ${Math.ceil(open.etaSeconds / 60)} min away`
  if (dispatch === 'off') return located ? 'Dispatch off' : 'Dispatch off: store has no location'
  return online === 0 ? 'No rider online' : 'Waiting for a rider'
}

// While the order is ready: one line from the rider service, none until it answers or when it cannot be read.
// The store is read only when dispatch is off (its location says why); until it answers the line is "Dispatch off".
export function DispatchLine({ order, className }: { order: Order; className?: string }) {
  const ready = order.status === 'ready'
  const { data } = useQuery({ ...dispatchQuery(order.id), enabled: ready })
  const store = useQuery({ ...storeQuery(order.storeId), enabled: ready && data?.dispatch === 'off' })
  const located = store.data === undefined || store.data.location !== undefined
  return ready && data ? <p className={className}>{dispatchText(data, located)}</p> : null
}
