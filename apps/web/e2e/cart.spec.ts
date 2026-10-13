import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// Stored pincode so the first-visit pincode sheet does not cover Home.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034')))

const tokenKey = 'shopperstop:customer-token'
const cartKey = 'shopperstop:cart'
const koramangala = '00000000-0000-4000-8000-000000000401'

function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

// Two in-stock products with a stock of at least 2 at Koramangala, in core's order (the demo stock is low).
async function twoPicks(request: APIRequestContext): Promise<[string, string]> {
  const listed = await request.get(`/api/core/v1/stores/${koramangala}/products?pageSize=24`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as { items: { name: string; inStock: boolean; quantity: number }[] }
  const picks = items.filter((item) => item.inStock && item.quantity >= 2).map((item) => item.name)
  expect(picks.length).toBeGreaterThanOrEqual(2)
  return [picks[0], picks[1]]
}

function quantityOf(page: Page, name: string) {
  return page.getByRole('group', { name: `Quantity of ${name}` })
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
  await page.getByRole('button', { name: `Add ${first}` }).click()
  await page.getByRole('button', { name: `Add one ${first}` }).click()
  await expect(quantityOf(page, first)).toHaveText('2')
  await page.getByRole('button', { name: `Add ${second}` }).click()
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
