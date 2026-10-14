import AxeBuilder from '@axe-core/playwright'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

// Helpers for the specs that write: each test registers its own customer and fills its own cart. Node side only.
export const koramangala = '00000000-0000-4000-8000-000000000401'
export const tokenKey = 'shopperstop:customer-token'

export function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

export async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
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

// The demo customer, signed in through core: for the read-only tests only (globalSetup resets its orders before the run).
export async function demoShopper(request: APIRequestContext): Promise<Shopper> {
  const email = 'demo@shopperstop.local'
  const password = 'demo12345'
  const answer = await request.post('/api/core/v1/auth/sign-in', { data: { email, password } })
  expect(answer.status()).toBe(200)
  const { token } = (await answer.json()) as { token: string }
  return { email, password, token, headers: { Authorization: `Bearer ${token}` } }
}

export type Pick = { id: string; name: string; slug: string; priceCents: number; units: number }

// The n-th product of page 2 (101 to 148 by name) with stock of exactly 10 and a price of at least 20 rupees.
// Units are the fewest that reach the store's minimum. Each test owns one index, so no two share a product's stock.
export async function orderPick(request: APIRequestContext, n: number): Promise<Pick> {
  const listed = await request.get(`/api/core/v1/stores/${koramangala}/products?page=2&pageSize=100`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as {
    items: { id: string; name: string; slug: string; priceCents: number; inStock: boolean; quantity: number }[]
  }
  const detail = await request.get(`/api/core/v1/stores/${koramangala}`)
  expect(detail.status()).toBe(200)
  const { minOrderCents } = (await detail.json()) as { minOrderCents: number }
  const picks = items.filter((item) => item.inStock && item.quantity === 10 && item.priceCents >= 2000)
  const pick = picks[n]
  if (!pick) throw new Error(`no order pick ${n}: ${picks.length} qualify at Koramangala`)
  return {
    id: pick.id,
    name: pick.name,
    slug: pick.slug,
    priceCents: pick.priceCents,
    units: Math.ceil(minOrderCents / pick.priceCents),
  }
}

export async function fillCart(request: APIRequestContext, shopper: Shopper, pick: Pick): Promise<void> {
  const answer = await request.put('/api/core/v1/me/cart/items', {
    headers: shopper.headers,
    data: { storeId: koramangala, productId: pick.id, quantity: pick.units },
  })
  expect(answer.status()).toBe(200)
  expect(((await answer.json()) as { clamped: boolean }).clamped).toBe(false)
}

// Signs the browser in as the shopper before any page script runs.
export async function signedIn(page: Page, shopper: Shopper): Promise<void> {
  await page.addInitScript(([key, token]) => localStorage.setItem(key, token), [tokenKey, shopper.token])
}
