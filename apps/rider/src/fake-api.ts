import { vi } from 'vitest'
import type { components as core } from '@shopperstop/ui/api'
import type { components } from '@shopperstop/ui/api/rider'

type Rider = components['schemas']['Rider']
type ReadyOrder = components['schemas']['ReadyOrder']
type Delivery = components['schemas']['Delivery']
type Store = core['schemas']['Store']

type Handler = (request: Request) => Response | Promise<Response>

export const arjun: Rider = {
  id: '00000000-0000-4000-8000-000000000801',
  storeId: '00000000-0000-4000-8000-000000000401',
  email: 'arjun@example.test',
  name: 'Arjun Rao',
  isActive: true,
}

export const koramangala: Store = {
  id: '00000000-0000-4000-8000-000000000401',
  name: 'Koramangala',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}

export function readyOrder(n: number, over: Partial<ReadyOrder> = {}): ReadyOrder {
  return {
    orderId: `00000000-0000-4000-8000-000000000a0${n}`,
    number: `SS-AAAA000${n}`,
    placedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    itemCount: 3,
    totalCents: 33900,
    paymentMethod: 'cod',
    pincode: '560034',
    customerName: 'Ravi Kumar',
    ...over,
  }
}

export function delivery(over: Partial<Delivery> = {}): Delivery {
  return {
    id: '00000000-0000-4000-8000-000000000901',
    orderId: '00000000-0000-4000-8000-000000000a01',
    orderNumber: 'SS-AAAA0001',
    storeId: koramangala.id,
    status: 'assigned',
    customerName: 'Ravi Kumar',
    customerPhone: '+919800000001',
    address: { line1: '12 80 Feet Rd', line2: 'Flat 4', pincode: '560034' },
    totalCents: 33900,
    paymentMethod: 'cod',
    itemCount: 2,
    items: [{ name: 'Banana Robusta', unitLabel: '1 kg', quantity: 2 }],
    assignedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    ...over,
  }
}

export function json(status: number, body?: unknown) {
  return body === undefined ? new Response(null, { status }) : Response.json(body, { status })
}

export function apiError(status: number, code: string, message = code, field?: string) {
  return json(status, { error: { code, message, ...(field ? { field } : {}) } })
}

// The routes every signed-in page reads first: the rider and the store's name.
export function signedInRoutes(): Record<string, Handler> {
  return {
    'GET /api/rider/v1/me': () => json(200, arjun),
    [`GET /api/core/v1/stores/${koramangala.id}`]: () => json(200, koramangala),
  }
}

// Fake services at the process boundary: keys are "METHOD /api/<service>/v1/<path>" (pathname only); unknown routes answer 404 not_found.
export function fakeApi(routes: Record<string, Handler>) {
  const calls: Request[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    calls.push(request)
    const handler = routes[`${request.method} ${new URL(request.url).pathname}`]
    return handler ? handler(request) : apiError(404, 'not_found')
  })
  return calls
}
