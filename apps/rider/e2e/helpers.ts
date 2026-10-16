import AxeBuilder from '@axe-core/playwright'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

// Helpers for the rider suite. Node side only. Ordering tests use their own pick index (see design Decision 19).
export const koramangala = '00000000-0000-4000-8000-000000000401'
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

export async function fillCart(request: APIRequestContext, shopper: Shopper, pick: Pick): Promise<void> {
  const answer = await request.put('/api/core/v1/me/cart/items', {
    headers: shopper.headers,
    data: { storeId: koramangala, productId: pick.id, quantity: pick.units },
  })
  expect(answer.status()).toBe(200)
  expect(((await answer.json()) as { clamped: boolean }).clamped).toBe(false)
}

// Adds the shopper's default address in pincode 560034 (Koramangala). Returns its id.
export async function addAddress(request: APIRequestContext, shopper: Shopper): Promise<string> {
  const answer = await request.post('/api/core/v1/me/addresses', {
    headers: shopper.headers,
    data: { label: 'Home', line1: '12 80 Feet Rd, Koramangala', pincode: '560034', isDefault: true },
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

// Store staff (Koramangala), signed in through core's admin route. Memoised per worker: core allows 10 sign-ins per email per hour.
let staffSignIn: Promise<{ Authorization: string }> | undefined
export function staffHeaders(request: APIRequestContext): Promise<{ Authorization: string }> {
  staffSignIn ??= (async () => {
    const answer = await request.post('/api/core/v1/admin/auth/sign-in', {
      data: { email: 'koramangala@shopperstop.local', password: 'staff12345' },
    })
    expect(answer.status()).toBe(200)
    const { token } = (await answer.json()) as { token: string }
    return { Authorization: `Bearer ${token}` }
  })()
  return staffSignIn
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
