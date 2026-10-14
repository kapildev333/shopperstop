import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demo rows from core's seed (the e2e database is reset before every run); the test puts back what it changes.
// A 1×1 PNG, built here so the repository carries no binary fixture.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

async function signIn(page: Page, email: string, password: string) {
  await page.goto('./sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
}

async function expectNoAxeViolations(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
}

async function savePrice(page: Page, rupees: string) {
  await page.getByLabel('Price (₹)').fill(rupees)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Product saved.' })).toBeVisible()
}

test('admin runs the catalog', async ({ page }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  const nav = page.getByRole('navigation', { name: 'Admin' })

  await nav.getByRole('link', { name: 'Categories' }).click()
  const categories = page.getByRole('table', { name: 'Categories' })
  await expect(categories.getByRole('row').nth(1)).toContainText('Fruits & Vegetables')
  await expect(categories.getByRole('row').nth(2)).toContainText('Fresh Fruits')
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Edit Milk' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit Milk' }).getByLabel('Sort order')).toHaveValue('10')
  await expectNoAxeViolations(page)
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  await nav.getByRole('link', { name: 'Products' }).click()
  await expect(page.getByText('Page 1 of 7, 148 products')).toBeVisible()
  await expectNoAxeViolations(page)
  await page.getByRole('searchbox', { name: 'Search' }).fill('sunny fields toned')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const products = page.getByRole('table', { name: 'Products' })
  await expect(products.getByRole('link')).toHaveText(['Sunny Fields Toned Milk'])
  await products.getByRole('link', { name: 'Sunny Fields Toned Milk' }).click()
  await expect(page.getByLabel('Price (₹)')).toHaveValue('27.99')
  await expectNoAxeViolations(page)
  await savePrice(page, '28')
  await page.reload()
  await expect(page.getByLabel('Price (₹)')).toHaveValue('28')
  await savePrice(page, '27.99')

  // The image goes on a new product, so no seeded image is replaced; the product is deleted at the end.
  await nav.getByRole('link', { name: 'Products' }).click()
  await page.getByRole('link', { name: 'New product' }).click()
  await page.getByLabel('Name').fill('E2E Curd Cup')
  await page.getByLabel('Category').selectOption({ label: 'Dairy, Bread & Eggs › Paneer & Curd' })
  await page.getByLabel('Unit').fill('400 g')
  await page.getByLabel('MRP (₹)').fill('40')
  await page.getByLabel('Price (₹)').fill('35.50')
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Create product' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'E2E Curd Cup' })).toBeVisible()

  await page.getByLabel('Image').setInputFiles({ name: 'tile.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('status').filter({ hasText: 'Image saved.' })).toBeVisible()
  const tile = page.getByRole('img', { name: 'Image of E2E Curd Cup' })
  await expect(tile).toHaveAttribute('src', /^\/api\/core\/v1\/files\/products\/[0-9a-f-]{36}\.png\?v=1$/)
  await expect.poll(() => tile.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1)
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: 'Delete product' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/admin\/products$/)
  await page.getByRole('searchbox', { name: 'Search' }).fill('e2e curd cup')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'No products found' })).toBeVisible()
})

test('store staff open the catalog pages', async ({ page }) => {
  await signIn(page, 'koramangala@shopperstop.local', 'staff12345')
  for (const path of ['categories', 'products']) {
    await page.goto(`./${path}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/admin/${path}$`))
    await expectNoAxeViolations(page)
  }
})
