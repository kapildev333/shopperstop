import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// Stored pincode so the first-visit pincode sheet does not cover Home.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034')))

const tokenKey = 'shopperstop:customer-token'
const cartKey = 'shopperstop:cart'
const koramangala = '00000000-0000-4000-8000-000000000401'

function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

// Products Home shows (the first 12 in stock of core's first page) with a stock of at least `minimum` at Koramangala.
// The demo stock is low, so tests that need a count above 1 pick by stock.
async function homePicks(request: APIRequestContext, minimum: number): Promise<string[]> {
  const listed = await request.get(`/api/core/v1/stores/${koramangala}/products?pageSize=24`)
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
