import { vi } from 'vitest'
import type { components } from '@shopperstop/ui/api'
import type { Staff } from './api'

type AdminStore = components['schemas']['AdminStore']
type CategoryNode = components['schemas']['CategoryNode']
type Product = components['schemas']['Product']

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

export const fruits: CategoryNode = {
  id: '00000000-0000-4000-8000-000000000501',
  name: 'Fruits & Vegetables',
  slug: 'fruits-vegetables',
  sortOrder: 10,
  imageUrl: '/api/core/v1/files/categories/seed-fruits-vegetables.png',
  children: [{ id: '00000000-0000-4000-8000-000000000521', name: 'Fresh Fruits', slug: 'fresh-fruits', parentId: '00000000-0000-4000-8000-000000000501', sortOrder: 10 }],
}
export const dairy: CategoryNode = {
  id: '00000000-0000-4000-8000-000000000502',
  name: 'Dairy, Bread & Eggs',
  slug: 'dairy-bread-eggs',
  sortOrder: 20,
  children: [{ id: '00000000-0000-4000-8000-000000000525', name: 'Milk', slug: 'milk', parentId: '00000000-0000-4000-8000-000000000502', sortOrder: 10 }],
}

export function categoryTree(items: CategoryNode[]) {
  return json(200, { items })
}

export const banana: Product = {
  id: '00000000-0000-4000-8000-000000000601',
  name: 'Banana Robusta',
  slug: 'banana-robusta',
  unitLabel: '1 kg',
  mrpCents: 7000,
  priceCents: 7000,
  categoryId: '00000000-0000-4000-8000-000000000521',
  isActive: false,
  imageUrl: '/api/core/v1/files/products/seed-fruits-vegetables.png',
}
export const tonedMilk: Product = {
  id: '00000000-0000-4000-8000-000000000612',
  name: 'Sunny Fields Toned Milk',
  slug: 'sunny-fields-toned-milk',
  brand: 'Sunny Fields',
  unitLabel: '500 ml',
  mrpCents: 3000,
  priceCents: 2799,
  categoryId: '00000000-0000-4000-8000-000000000525',
  isActive: true,
}

export function productList(items: Product[], total = items.length, page = 1) {
  return json(200, { items, page, pageSize: 24, total })
}
