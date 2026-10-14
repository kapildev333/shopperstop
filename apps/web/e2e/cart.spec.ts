import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// Stored pincode so the first-visit pincode sheet does not cover Home.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034')))

const tokenKey = 'shopperstop:customer-token'
const cartKey = 'shopperstop:cart'
const koramangala = '00000000-0000-4000-8000-000000000401'
const indiranagar = '00000000-0000-4000-8000-000000000402'
const taaza = '00000000-0000-4000-8000-000000000601'
const admin = { email: 'admin@shopperstop.local', password: 'admin12345' }

function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

// Products Home shows (the first 12 in stock of core's first page) with a stock of at least `minimum` at Koramangala.
// The demo stock is low, so tests that need a count above 1 pick by stock.
async function homePicks(request: APIRequestContext, minimum: number, storeId = koramangala): Promise<string[]> {
  const listed = await request.get(`/api/core/v1/stores/${storeId}/products?pageSize=24`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as { items: { name: string; inStock: boolean; quantity: number }[] }
  return items
    .filter((item) => item.inStock)
    .slice(0, 12)
    .filter((item) => item.quantity >= minimum)
    .map((item) => item.name)
}

async function twoPicks(request: APIRequestContext): Promise<[string, string]> {
  const picks = await homePicks(request, 2)
  expect(picks.length).toBeGreaterThanOrEqual(2)
  return [picks[0], picks[1]]
}

// The cart core holds for a token: its store id and its item count.
async function serverCart(request: APIRequestContext, token: string) {
  const cart = await (await request.get('/api/core/v1/me/cart', { headers: { Authorization: `Bearer ${token}` } })).json()
  return cart as { storeId?: string; items: { product: { name: string }; quantity: number }[] }
}

function quantityOf(page: Page, name: string) {
  return page.getByRole('group', { name: `Quantity of ${name}`, exact: true })
}

test('guest cart merges against core', async ({ page, request }) => {
  const [first, second] = await twoPicks(request)
  const password = 'password123'
  const email = freshEmail()
  const registered = await page.request.post('/api/core/v1/auth/register', {
    data: { name: 'E2E Guest Merge', email, password },
  })
  expect(registered.ok()).toBeTruthy()

  await page.goto('/')
  await page.getByRole('button', { name: `Add ${first}`, exact: true }).click()
  await page.getByRole('button', { name: `Add one ${first}`, exact: true }).click()
  await expect(quantityOf(page, first)).toHaveText('2')
  await page.getByRole('button', { name: `Add ${second}`, exact: true }).click()
  await expect(quantityOf(page, second)).toHaveText('1')

  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
  await expect(quantityOf(page, first)).toHaveText('2')
  await expect(quantityOf(page, second)).toHaveText('1')
  expect(await page.evaluate((key) => localStorage.getItem(key), cartKey)).toBeNull()
  expect(await page.evaluate((key) => localStorage.getItem(key), tokenKey)).not.toBeNull()

  await page.reload()
  await expect(quantityOf(page, first)).toHaveText('2')
  await expect(quantityOf(page, second)).toHaveText('1')
})

test('quick taps against core', async ({ page, request }) => {
  const [name] = await homePicks(request, 3)
  expect(name).toBeDefined()
  const password = 'password123'
  const email = freshEmail()
  const registered = await page.request.post('/api/core/v1/auth/register', {
    data: { name: 'E2E Quick Taps', email, password },
  })
  expect(registered.ok()).toBeTruthy()
  const { token } = (await registered.json()) as { token: string }
  await page.addInitScript((signedIn) => localStorage.setItem('shopperstop:customer-token', signedIn), token)

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
  await page.getByRole('button', { name: `Add ${name}`, exact: true }).click()
  await page.getByRole('button', { name: `Add one ${name}`, exact: true }).click()
  await page.getByRole('button', { name: `Add one ${name}`, exact: true }).click()
  await page.getByRole('button', { name: `Remove one ${name}`, exact: true }).click()
  await expect(quantityOf(page, name)).toHaveText('2')

  await expect
    .poll(async () => {
      const cart = await (await request.get('/api/core/v1/me/cart', { headers: { Authorization: `Bearer ${token}` } })).json()
      return (cart.items as { product: { name: string }; quantity: number }[]).find((line) => line.product.name === name)?.quantity
    })
    .toBe(2)

  await page.reload()
  await expect(quantityOf(page, name)).toHaveText('2')
})

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('cart drawer against core', async ({ page, request }) => {
    const [first, second] = await twoPicks(request)
    await page.goto('/')
    await page.getByRole('button', { name: `Add ${first}`, exact: true }).click()
    await page.getByRole('button', { name: `Add ${second}`, exact: true }).click()
    const bar = page.getByRole('complementary', { name: 'Cart summary' })
    await expect(bar.getByText('2 items', { exact: true })).toBeVisible()
    await expectNoViolations(page)

    await bar.getByRole('button', { name: 'View cart', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Your cart' })
    await expect(drawer.getByRole('listitem')).toHaveCount(2)
    await drawer.getByRole('button', { name: `Add one ${first}`, exact: true }).click()
    await expect(drawer.getByRole('group', { name: `Quantity of ${first}`, exact: true })).toHaveText('2')
    await expect(bar.getByText('3 items', { exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute(
      'href',
      '/sign-in?returnTo=%2Fcheckout',
    )
    await expectNoViolations(page)
  })
})

test('server cart clamps above stock', async ({ page, request }) => {
  // The last product of the first 100 at full stock: past Home's picks, and no other suite opens it.
  const listed = await request.get(`/api/core/v1/stores/${koramangala}/products?pageSize=100`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as {
    items: { id: string; name: string; slug: string; inStock: boolean; quantity: number }[]
  }
  const picked = items.filter((item) => item.inStock && item.quantity === 10)
  expect(picked.length).toBeGreaterThan(0)
  const target = picked[picked.length - 1]
  const { name } = target

  // The seeded demo admin changes the stock; the real value is read first and restored in finally.
  const signIn = await request.post('/api/core/v1/admin/auth/sign-in', { data: admin })
  expect(signIn.status()).toBe(200)
  const staff = { Authorization: `Bearer ${(await signIn.json()).token}` }
  const stockUrl = `/api/core/v1/admin/stores/${koramangala}/stock`
  const stock = await request.get(`${stockUrl}?q=${encodeURIComponent(name)}&pageSize=100`, { headers: staff })
  expect(stock.status()).toBe(200)
  const row = ((await stock.json()) as { items: { productId: string; quantity: number }[] }).items.find(
    (item) => item.productId === target.id,
  )
  if (!row) throw new Error(`no stock row for ${name}`)
  const original = row.quantity
  const setStock = (quantity: number) =>
    request.put(stockUrl, { headers: staff, data: { rows: [{ productId: target.id, quantity }] } })

  const registered = await request.post('/api/core/v1/auth/register', {
    data: { name: 'E2E Clamp', email: freshEmail(), password: 'password123' },
  })
  expect(registered.ok()).toBeTruthy()
  const { token } = (await registered.json()) as { token: string }
  const seeded = await request.put('/api/core/v1/me/cart/items', {
    headers: { Authorization: `Bearer ${token}` },
    data: { storeId: koramangala, productId: target.id, quantity: 2 },
  })
  expect(seeded.status()).toBe(200)
  await page.addInitScript((signedIn) => localStorage.setItem('shopperstop:customer-token', signedIn), token)

  const quantity = page.getByRole('group', { name: `Quantity of ${name}`, exact: true })
  const drawer = page.getByRole('dialog', { name: 'Your cart' })
  const cartButton = page.getByRole('banner').getByRole('button', { name: /^1 item/ })
  try {
    // The customer has 2 and the page is open; the stock drops to 1, so "Add one" is cut to 1.
    await page.goto(`/p/${target.slug}`)
    await expect(quantity).toHaveText('2')
    expect((await setStock(1)).status()).toBe(204)
    await page.getByRole('button', { name: `Add one ${name}`, exact: true }).click()
    await expect(quantity).toHaveText('1')
    await cartButton.click()
    await expect(drawer.getByText('Some quantities were lowered to what the store has.')).toBeVisible()

    // The stock is gone and the page reloaded: the line is out of stock and the drawer removes it.
    expect((await setStock(0)).status()).toBe(204)
    await page.reload()
    await cartButton.click()
    await drawer.getByRole('button', { name: `Remove ${name}`, exact: true }).click()
    await expect(drawer.getByText('Your cart is empty')).toBeVisible()
  } finally {
    expect((await setStock(original)).status()).toBe(204)
  }
})

test('store change against core', async ({ page, request }) => {
  const [name] = await homePicks(request, 1)
  const registered = await page.request.post('/api/core/v1/auth/register', {
    data: { name: 'E2E Store Change', email: freshEmail(), password: 'password123' },
  })
  expect(registered.ok()).toBeTruthy()
  const { token } = (await registered.json()) as { token: string }
  await page.addInitScript((signedIn) => localStorage.setItem(tokenKey, signedIn), token)

  await page.goto('/')
  await page.getByRole('button', { name: `Add ${name}`, exact: true }).click()
  const banner = page.getByRole('banner')
  const cartButton = banner.getByRole('button', { name: /^1 item/ })
  await expect(cartButton).toBeVisible()

  const sheet = page.getByRole('dialog', { name: 'Your delivery pincode' })
  const change = page.getByRole('dialog', { name: 'Change store?' })
  const pincodeButton = banner.getByRole('button', { name: /560034$/ })
  // Cancel keeps the pincode and the cart.
  await pincodeButton.click()
  await sheet.getByLabel('Pincode').fill('560038')
  await sheet.getByRole('button', { name: 'Save pincode', exact: true }).click()
  await expect(change).toBeVisible()
  await change.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(change).toBeHidden()
  await expect(banner.getByRole('button', { name: /560034$/ })).toBeVisible()
  await expect(cartButton).toBeVisible()

  // Saving again and confirming empties the cart and changes the store.
  await pincodeButton.click()
  await sheet.getByLabel('Pincode').fill('560038')
  await sheet.getByRole('button', { name: 'Save pincode', exact: true }).click()
  await expect(change).toBeVisible()
  await expectNoViolations(page)
  await change.getByRole('button', { name: 'Empty cart and change', exact: true }).click()
  await expect(change).toBeHidden()
  await expect(banner.getByRole('button', { name: 'Delivery in 12 minutes 560038', exact: true })).toBeVisible()
  await expect(banner.getByRole('button', { name: 'Cart', exact: true })).toBeVisible()
  await expect.poll(async () => (await serverCart(request, token)).items.length).toBe(0)
})

const replacedNotice = 'Your cart from Koramangala was replaced. A cart holds products from one store.'

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('replaced notice against core', async ({ page, request }) => {
    const registered = await page.request.post('/api/core/v1/auth/register', {
      data: { name: 'E2E Replaced', email: freshEmail(), password: 'password123' },
    })
    expect(registered.ok()).toBeTruthy()
    const { token } = (await registered.json()) as { token: string }
    // The cart is at Koramangala before the customer's pincode moves to Indiranagar.
    const seeded = await page.request.put('/api/core/v1/me/cart/items', {
      headers: { Authorization: `Bearer ${token}` },
      data: { storeId: koramangala, productId: taaza, quantity: 1 },
    })
    expect(seeded.status()).toBe(200)
    const [added] = await homePicks(request, 1, indiranagar)
    await page.addInitScript((signedIn) => localStorage.setItem(tokenKey, signedIn), token)
    await page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560038'))

    await page.goto('/')
    // The cart has loaded (so the site knows where it was) before the Add that replaces it.
    const bar = page.getByRole('complementary', { name: 'Cart summary' })
    await expect(bar.getByText('1 item', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: `Add ${added}`, exact: true }).click()

    const drawer = page.getByRole('dialog', { name: 'Your cart' })
    await expect(drawer.getByText(replacedNotice, { exact: true })).toBeVisible()
    await expect.poll(async () => (await serverCart(request, token)).storeId).toBe(indiranagar)
    expect((await serverCart(request, token)).items).toHaveLength(1)
    await expectNoViolations(page)

    await drawer.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(drawer).toBeHidden()
    await expect(bar.getByText('1 item', { exact: true })).toBeVisible()
    await expect(bar.getByText(replacedNotice, { exact: true })).toBeVisible()
    await expectNoViolations(page)
  })
})

test("merge replaces another store's cart", async ({ page, request }) => {
  const [name] = await homePicks(request, 1, indiranagar)
  const password = 'password123'
  const email = freshEmail()
  const registered = await page.request.post('/api/core/v1/auth/register', {
    data: { name: 'E2E Merge Replace', email, password },
  })
  expect(registered.ok()).toBeTruthy()
  const { token } = (await registered.json()) as { token: string }
  // The server cart is at Koramangala; the guest then adds at Indiranagar and signs in.
  const seeded = await page.request.put('/api/core/v1/me/cart/items', {
    headers: { Authorization: `Bearer ${token}` },
    data: { storeId: koramangala, productId: taaza, quantity: 1 },
  })
  expect(seeded.status()).toBe(200)
  await page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560038'))

  await page.goto('/')
  await page.getByRole('button', { name: `Add ${name}`, exact: true }).click()
  await expect(page.getByRole('banner').getByRole('button', { name: /^1 item/ })).toBeVisible()
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')

  const drawer = page.getByRole('dialog', { name: 'Your cart' })
  await expect(drawer.getByRole('listitem')).toHaveCount(1)
  await expect(drawer.getByText(replacedNotice, { exact: true })).toBeVisible()
  await expectNoViolations(page)
})
