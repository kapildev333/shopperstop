import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// The order screens on the web export at 390×844, against core on 18080 (helpers inline: the web suite's shopper.ts is not shared).
const core = 'http://localhost:18080/api/core/v1'
const tokenKey = 'shopperstop.customer-token'
const koramangala = '00000000-0000-4000-8000-000000000401'
const delivered = '00000000-0000-4000-8000-000000000701'

type Shopper = { token: string; headers: { Authorization: string } }

function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

async function freshShopper(request: APIRequestContext, name: string): Promise<Shopper> {
  const registered = await request.post(`${core}/auth/register`, { data: { name, email: freshEmail(), password: 'password123' } })
  expect(registered.status()).toBe(201)
  const { token } = (await registered.json()) as { token: string }
  return { token, headers: { Authorization: `Bearer ${token}` } }
}

// The demo customer, read only here: 701 delivered, 702 cancelled, 703 placed (globalSetup reseeds before the run).
async function demoShopper(request: APIRequestContext): Promise<Shopper> {
  const answer = await request.post(`${core}/auth/sign-in`, { data: { email: 'demo@shopperstop.local', password: 'demo12345' } })
  expect(answer.status()).toBe(200)
  const { token } = (await answer.json()) as { token: string }
  return { token, headers: { Authorization: `Bearer ${token}` } }
}

type Pick = { id: string; units: number }

// The n-th product of page 2 with stock of exactly 10 and a price of at least 20 rupees; units are the fewest that reach the minimum.
// Indices 0 and 1 are this suite's (web's checkout takes 0 to 3, its own tests 4 to 9).
async function orderPick(request: APIRequestContext, n: number): Promise<Pick> {
  const listed = await request.get(`${core}/stores/${koramangala}/products?page=2&pageSize=100`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as {
    items: { id: string; priceCents: number; inStock: boolean; quantity: number }[]
  }
  const detail = await request.get(`${core}/stores/${koramangala}`)
  expect(detail.status()).toBe(200)
  const { minOrderCents } = (await detail.json()) as { minOrderCents: number }
  const picks = items.filter((item) => item.inStock && item.quantity === 10 && item.priceCents >= 2000)
  const pick = picks[n]
  if (!pick) throw new Error(`no order pick ${n}: ${picks.length} qualify at Koramangala`)
  return { id: pick.id, units: Math.ceil(minOrderCents / pick.priceCents) }
}

async function fillCart(request: APIRequestContext, shopper: Shopper, pick: Pick): Promise<void> {
  const answer = await request.put(`${core}/me/cart/items`, {
    headers: shopper.headers,
    data: { storeId: koramangala, productId: pick.id, quantity: pick.units },
  })
  expect(answer.status()).toBe(200)
  expect(((await answer.json()) as { clamped: boolean }).clamped).toBe(false)
}

async function addAddress(request: APIRequestContext, shopper: Shopper): Promise<void> {
  const answer = await request.post(`${core}/me/addresses`, {
    headers: shopper.headers,
    data: { label: 'Home', line1: '12 80 Feet Rd, Koramangala', pincode: '560034', isDefault: true },
  })
  expect(answer.status()).toBe(201)
}

async function placeByApi(request: APIRequestContext, shopper: Shopper): Promise<{ id: string; number: string }> {
  const addresses = await request.get(`${core}/me/addresses`, { headers: shopper.headers })
  const { items } = (await addresses.json()) as { items: { id: string }[] }
  const answer = await request.post(`${core}/orders`, { headers: shopper.headers, data: { addressId: items[0]!.id } })
  expect(answer.status()).toBe(201)
  const { id, number } = (await answer.json()) as { id: string; number: string }
  return { id, number }
}

// The seeded Koramangala store staff, for the tests that move an order's status.
async function staffHeaders(request: APIRequestContext): Promise<{ Authorization: string }> {
  const answer = await request.post(`${core}/admin/auth/sign-in`, {
    data: { email: 'koramangala@shopperstop.local', password: 'staff12345' },
  })
  expect(answer.status()).toBe(200)
  const { token } = (await answer.json()) as { token: string }
  return { Authorization: `Bearer ${token}` }
}

// Signs the browser in before any page script runs: the token goes where the app's session reads it.
async function signedIn(page: Page, shopper: Shopper) {
  await page.addInitScript(([key, token]) => localStorage.setItem(key, token), [tokenKey, shopper.token])
}

test('History and a delivered order against core', async ({ page, request }) => {
  const shopper = await demoShopper(request)
  await signedIn(page, shopper)
  await page.goto('/')
  await page.getByRole('tab', { name: 'Orders', exact: true }).click()

  const cards = page.getByRole('link', { name: /^View order / })
  await expect(cards).toHaveCount(3)
  await expect(page.getByRole('link', { name: 'View order SS-DEMOAAAD', exact: true })).toContainText('Placed')
  await expect(page.getByRole('link', { name: 'View order SS-DEMOAAAC', exact: true })).toContainText('Cancelled')
  await expect(page.getByRole('link', { name: 'View order SS-DEMOAAAB', exact: true })).toContainText('Delivered')
  await expectNoViolations(page)

  await page.getByRole('link', { name: 'View order SS-DEMOAAAB', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/orders/${delivered}$`))
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1, name: 'Order SS-DEMOAAAB', exact: true })).toBeVisible()
  await expect(main.getByText('Delivered', { exact: true }).first()).toBeVisible()
  await expect(main.getByText('Your order was delivered.', { exact: true })).toBeVisible()
  await expect(main.getByText('Out for delivery', { exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { level: 2, name: 'Your rider', exact: true })).toBeVisible()
  await expect(main.getByText('Arjun Rao', { exact: true })).toBeVisible()
  await expect(main.getByText('Open in Maps', { exact: true })).toHaveCount(0)
  await expectNoViolations(page)
})

test('Tracking follows the order against core', async ({ page, request }) => {
  test.slow()
  const shopper = await freshShopper(request, 'E2E Tracking')
  const pick = await orderPick(request, 0)
  await addAddress(request, shopper)
  await fillCart(request, shopper, pick)
  const placed = await placeByApi(request, shopper)
  await signedIn(page, shopper)

  await page.goto('/')
  await page.getByRole('tab', { name: 'Orders', exact: true }).click()
  await page.getByRole('link', { name: `View order ${placed.number}`, exact: true }).click()
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1, name: `Order ${placed.number}`, exact: true })).toBeVisible()
  await expect(main.getByText(/^Arriving in \d+ min$/)).toBeVisible()
  await expect(main.getByText('Order placed. Waiting for the store to accept it.', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  const staff = await staffHeaders(request)
  for (const status of ['accepted', 'packing', 'ready', 'out_for_delivery', 'delivered']) {
    const answer = await request.post(`${core}/admin/orders/${placed.id}/status`, { headers: staff, data: { status } })
    expect(answer.status()).toBe(200)
  }
  // The screen changes by itself: the poll reads the order again, with no reload.
  await expect(main.getByText('Your order was delivered.', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(main.getByText('Delivered', { exact: true }).first()).toBeVisible()
  await expectNoViolations(page)
})

test('Cancel against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Cancel')
  const pick = await orderPick(request, 1)
  await addAddress(request, shopper)
  await fillCart(request, shopper, pick)
  const placed = await placeByApi(request, shopper)
  await signedIn(page, shopper)

  await page.goto('/')
  await page.getByRole('tab', { name: 'Orders', exact: true }).click()
  await page.getByRole('link', { name: `View order ${placed.number}`, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/orders/${placed.id}$`))
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1, name: `Order ${placed.number}`, exact: true })).toBeVisible()

  await main.getByRole('button', { name: 'Cancel order', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Cancel this order?', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  await dialog.getByRole('button', { name: 'Ordered by mistake', exact: true }).click()
  await dialog.getByRole('button', { name: 'Cancel order', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(main.getByText('This order was cancelled. Reason: Ordered by mistake', { exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Cancel order', exact: true })).toHaveCount(0)
  await expectNoViolations(page)

  const answer = await request.get(`${core}/orders/${placed.id}`, { headers: shopper.headers })
  const order = (await answer.json()) as { status: string; cancelReason?: string }
  expect(order.status).toBe('cancelled')
  expect(order.cancelReason).toBe('Ordered by mistake')
})
