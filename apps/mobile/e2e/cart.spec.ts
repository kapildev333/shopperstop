import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

// The cart on the web export at 390×844, against core on 18080 (helpers copied from orders.spec.ts and catalog.spec.ts). Dynamic routes
// 404 on a direct load of the static export, so /product/<slug> is reached only by in-app navigation.
const core = 'http://localhost:18080/api/core/v1'
const tokenKey = 'shopperstop.customer-token'
const pincodeKey = 'shopperstop:pincode'
const guestCartKey = 'shopperstop:cart'
const koramangala = '00000000-0000-4000-8000-000000000401'
const indiranagar = '00000000-0000-4000-8000-000000000402'
const admin = { email: 'admin@shopperstop.local', password: 'admin12345' }

type Shopper = { token: string; headers: { Authorization: string }; email: string; password: string }

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

// Signs the browser in before any page script runs: the token goes where the app's session reads it.
// The pincode is preset so the first-visit pincode sheet does not cover the tab bar (Koramangala's 560034 by default).
async function signedIn(page: Page, shopper: Shopper, pincode = '560034') {
  await page.addInitScript(
    ([key, token, pincodeStorage, chosen]) => {
      localStorage.setItem(key, token)
      localStorage.setItem(pincodeStorage, chosen)
    },
    [tokenKey, shopper.token, pincodeKey, pincode],
  )
}

// A guest with the pincode chosen: the cart lives in local storage only.
async function guest(page: Page, pincode = '560034') {
  await page.addInitScript(
    ([key, chosen]) => localStorage.setItem(key, chosen),
    [pincodeKey, pincode],
  )
}

// The seeded Koramangala store staff, for the stock changes.
async function staffHeaders(request: APIRequestContext): Promise<{ Authorization: string }> {
  const answer = await request.post(`${core}/admin/auth/sign-in`, { data: admin })
  expect(answer.status()).toBe(200)
  const { token } = (await answer.json()) as { token: string }
  return { Authorization: `Bearer ${token}` }
}

// Products Home shows (the first 12 in stock of core's first page) with a stock of at least `minimum` at the store.
// The demo stock is low, so tests that need a count above 1 pick by stock.
async function homePicks(request: APIRequestContext, minimum: number, storeId = koramangala): Promise<string[]> {
  const listed = await request.get(`${core}/stores/${storeId}/products?pageSize=24`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as { items: { name: string; inStock: boolean; quantity: number }[] }
  return items
    .filter((item) => item.inStock)
    .slice(0, 12)
    .filter((item) => item.quantity >= minimum)
    .map((item) => item.name)
}

function sheet(page: Page) {
  return page.getByRole('dialog', { name: 'Where should we deliver?' })
}

// The sheet's field and Continue; the sheet's dialog is waited for first (its slide ends before the field takes input).
async function savePincode(page: Page, pincode: string) {
  await expect(sheet(page)).toBeVisible()
  await sheet(page).getByLabel('Pincode', { exact: true }).fill(pincode)
  await sheet(page).getByRole('button', { name: 'Continue', exact: true }).click()
}

// The section's heading and the links, buttons and groups inside it (the section is the heading's parent view).
function section(page: Page, heading: string): Locator {
  return page.getByRole('heading', { level: 2, name: heading, exact: true }).locator('xpath=..')
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

function quantityOf(page: Page, name: string): Locator {
  return page.getByRole('group', { name: `Quantity of ${name}`, exact: true })
}

function cartBar(page: Page, count: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^View cart, ${count} item`) })
}

function cartSheet(page: Page): Locator {
  return page.getByRole('dialog', { name: 'My cart', exact: true })
}

// The cart core holds for a token: its store id and its lines.
async function serverCart(request: APIRequestContext, token: string) {
  const cart = await (await request.get(`${core}/me/cart`, { headers: { Authorization: `Bearer ${token}` } })).json()
  return cart as { storeId?: string; items: { product: { name: string }; quantity: number }[] }
}

test('Guest cart against core', async ({ page, request }) => {
  const [first, second] = await homePicks(request, 2)
  expect(second).toBeDefined()
  await guest(page)

  await page.goto('/')
  await page.getByRole('button', { name: `Add ${first}`, exact: true }).click()
  await page.getByRole('button', { name: `Add ${second}`, exact: true }).click()
  await page.getByRole('button', { name: `Add one ${first}`, exact: true }).click()
  await expect(quantityOf(page, first)).toHaveText('2')
  await expect(cartBar(page, '3')).toBeVisible()

  await page.reload()
  await expect(cartBar(page, '3')).toBeVisible()
  await expectNoViolations(page)

  await cartBar(page, '3').click()
  const sheet = cartSheet(page)
  await expect(sheet).toBeVisible()
  await expect(quantityOf(page, first).first()).toBeVisible()
  await expect(sheet.getByRole('link', { name: 'Proceed to checkout', exact: true })).toBeVisible()
  await expectNoViolations(page)

  await sheet.getByRole('button', { name: `Remove one ${first}`, exact: true }).click()
  await sheet.getByRole('button', { name: `Remove one ${first}`, exact: true }).click()
  await sheet.getByRole('button', { name: `Remove one ${second}`, exact: true }).click()
  await expect(sheet.getByText('Your cart is empty', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  await sheet.getByRole('button', { name: 'Close sheet', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(cartBar(page, '3')).toHaveCount(0)
})

test('Quick taps against core', async ({ page, request }) => {
  const [name] = await homePicks(request, 3)
  expect(name).toBeDefined()
  const shopper = await freshShopper(request, 'E2E Quick Taps')
  await signedIn(page, shopper)

  // Core's first answer is held back; the later taps must not overtake it on the wire.
  let held = false
  await page.route('**/api/core/v1/me/cart/items', async (route) => {
    if (!held) {
      held = true
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
    await route.continue()
  })

  await page.goto('/')
  const picks = section(page, 'Picked for you')
  await picks.getByRole('button', { name: `Add ${name}`, exact: true }).click()
  await picks.getByRole('button', { name: `Add one ${name}`, exact: true }).click()
  await picks.getByRole('button', { name: `Add one ${name}`, exact: true }).click()
  await picks.getByRole('button', { name: `Remove one ${name}`, exact: true }).click()
  await expect(quantityOf(page, name).first()).toHaveText('2')

  await expect
    .poll(async () => (await serverCart(request, shopper.token)).items.find((line) => line.product.name === name)?.quantity)
    .toBe(2)
  await expectNoViolations(page)
})

test('Merge at sign-in against core', async ({ page, request }) => {
  const [first, second] = await homePicks(request, 2)
  expect(second).toBeDefined()
  const shopper = await freshShopper(request, 'E2E Cart Merge')
  await guest(page)

  await page.goto('/')
  await page.getByRole('button', { name: `Add ${first}`, exact: true }).click()
  await page.getByRole('button', { name: `Add one ${first}`, exact: true }).click()
  await page.getByRole('button', { name: `Add ${second}`, exact: true }).click()
  await expect(quantityOf(page, first)).toHaveText('2')

  await page.getByRole('button', { name: 'Delivering to 560034, Bengaluru', exact: true }).click()
  await expect(sheet(page)).toBeVisible()
  await page.getByRole('link', { name: /^Have an account\?/ }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  await page.getByLabel('Email', { exact: true }).fill(shopper.email)
  await page.getByLabel('Password', { exact: true }).fill(shopper.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  await expect(quantityOf(page, first)).toHaveText('2')
  await expect(quantityOf(page, second)).toHaveText('1')
  expect(await page.evaluate((key) => localStorage.getItem(key), guestCartKey)).toBeNull()
  await expectNoViolations(page)
})

test('Clamp against core', async ({ page, request }) => {
  // The first product of the first 100 at full stock: it is reached by search, so Home's picks are not involved.
  const listed = await request.get(`${core}/stores/${koramangala}/products?pageSize=100`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as {
    items: { id: string; name: string; slug: string; inStock: boolean; quantity: number }[]
  }
  const target = items.find((item) => item.inStock && item.quantity === 10)
  if (!target) throw new Error('the demo store holds no product at full stock on page one')
  const { name } = target

  // The seeded demo admin changes the stock; the real value is read first and restored in finally.
  const staff = await staffHeaders(request)
  const stockUrl = `${core}/admin/stores/${koramangala}/stock`
  const stock = await request.get(`${stockUrl}?q=${encodeURIComponent(name)}&pageSize=100`, { headers: staff })
  expect(stock.status()).toBe(200)
  const row = ((await stock.json()) as { items: { productId: string; quantity: number }[] }).items.find(
    (item) => item.productId === target.id,
  )
  if (!row) throw new Error(`no stock row for ${name}`)
  const original = row.quantity
  const setStock = (quantity: number) =>
    request.put(stockUrl, { headers: staff, data: { rows: [{ productId: target.id, quantity }] } })

  const shopper = await freshShopper(request, 'E2E Clamp')
  const seeded = await request.put(`${core}/me/cart/items`, {
    headers: shopper.headers,
    data: { storeId: koramangala, productId: target.id, quantity: 2 },
  })
  expect(seeded.status()).toBe(200)
  await signedIn(page, shopper)

  try {
    await page.goto('/')
    await openSearch(page)
    await searchFor(page, name)
    await page.locator(`a[href="/product/${target.slug}"]:visible`).click()
    await expect(page).toHaveURL(new RegExp(`/product/${target.slug}$`))
    await expect(quantityOf(page, name)).toContainText('2')

    // The customer has 2 and the page is open; the stock drops to 1, so "Add one" is cut to 1.
    expect((await setStock(1)).status()).toBe(204)
    await page.getByRole('button', { name: `Add one ${name}`, exact: true }).click()
    await expect(quantityOf(page, name)).toContainText('1')
    await expectNoViolations(page)

    await page.goBack()
    await cartBar(page, '1').click()
    const sheet = cartSheet(page)
    await expect(sheet.getByText('Some quantities were lowered to what the store has.', { exact: true })).toBeVisible()
    await expectNoViolations(page)
  } finally {
    expect((await setStock(original)).status()).toBe(204)
  }
})

test('Server store change against core', async ({ page, request }) => {
  const [name] = await homePicks(request, 1)
  const shopper = await freshShopper(request, 'E2E Store Change')
  await signedIn(page, shopper)

  await page.goto('/')
  await page.getByRole('button', { name: `Add ${name}`, exact: true }).click()
  await expect(cartBar(page, '1')).toBeVisible()

  // A cart switch the customer has to confirm: the pincode sheet, then the dialog's "Switch store".
  await page.getByRole('button', { name: 'Delivering to 560034, Bengaluru', exact: true }).click()
  await savePincode(page, '560038')
  const switching = page.getByRole('dialog', { name: /^Switch to the / })
  await expect(switching).toBeVisible()
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Switch store', exact: true }).click()
  await expect(switching).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delivering to 560038, Bengaluru', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^View cart/ })).toHaveCount(0)
  await expect.poll(async () => (await serverCart(request, shopper.token)).items.length).toBe(0)
  await expectNoViolations(page)
})

test('Replaced notice against core', async ({ page, request }) => {
  const [atKoramangala] = await homePicks(request, 1, koramangala)
  const [atIndiranagar] = await homePicks(request, 1, indiranagar)
  expect(atKoramangala).toBeDefined()
  expect(atIndiranagar).toBeDefined()
  const shopper = await freshShopper(request, 'E2E Replaced')
  const seeded = await request.put(`${core}/me/cart/items`, {
    headers: shopper.headers,
    data: { storeId: koramangala, productId: (await productId(request, koramangala, atKoramangala!)), quantity: 1 },
  })
  expect(seeded.status()).toBe(200)
  await signedIn(page, shopper, '560038')

  const notice = 'Your cart from Koramangala was replaced. A cart holds products from one store.'
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Delivering to 560038, Bengaluru', exact: true })).toBeVisible()
  await expect(cartBar(page, '1')).toBeVisible()
  const picks = section(page, 'Picked for you')
  await picks.getByRole('button', { name: `Add ${atIndiranagar}`, exact: true }).click()

  const sheet = cartSheet(page)
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText(notice, { exact: true })).toBeVisible()
  await expectNoViolations(page)

  await sheet.getByRole('button', { name: 'Close sheet', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(cartBar(page, '1')).toBeVisible()
  await expect(page.getByText(notice, { exact: true })).toBeVisible()
  await expectNoViolations(page)
})

// The product id behind a name at a store: the first page's listing, as Home reads it.
async function productId(request: APIRequestContext, storeId: string, name: string): Promise<string> {
  const listed = await request.get(`${core}/stores/${storeId}/products?pageSize=24`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as { items: { id: string; name: string }[] }
  const found = items.find((item) => item.name === name)
  if (!found) throw new Error(`no product ${name} at ${storeId}`)
  return found.id
}
