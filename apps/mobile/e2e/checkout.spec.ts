import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

// Checkout on the web export at 390×844, against core on 18080 (helpers copied from orders.spec.ts and cart.spec.ts). Dynamic routes
// 404 on a direct load of the static export, so /checkout is reached only through the cart sheet's "Proceed to checkout".
const core = 'http://localhost:18080/api/core/v1'
const tokenKey = 'shopperstop.customer-token'
const pincodeKey = 'shopperstop:pincode'
const koramangala = '00000000-0000-4000-8000-000000000401'
const admin = { email: 'admin@shopperstop.local', password: 'admin12345' }

type Shopper = { token: string; headers: { Authorization: string }; email: string; password: string }
type Pick = { id: string; name: string; units: number }

function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

async function freshShopper(request: APIRequestContext, name: string): Promise<Shopper> {
  const email = freshEmail()
  const password = 'password123'
  const registered = await request.post(`${core}/auth/register`, { data: { name, email, password } })
  expect(registered.status()).toBe(201)
  const { token } = (await registered.json()) as { token: string }
  return { token, headers: { Authorization: `Bearer ${token}` }, email, password }
}

// The n-th product of page 2 with stock of exactly 10 and a price of at least 20 rupees; units are the fewest that reach the minimum.
// Indices 0 and 1 are orders.spec's, 2 to 5 are this suite's (each test its own product).
async function orderPick(request: APIRequestContext, n: number): Promise<Pick> {
  const listed = await request.get(`${core}/stores/${koramangala}/products?page=2&pageSize=100`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as {
    items: { id: string; name: string; priceCents: number; inStock: boolean; quantity: number }[]
  }
  const detail = await request.get(`${core}/stores/${koramangala}`)
  expect(detail.status()).toBe(200)
  const { minOrderCents } = (await detail.json()) as { minOrderCents: number }
  const picks = items.filter((item) => item.inStock && item.quantity === 10 && item.priceCents >= 2000)
  const pick = picks[n]
  if (!pick) throw new Error(`no order pick ${n}: ${picks.length} qualify at Koramangala`)
  return { id: pick.id, name: pick.name, units: Math.ceil(minOrderCents / pick.priceCents) }
}

async function fillCart(request: APIRequestContext, shopper: Shopper, pick: Pick): Promise<void> {
  const answer = await request.put(`${core}/me/cart/items`, {
    headers: shopper.headers,
    data: { storeId: koramangala, productId: pick.id, quantity: pick.units },
  })
  expect(answer.status()).toBe(200)
  expect(((await answer.json()) as { clamped: boolean }).clamped).toBe(false)
}

async function addAddress(request: APIRequestContext, shopper: Shopper, label = 'Home', pincode = '560034'): Promise<void> {
  const answer = await request.post(`${core}/me/addresses`, {
    headers: shopper.headers,
    data: { label, line1: '12 80 Feet Rd, Koramangala', pincode, isDefault: true },
  })
  expect(answer.status()).toBe(201)
}

// Signs the browser in before any page script runs: the token goes where the app's session reads it.
// The pincode is preset so the first-visit pincode sheet does not cover the tab bar (Koramangala's 560034).
async function signedIn(page: Page, shopper: Shopper) {
  await page.addInitScript(
    ([key, token, pincodeStorage]) => {
      localStorage.setItem(key, token)
      localStorage.setItem(pincodeStorage, '560034')
    },
    [tokenKey, shopper.token, pincodeKey],
  )
}

// A guest with the pincode chosen: the cart lives in local storage only.
async function guest(page: Page) {
  await page.addInitScript((key) => localStorage.setItem(key, '560034'), pincodeKey)
}

// The seeded Koramangala store staff, for the stock changes.
async function staffHeaders(request: APIRequestContext): Promise<{ Authorization: string }> {
  const answer = await request.post(`${core}/admin/auth/sign-in`, { data: admin })
  expect(answer.status()).toBe(200)
  const { token } = (await answer.json()) as { token: string }
  return { Authorization: `Bearer ${token}` }
}

// The cart core holds for a token: its lines.
async function serverCart(request: APIRequestContext, token: string) {
  const cart = await (await request.get(`${core}/me/cart`, { headers: { Authorization: `Bearer ${token}` } })).json()
  return cart as { storeId?: string; items: { product: { name: string }; quantity: number }[] }
}

// From Home's search control; the search screen's own box takes over after that.
async function openSearch(page: Page) {
  await page.getByRole('button', { name: 'Search products', exact: true }).click()
  await expect(page).toHaveURL(/\/search$/)
}

async function searchFor(page: Page, text: string) {
  const box = page.getByRole('textbox', { name: 'Search products', exact: true })
  await box.fill(text)
  await box.press('Enter')
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(text)
}

function cartBar(page: Page, count: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^View cart, ${count} item`) })
}

function cartSheet(page: Page): Locator {
  return page.getByRole('dialog', { name: 'My cart', exact: true })
}

// Home's "View cart" bar, the cart sheet, and its "Proceed to checkout" link: the path a customer takes to /checkout.
async function proceedToCheckout(page: Page, units: number) {
  await page.goto('/')
  await cartBar(page, String(units)).click()
  const sheet = cartSheet(page)
  // The sheet's dialog role arrives after its slide, so the link is waited for on the dialog.
  await expect(sheet).toBeVisible()
  await sheet.getByRole('link', { name: 'Proceed to checkout', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
}

test('Address added at checkout against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Checkout Address')
  const pick = await orderPick(request, 2)
  await fillCart(request, shopper, pick)
  await signedIn(page, shopper)
  await proceedToCheckout(page, pick.units)

  const main = page.getByRole('main')
  await expect(main.getByText('No addresses yet', { exact: true })).toBeVisible()
  await main.getByRole('button', { name: 'Add address', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add address', exact: true })
  await expect(dialog).toBeVisible()
  await expectNoViolations(page)

  await dialog.getByLabel('House, flat, floor', { exact: true }).fill('12 80 Feet Rd, Koramangala')
  await dialog.getByLabel('Pincode', { exact: true }).fill('560034')
  await dialog.getByRole('button', { name: 'Save address', exact: true }).click()
  await expect(dialog).toBeHidden()

  await expect(main.getByText('Delivering to Home', { exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Place order', exact: true })).toBeVisible()
  await expectNoViolations(page)
})

test('Order placed against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Order Placed')
  const pick = await orderPick(request, 3)
  await addAddress(request, shopper)

  // A guest adds the product from search, then signs in from the cart sheet: the cart merges into the customer's.
  await guest(page)
  await page.goto('/')
  await openSearch(page)
  await searchFor(page, pick.name)
  await page.getByRole('button', { name: `Add ${pick.name}`, exact: true }).click()
  for (let i = 1; i < pick.units; i++) {
    await page.getByRole('button', { name: `Add one ${pick.name}`, exact: true }).click()
  }
  await expect(page.getByRole('group', { name: `Quantity of ${pick.name}`, exact: true })).toHaveText(String(pick.units))
  await cartBar(page, String(pick.units)).click()
  const sheet = cartSheet(page)
  await expect(sheet).toBeVisible()
  await sheet.getByRole('link', { name: 'Proceed to checkout', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  await page.getByLabel('Email', { exact: true }).fill(shopper.email)
  await page.getByLabel('Password', { exact: true }).fill(shopper.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)

  const main = page.getByRole('main')
  await expect(main.getByText(pick.name, { exact: true })).toBeVisible()
  await expectNoViolations(page)

  await main.getByRole('button', { name: 'Place order', exact: true }).click()
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/)
  await expect(main.getByRole('heading', { level: 1, name: /^Order SS-.{8}$/ })).toBeVisible()
  await expect(main.getByText('Order placed. Waiting for the store to accept it.', { exact: true })).toBeVisible()
  await expect(main.getByText(pick.name, { exact: true })).toBeVisible()
  await expectNoViolations(page)

  expect((await serverCart(request, shopper.token)).items).toEqual([])
})

test('Out of stock at checkout against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Out Of Stock')
  const pick = await orderPick(request, 4)
  await addAddress(request, shopper)
  await fillCart(request, shopper, pick)

  // The seeded admin sets the stock to 0 once the page has loaded; the real value is read first and restored in finally.
  const staff = await staffHeaders(request)
  const stockUrl = `${core}/admin/stores/${koramangala}/stock`
  const stock = await request.get(`${stockUrl}?q=${encodeURIComponent(pick.name)}&pageSize=100`, { headers: staff })
  expect(stock.status()).toBe(200)
  const row = ((await stock.json()) as { items: { productId: string; quantity: number }[] }).items.find(
    (item) => item.productId === pick.id,
  )
  if (!row) throw new Error(`no stock row for ${pick.name}`)
  const original = row.quantity
  const setStock = (quantity: number) =>
    request.put(stockUrl, { headers: staff, data: { rows: [{ productId: pick.id, quantity }] } })

  try {
    await signedIn(page, shopper)
    await proceedToCheckout(page, pick.units)
    const main = page.getByRole('main')
    await expect(main.getByText(pick.name, { exact: true })).toBeVisible()
    expect((await setStock(0)).status()).toBe(204)

    await main.getByRole('button', { name: 'Place order', exact: true }).click()
    await expect(main.getByText('Some products are not available in the quantity you chose.', { exact: true })).toBeVisible()
    await expect(main.getByText('Out of stock', { exact: true })).toBeVisible()
    await expectNoViolations(page)

    const orders = await request.get(`${core}/orders`, { headers: shopper.headers })
    expect(((await orders.json()) as { total: number }).total).toBe(0)

    await main.getByRole('button', { name: `Remove ${pick.name}`, exact: true }).click()
    await expect(main.getByText('Your cart is empty', { exact: true })).toBeVisible()
  } finally {
    expect((await setStock(original)).status()).toBe(204)
  }
})

test('Address not served against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Not Served')
  const pick = await orderPick(request, 5)
  // Indiranagar's pincode: the only address does not reach Koramangala's cart.
  await addAddress(request, shopper, 'Work', '560038')
  await fillCart(request, shopper, pick)
  await signedIn(page, shopper)
  await proceedToCheckout(page, pick.units)

  const main = page.getByRole('main')
  await expect(main.getByText('Delivering to Work', { exact: true })).toBeVisible()
  await main.getByRole('button', { name: 'Place order', exact: true }).click()
  await expect(
    main.getByText('Koramangala does not deliver to this address. Choose another address or add one.', { exact: true }),
  ).toBeVisible()
  await expect(main.getByText('Not delivered here', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  expect((await serverCart(request, shopper.token)).items).toHaveLength(1)
})
