import { vi } from 'vitest'
import type { components } from '@shopperstop/ui/api'
import type { Staff } from './api'

type AdminStore = components['schemas']['AdminStore']

type Handler = (request: Request) => Response | Promise<Response>

export const admin: Staff = { id: '00000000-0000-4000-8000-000000000001', email: 'admin@example.test', name: 'Asha Admin', role: 'admin', isActive: true }
export const storeStaff: Staff = { id: '00000000-0000-4000-8000-000000000002', email: 'staff@example.test', name: 'Sam Staff', role: 'store_staff', storeId: '00000000-0000-4000-8000-0000000000aa', isActive: true }

export function json(status: number, body?: unknown) {
  return body === undefined ? new Response(null, { status }) : Response.json(body, { status })
}

export function apiError(status: number, code: string, message = code, field?: string) {
  return json(status, { error: { code, message, ...(field ? { field } : {}) } })
}

// Fake core at the process boundary: keys are "METHOD /path" under /api/core/v1; unknown routes answer 404 not_found.
export function fakeCore(routes: Record<string, Handler>) {
  const calls: Request[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    calls.push(request)
    const path = new URL(request.url).pathname.replace('/api/core/v1', '')
    const handler = routes[`${request.method} ${path}`]
    return handler ? handler(request) : apiError(404, 'not_found')
  })
  return calls
}

export const koramangala: AdminStore = {
  id: '00000000-0000-4000-8000-000000000401',
  name: 'Koramangala',
  addressLine: '80 Feet Rd, Koramangala',
  pincode: '560034',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}
export const indiranagar: AdminStore = {
  ...koramangala,
  id: '00000000-0000-4000-8000-000000000402',
  name: 'Indiranagar',
  addressLine: '100 Feet Rd, Indiranagar',
  pincode: '560038',
  isOpen: false,
  promisedMinutes: 12,
}

export function storeList(items: AdminStore[]) {
  return json(200, { items, page: 1, pageSize: 100, total: items.length })
}
