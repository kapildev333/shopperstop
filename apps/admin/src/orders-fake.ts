import { notifyManager, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { act, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import type { Order, OrderStatus } from './orders'
import { apiError, indiranagar, json } from './fake-core'

// Test-only: orders as core serves them to staff, and one store's order routes with core's status table.
export const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

// Order `n` (1 to 99) of Indiranagar unless `over` says otherwise: number SS-TEST000n, one Banana Robusta and three Pomegranate Bhagwa (4 items, ₹1,030), placed `n` minutes ago.
export function order(n: number, status: OrderStatus, over: Partial<Order> = {}): Order {
  return {
    id: `00000000-0000-4000-8000-0000000007${String(n).padStart(2, '0')}`,
    number: `SS-TEST${String(n).padStart(4, '0')}`,
    storeId: indiranagar.id,
    ...{ storeName: 'Indiranagar', promisedMinutes: 12 },
    status,
    customerName: 'Demo Customer',
    customerPhone: '+919800000000',
    address: { label: 'Home', line1: '12 80 Feet Rd, Koramangala', pincode: '560034' },
    subtotalCents: 103000,
    deliveryFeeCents: 0,
    totalCents: 103000,
    paymentMethod: 'cod',
    placedAt: minutesAgo(n),
    items: [
      { productId: '00000000-0000-4000-8000-000000000601', name: 'Banana Robusta', unitLabel: '1 kg', priceCents: 7000, mrpCents: 7000, quantity: 1 },
      { productId: '00000000-0000-4000-8000-000000000604', name: 'Pomegranate Bhagwa', unitLabel: '1 kg', priceCents: 32000, mrpCents: 32000, quantity: 3 },
    ],
    events: [{ toStatus: 'placed', actorType: 'customer', createdAt: minutesAgo(n) }],
    ...over,
  }
}

// services/core/internal/order/status.go
const moves: Partial<Record<OrderStatus, OrderStatus[]>> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['packing', 'cancelled'],
  packing: ['ready'],
  ready: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
}

type Part = 'lists' | 'order' | 'status'

// `orders` is what core holds, and a test may change it (another staff member acting, a customer placing an order).
// `posts` logs every status change asked for. `hold(part)` makes that part's answers wait until `release(part)`;
// `fail(part)` makes them 500 until `fail(part, false)`. Each order in `orders` when this is called gets its two routes.
export function ordersCore(storeId: string, orders: Order[]) {
  const posts: { id: string; body: unknown }[] = []
  const gates: Partial<Record<Part, { wait: Promise<void>; open: () => void }>> = {}
  const failing = new Set<Part>()
  const pass = async (part: Part) => {
    await gates[part]?.wait
    return failing.has(part) ? apiError(500, 'internal') : undefined
  }
  const routes: Record<string, (request: Request) => Promise<Response>> = {
    [`GET /admin/stores/${storeId}/orders`]: async (request) => {
      // Read first, answer later: a held answer carries the orders as they were when core was asked.
      const read = [...orders]
      const refused = await pass('lists')
      if (refused) return refused
      const query = new URL(request.url).searchParams
      const page = Number(query.get('page') ?? 1)
      const pageSize = Number(query.get('pageSize') ?? 24)
      // `active=true` keeps every order that is not delivered or cancelled, as core does.
      const active = query.get('active') === 'true'
      const match = read
        .filter((order) => (!query.get('status') || order.status === query.get('status')) && (!active || (order.status !== 'delivered' && order.status !== 'cancelled')))
        .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
      return json(200, { items: match.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: match.length })
    },
  }
  for (const { id } of orders) {
    const held = () => orders.find((order) => order.id === id)!
    routes[`GET /admin/orders/${id}`] = async () => (await pass('order')) ?? json(200, held())
    routes[`POST /admin/orders/${id}/status`] = async (request) => {
      const body = (await request.json()) as { status: OrderStatus; note?: string }
      posts.push({ id, body })
      const refused = await pass('status')
      if (refused) return refused
      const current = held()
      // services/core/internal/order: staff accept an online order only once it is paid.
      if (current.status === 'placed' && body.status === 'accepted' && current.paymentStatus === 'pending') return apiError(409, 'payment_pending', 'the order is awaiting payment')
      if (!moves[current.status]?.includes(body.status)) return apiError(409, 'conflict', `cannot move an order from ${current.status} to ${body.status}`)
      const now = new Date().toISOString()
      const moved: Order = {
        ...current,
        status: body.status,
        events: [...current.events, { fromStatus: current.status, toStatus: body.status, actorType: 'staff', ...(body.note ? { note: body.note } : {}), createdAt: now }],
        ...(body.status === 'delivered' ? { deliveredAt: now } : {}),
        ...(body.status === 'cancelled' ? { cancelledAt: now, ...(body.note ? { cancelReason: body.note } : {}) } : {}),
      }
      orders[orders.indexOf(current)] = moved
      return json(200, moved)
    }
  }
  return {
    posts,
    routes,
    hold(part: Part) {
      let open = () => {}
      gates[part] = { wait: new Promise<void>((resolve) => (open = resolve)), open }
    },
    release(part: Part) {
      gates[part]?.open()
      delete gates[part]
    },
    fail(part: Part, on = true) {
      if (on) failing.add(part)
      else failing.delete(part)
    },
  }
}

// Resolves once a refresh of `key` has failed with its data kept AND the page has been told. TanStack Query tells its
// observers one turn after the answer: without the second wait the assertions that follow would look at the page as it
// was before the failure, and pass whatever the page does with it.
export async function refreshFailed(router: { options: { context: { queryClient: QueryClient } } }, key: QueryKey) {
  const client = router.options.context.queryClient
  await waitFor(() => expect(client.getQueryState(key)).toMatchObject({ status: 'error', fetchStatus: 'idle' }))
  expect(client.getQueryData(key)).toBeDefined()
  await act(() => new Promise<void>((told) => notifyManager.schedule(told)))
}

// The status and page size of every order list request, in the order core got them.
export function listRequests(calls: Request[]) {
  return calls.filter((call) => call.method === 'GET' && new URL(call.url).pathname.endsWith('/orders')).map((call) => Object.fromEntries(new URL(call.url).searchParams))
}
