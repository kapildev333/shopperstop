import AxeBuilder from '@axe-core/playwright'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

// Helpers for the rider suite. Node side only. Ordering tests use their own pick index (see design Decision 19).
export const koramangala = '00000000-0000-4000-8000-000000000401'
export const indiranagar = '00000000-0000-4000-8000-000000000402'
export const riderTokenKey = 'shopperstop:rider-token'
export const customerTokenKey = 'shopperstop:customer-token'

export async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

export function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

export type Shopper = { email: string; password: string; token: string; headers: { Authorization: string } }

export async function freshShopper(request: APIRequestContext, name: string): Promise<Shopper> {
  const email = freshEmail()
  const password = 'password123'
  const registered = await request.post('/api/core/v1/auth/register', { data: { name, email, password } })
  expect(registered.status()).toBe(201)
  const { token } = (await registered.json()) as { token: string }
  return { email, password, token, headers: { Authorization: `Bearer ${token}` } }
}

export type Pick = { id: string; name: string; priceCents: number; units: number }

// The n-th product of page 2 (101 to 148 by name) with stock of exactly 10 and a price of at least 20 rupees (copied from web's e2e/shopper.ts).
export async function orderPick(request: APIRequestContext, n: number): Promise<Pick> {
  const listed = await request.get(`/api/core/v1/stores/${koramangala}/products?page=2&pageSize=100`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as {
    items: { id: string; name: string; priceCents: number; inStock: boolean; quantity: number }[]
  }
  const detail = await request.get(`/api/core/v1/stores/${koramangala}`)
  expect(detail.status()).toBe(200)
  const { minOrderCents } = (await detail.json()) as { minOrderCents: number }
  const picks = items.filter((item) => item.inStock && item.quantity === 10 && item.priceCents >= 2000)
  const pick = picks[n]
  if (!pick) throw new Error(`no order pick ${n}: ${picks.length} qualify at Koramangala`)
  return { id: pick.id, name: pick.name, priceCents: pick.priceCents, units: Math.ceil(minOrderCents / pick.priceCents) }
}

// The first in-stock product of the store at or above 20 rupees that covers its minimum order; for specs that make no stock assertion.
export async function storePick(request: APIRequestContext, storeId: string): Promise<Pick> {
  const listed = await request.get(`/api/core/v1/stores/${storeId}/products?pageSize=100`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as {
    items: { id: string; name: string; priceCents: number; inStock: boolean; quantity: number }[]
  }
  const detail = await request.get(`/api/core/v1/stores/${storeId}`)
  expect(detail.status()).toBe(200)
  const { minOrderCents } = (await detail.json()) as { minOrderCents: number }
  const pick = items.find(
    (item) => item.inStock && item.priceCents >= 2000 && item.quantity >= Math.ceil(minOrderCents / item.priceCents),
  )
  if (!pick) throw new Error(`no in-stock pick covers the minimum order at store ${storeId}`)
  return { id: pick.id, name: pick.name, priceCents: pick.priceCents, units: Math.ceil(minOrderCents / pick.priceCents) }
}

export async function fillCart(request: APIRequestContext, shopper: Shopper, pick: Pick, storeId = koramangala): Promise<void> {
  const answer = await request.put('/api/core/v1/me/cart/items', {
    headers: shopper.headers,
    data: { storeId, productId: pick.id, quantity: pick.units },
  })
  expect(answer.status()).toBe(200)
  expect(((await answer.json()) as { clamped: boolean }).clamped).toBe(false)
}

// Adds the shopper's default address (Koramangala's pincode 560034 unless told otherwise). Returns its id.
export async function addAddress(
  request: APIRequestContext,
  shopper: Shopper,
  pincode = '560034',
  line1 = '12 80 Feet Rd, Koramangala',
): Promise<string> {
  const answer = await request.post('/api/core/v1/me/addresses', {
    headers: shopper.headers,
    data: { label: 'Home', line1, pincode, isDefault: true },
  })
  expect(answer.status()).toBe(201)
  return ((await answer.json()) as { id: string }).id
}

export async function placeByApi(request: APIRequestContext, shopper: Shopper, addressId: string): Promise<{ id: string; number: string }> {
  const answer = await request.post('/api/core/v1/orders', { headers: shopper.headers, data: { addressId } })
  expect(answer.status()).toBe(201)
  const { id, number } = (await answer.json()) as { id: string; number: string }
  return { id, number }
}

// Store staff (Koramangala by default), signed in through core's admin route. Memoised per email per worker: core allows 10 sign-ins per email per hour.
const staffSignIns = new Map<string, Promise<{ Authorization: string }>>()
export function staffHeaders(request: APIRequestContext, email = 'koramangala@shopperstop.local'): Promise<{ Authorization: string }> {
  let headers = staffSignIns.get(email)
  if (!headers) {
    headers = (async () => {
      const answer = await request.post('/api/core/v1/admin/auth/sign-in', { data: { email, password: 'staff12345' } })
      expect(answer.status()).toBe(200)
      const { token } = (await answer.json()) as { token: string }
      return { Authorization: `Bearer ${token}` }
    })()
    staffSignIns.set(email, headers)
  }
  return headers
}

// A ready order at Koramangala: a fresh shopper places it through core and the store staff move it to ready, as core's API answers.
export async function readyOrder(
  request: APIRequestContext,
  staff: { Authorization: string },
  n: number,
): Promise<{ shopper: Shopper; id: string; number: string }> {
  const shopper = await freshShopper(request, 'E2E Rider Customer')
  const addressId = await addAddress(request, shopper)
  const pick = await orderPick(request, n)
  await fillCart(request, shopper, pick)
  const placed = await placeByApi(request, shopper, addressId)
  for (const status of ['accepted', 'packing', 'ready']) {
    const answer = await request.post(`/api/core/v1/admin/orders/${placed.id}/status`, { headers: staff, data: { status } })
    expect(answer.status()).toBe(200)
  }
  return { shopper, id: placed.id, number: placed.number }
}

// A rider's token from the rider service's sign-in, memoised per worker (10 sign-ins per email per hour).
const riderSignIns = new Map<string, Promise<string>>()
export function riderToken(request: APIRequestContext, email: string, password: string): Promise<string> {
  let token = riderSignIns.get(email)
  if (!token) {
    token = (async () => {
      const answer = await request.post('/api/rider/v1/auth/sign-in', { data: { email, password } })
      expect(answer.status()).toBe(200)
      return ((await answer.json()) as { token: string }).token
    })()
    riderSignIns.set(email, token)
  }
  return token
}

// Signs the browser in as the rider before any page script runs.
export async function asRider(page: Page, token: string): Promise<void> {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [riderTokenKey, token])
}

// Signs the browser in as the shopper on the customer site, before any page script runs.
export async function asShopper(page: Page, shopper: Shopper): Promise<void> {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [customerTokenKey, shopper.token])
}

// The customer's read of the delivery, through the rider service with the customer's core token.
export async function customerDelivery(request: APIRequestContext, shopper: Shopper, orderId: string) {
  const answer = await request.get(`/api/rider/v1/orders/${orderId}/delivery`, { headers: shopper.headers })
  expect(answer.status()).toBe(200)
  return (await answer.json()) as { riderName: string; status: string; location?: { lat: number; lng: number } }
}

// The customer's order as core answers it.
export async function coreOrder(request: APIRequestContext, shopper: Shopper, orderId: string) {
  const answer = await request.get(`/api/core/v1/orders/${orderId}`, { headers: shopper.headers })
  expect(answer.status()).toBe(200)
  return (await answer.json()) as { status: string; riderName?: string }
}
