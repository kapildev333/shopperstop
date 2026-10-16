import AxeBuilder from '@axe-core/playwright'
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'

// Helpers two or more mobile e2e specs use, against core on 18080 and the web export at 390×844. The product picks come from
// global-setup.ts through SHOPPERSTOP_MOBILE_E2E_PICKS: read once per run, so an order one spec places cannot shift another's pick.
export const core = 'http://localhost:18080/api/core/v1'
// The customer token lives in localStorage on the web export (session.ts uses the same key as the secure store).
export const tokenKey = 'shopperstop.customer-token'
export const pincodeKey = 'shopperstop:pincode'
export const guestCartKey = 'shopperstop:cart'
export const koramangala = '00000000-0000-4000-8000-000000000401'
export const indiranagar = '00000000-0000-4000-8000-000000000402'
export const admin = { email: 'admin@shopperstop.local', password: 'admin12345' }

export type Shopper = { token: string; headers: { Authorization: string }; email: string; password: string }
export type Pick = { id: string; name: string; priceCents: number; unitLabel: string; units: number }
type Product = { id: string; name: string; priceCents: number; unitLabel: string; inStock: boolean; quantity: number }
type Picks = { minOrderCents: number; page2: Product[]; home: Record<string, Product[]> }

export function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

export async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

export async function freshShopper(request: APIRequestContext, name: string): Promise<Shopper> {
  const email = freshEmail()
  const password = 'password123'
  const registered = await request.post(`${core}/auth/register`, { data: { name, email, password } })
  expect(registered.status()).toBe(201)
  const { token } = (await registered.json()) as { token: string }
  return { token, headers: { Authorization: `Bearer ${token}` }, email, password }
}

// What global setup read after the reseed; a run without it fails here, naming the variable.
function handedOver(): Picks {
  const raw = process.env.SHOPPERSTOP_MOBILE_E2E_PICKS
  if (!raw) throw new Error('global setup did not hand over the picks: SHOPPERSTOP_MOBILE_E2E_PICKS is unset')
  return JSON.parse(raw) as Picks
}

// The n-th product of page 2 with stock of exactly 10 and a price of at least 20 rupees; units are the fewest that reach the minimum.
// Indices 0 and 1 are orders.spec's, 2 to 5 are checkout.spec's, 6 and 7 are flow.spec's (each test its own product).
export function orderPick(n: number): Pick {
  const { minOrderCents, page2 } = handedOver()
  const picks = page2.filter((item) => item.inStock && item.quantity === 10 && item.priceCents >= 2000)
  const pick = picks[n]
  if (!pick) throw new Error(`no order pick ${n}: ${picks.length} qualify at Koramangala`)
  return { id: pick.id, name: pick.name, priceCents: pick.priceCents, unitLabel: pick.unitLabel, units: Math.ceil(minOrderCents / pick.priceCents) }
}

// Products Home shows (the first 12 in stock of core's first page) with a stock of at least `minimum` at the store.
// The demo stock is low, so tests that need a count above 1 pick by stock.
export function homePicks(minimum: number, storeId = koramangala): string[] {
  const items = handedOver().home[storeId]
  if (!items) throw new Error(`no home picks read for store ${storeId}`)
  return items
    .filter((item) => item.inStock)
    .slice(0, 12)
    .filter((item) => item.quantity >= minimum)
    .map((item) => item.name)
}

export async function fillCart(request: APIRequestContext, shopper: Shopper, pick: Pick): Promise<void> {
  const answer = await request.put(`${core}/me/cart/items`, {
    headers: shopper.headers,
    data: { storeId: koramangala, productId: pick.id, quantity: pick.units },
  })
  expect(answer.status()).toBe(200)
  expect(((await answer.json()) as { clamped: boolean }).clamped).toBe(false)
}

export async function addAddress(request: APIRequestContext, shopper: Shopper, label = 'Home', pincode = '560034'): Promise<void> {
  const answer = await request.post(`${core}/me/addresses`, {
    headers: shopper.headers,
    data: { label, line1: '12 80 Feet Rd, Koramangala', pincode, isDefault: true },
  })
  expect(answer.status()).toBe(201)
}

// Signs the browser in before any page script runs: the token goes where the app's session reads it.
// The pincode is preset so the first-visit pincode sheet does not cover the tab bar (Koramangala's 560034 by default).
export async function signedIn(page: Page, shopper: Shopper, pincode = '560034') {
  await page.addInitScript(
    ([key, token, pincodeStorage, chosen]) => {
      localStorage.setItem(key, token)
      localStorage.setItem(pincodeStorage, chosen)
    },
    [tokenKey, shopper.token, pincodeKey, pincode],
  )
}

// A guest with the pincode chosen: the cart lives in local storage only.
export async function guest(page: Page, pincode = '560034') {
  await page.addInitScript(
    ([key, chosen]) => localStorage.setItem(key, chosen),
    [pincodeKey, pincode],
  )
}

// The seeded Koramangala store staff, for the status moves and the stock changes that the orders and flow suites make.
export async function staffHeaders(request: APIRequestContext): Promise<{ Authorization: string }> {
  const answer = await request.post(`${core}/admin/auth/sign-in`, {
    data: { email: 'koramangala@shopperstop.local', password: 'staff12345' },
  })
  expect(answer.status()).toBe(200)
  const { token } = (await answer.json()) as { token: string }
  return { Authorization: `Bearer ${token}` }
}

// The seeded admin, for the stock changes and the stores the cart and checkout suites set up.
export async function adminHeaders(request: APIRequestContext): Promise<{ Authorization: string }> {
  const answer = await request.post(`${core}/admin/auth/sign-in`, { data: admin })
  expect(answer.status()).toBe(200)
  const { token } = (await answer.json()) as { token: string }
  return { Authorization: `Bearer ${token}` }
}

// The cart core holds for a token: its store id and its lines.
export async function serverCart(request: APIRequestContext, token: string) {
  const cart = await (await request.get(`${core}/me/cart`, { headers: { Authorization: `Bearer ${token}` } })).json()
  return cart as { storeId?: string; items: { product: { name: string }; quantity: number }[] }
}

export function pincodeSheet(page: Page) {
  return page.getByRole('dialog', { name: 'Where should we deliver?' })
}

// The sheet's field and Continue; the sheet's dialog is waited for first (its slide ends before the field takes input).
export async function savePincode(page: Page, pincode: string) {
  await expect(pincodeSheet(page)).toBeVisible()
  await pincodeSheet(page).getByLabel('Pincode', { exact: true }).fill(pincode)
  await pincodeSheet(page).getByRole('button', { name: 'Continue', exact: true }).click()
}

// The section's heading and the links, buttons and groups inside it (the section is the heading's parent view).
export function section(page: Page, heading: string): Locator {
  return page.getByRole('heading', { level: 2, name: heading, exact: true }).locator('xpath=..')
}

export function quantityOf(page: Page, name: string): Locator {
  return page.getByRole('group', { name: `Quantity of ${name}`, exact: true })
}

// The cart bar's count, e.g. "1" for "View cart, 1 item".
export function cartBar(page: Page, count: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^View cart, ${count} item`) })
}

export function cartSheet(page: Page): Locator {
  return page.getByRole('dialog', { name: 'My cart', exact: true })
}

// From Home's search control; the search screen's own box takes over after that.
export async function openSearch(page: Page) {
  await page.getByRole('button', { name: 'Search products', exact: true }).click()
  await expect(page).toHaveURL(/\/search$/)
}

export async function searchFor(page: Page, text: string) {
  const box = page.getByRole('textbox', { name: 'Search products', exact: true })
  await box.fill(text)
  await box.press('Enter')
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(text)
}
