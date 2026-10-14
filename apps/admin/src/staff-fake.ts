import type { Staff } from './api'
import { admin, indiranagar, json, koramangala, storeList } from './fake-core'

type Handler = (request: Request) => Response | Promise<Response>

// Test-only. Three staff users in core's order (by email): the signed-in admin, an inactive and an active store-staff user.
export const indu: Staff = { id: '00000000-0000-4000-8000-000000000103', email: 'indiranagar@example.test', name: 'Indu Nair', role: 'store_staff', storeId: indiranagar.id, isActive: false }
export const kiran: Staff = { id: '00000000-0000-4000-8000-000000000102', email: 'koramangala@example.test', name: 'Kiran Rao', role: 'store_staff', storeId: koramangala.id, isActive: true }
export const createdId = '00000000-0000-4000-8000-000000000199'

// Core's staff routes with the rows kept: GET lists them by email, POST adds an active user, PATCH changes the name and
// the status. Names and emails come back trimmed and no answer carries a password, as in core. `hold()` makes the
// writes wait until `release()`.
export function staffCore(start: Staff[] = [admin, indu, kiran]) {
  let users = start
  let gate = Promise.resolve()
  let release = () => {}
  const routes: Record<string, Handler> = {
    'GET /admin/me': () => json(200, admin),
    'GET /admin/stores': () => storeList([indiranagar, koramangala]),
    'GET /admin/staff-users': () => {
      const items = [...users].sort((a, b) => (a.email < b.email ? -1 : 1))
      return json(200, { items, page: 1, pageSize: 100, total: items.length })
    },
    'POST /admin/staff-users': async (request) => {
      const body = (await request.clone().json()) as { name: string; email: string; role: Staff['role']; storeId?: string }
      await gate
      const created: Staff = { id: createdId, email: body.email.trim(), name: body.name.trim(), role: body.role, ...(body.storeId && { storeId: body.storeId }), isActive: true }
      users = [...users, created]
      return json(201, created)
    },
  }
  for (const { id } of start) {
    routes[`PATCH /admin/staff-users/${id}`] = async (request) => {
      const body = (await request.clone().json()) as { name?: string; isActive?: boolean }
      await gate
      const user = users.find((other) => other.id === id)!
      const saved = { ...user, ...(body.name !== undefined && { name: body.name.trim() }), ...(body.isActive !== undefined && { isActive: body.isActive }) }
      users = users.map((other) => (other.id === id ? saved : other))
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
