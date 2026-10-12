import { vi } from 'vitest'
import type { Staff } from './api'

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
