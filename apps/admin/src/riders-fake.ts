import type { Rider } from './api'
import { apiError, indiranagar, json, koramangala } from './fake-core'

type Handler = (request: Request) => Response | Promise<Response>

// Test-only. The rider service's staff routes at the process boundary, keyed under /api/rider/v1 (fakeCore strips only
// core's prefix). Riders are kept and listed by email; `store` filters; POST adds an active rider; PATCH changes the
// name, the phone ("" removes it) and the status. `hold()` makes the writes wait until `release()`.
export const arjun: Rider = { id: '00000000-0000-4000-8000-000000000801', storeId: koramangala.id, email: 'arjun@example.test', name: 'Arjun Rao', phone: '+919000000001', isActive: true, ...{ isOnline: false } }
export const kabir: Rider = { id: '00000000-0000-4000-8000-000000000803', storeId: indiranagar.id, email: 'kabir@example.test', name: 'Kabir Shah', isActive: false, ...{ isOnline: false } }
export const createdRiderId = '00000000-0000-4000-8000-000000000899'
const base = '/api/rider/v1'
// The key of an order's dispatch read (`GET /admin/orders/{orderId}/dispatch`), for a test's own answers.
export const dispatchRoute = (orderId: string) => `GET ${base}/admin/orders/${orderId}/dispatch`

export function riderService(start: Rider[] = [arjun, kabir]) {
  let riders = start
  let gate = Promise.resolve()
  let release = () => {}
  const routes: Record<string, Handler> = {
    [`GET ${base}/admin/riders`]: (request) => {
      const store = new URL(request.url).searchParams.get('store')
      const items = riders.filter((rider) => !store || rider.storeId === store).sort((a, b) => (a.email < b.email ? -1 : 1))
      return json(200, { items, page: 1, pageSize: 100, total: items.length })
    },
    [`POST ${base}/admin/riders`]: async (request) => {
      const body = (await request.clone().json()) as { storeId: string; email: string; name: string; phone?: string }
      await gate
      if (riders.some((rider) => rider.email === body.email)) return apiError(409, 'conflict', 'email taken', 'email')
      const created: Rider = { id: createdRiderId, storeId: body.storeId, email: body.email, name: body.name, ...(body.phone && { phone: body.phone }), isActive: true, ...{ isOnline: false } }
      riders = [...riders, created]
      return json(201, created)
    },
  }
  for (const { id } of start) {
    routes[`PATCH ${base}/admin/riders/${id}`] = async (request) => {
      const body = (await request.clone().json()) as { name?: string; phone?: string; isActive?: boolean }
      await gate
      const { phone, ...rest } = riders.find((other) => other.id === id)!
      const saved: Rider = {
        ...rest,
        ...(body.phone === undefined ? (phone ? { phone } : {}) : body.phone ? { phone: body.phone } : {}),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      }
      riders = riders.map((other) => (other.id === id ? saved : other))
      return json(200, saved)
    }
  }
  return {
    routes,
    hold: () => {
      gate = new Promise<void>((resolve) => (release = resolve))
    },
    release: () => release(),
  }
}
