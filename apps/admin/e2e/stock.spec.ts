import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demo rows from core's seed (the e2e database is reset before every run); the test puts back the quantity it changes.
const koramangala = '00000000-0000-4000-8000-000000000401'
const indiranagar = '00000000-0000-4000-8000-000000000402'

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

async function saveQuantity(page: Page, value: string) {
  await page.getByRole('textbox', { name: 'Quantity of Sunny Fields Toned Milk' }).fill(value)
  await expect(page.getByText('1 unsaved change')).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Stock saved.' })).toBeVisible()
  await expect(page.getByText('No unsaved changes')).toBeVisible()
}

test('admin sets stock at a store', async ({ page }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Stock' }).click()
  const store = page.getByLabel('Store', { exact: true })
  const stock = page.getByRole('table', { name: 'Stock' })
  await expect(store.locator('option:checked')).toHaveText('Indiranagar')
  await expect(page.getByText(/^Page 1 of 7, 14[78] products$/)).toBeVisible()
  await expectNoAxeViolations(page)

  await store.selectOption({ label: 'Koramangala' })
  await expect(page).toHaveURL(new RegExp(`/admin/stock\\?store=${koramangala}$`))
  await expect(page.getByText(/^Page 1 of 7, 14[78] products$/)).toBeVisible()

  // Every row under the low-stock filter carries the badge: the page's threshold is core's.
  const lowOnly = page.getByRole('button', { name: 'Low stock only' })
  await lowOnly.click()
  await expect(page.getByText(/^Page 1 of 1, \d+ products$/)).toBeVisible()
  const low = (await stock.getByRole('row').count()) - 1
  expect(low).toBeGreaterThan(0)
  await expect(stock.getByText('Low stock', { exact: true })).toHaveCount(low)
  await expectNoAxeViolations(page)
  await lowOnly.click()

  await page.getByRole('searchbox', { name: 'Search' }).fill('sunny fields toned')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(stock.getByRole('textbox')).toHaveCount(1)
  const milk = page.getByRole('textbox', { name: 'Quantity of Sunny Fields Toned Milk' })
  const before = await milk.inputValue()
  const changed = String(Number(before) + 1)

  // An unsaved edit: the row is marked, and switching store asks first.
  await milk.fill(changed)
  await expect(stock.getByText('Unsaved', { exact: true })).toBeVisible()
  await expectNoAxeViolations(page)
  await store.selectOption({ label: 'Indiranagar' })
  const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' })
  await expect(dialog).toBeVisible()
  await expectNoAxeViolations(page)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(milk).toHaveValue(changed)

  await saveQuantity(page, changed)
  await page.reload()
  await expect(milk).toHaveValue(changed)
  await expect(store.locator('option:checked')).toHaveText('Koramangala')
  await saveQuantity(page, before)
})

test('store staff set stock at their own store only', async ({ page }) => {
  await signIn(page, 'koramangala@shopperstop.local', 'staff12345')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Stock' }).click()
  await expect(page.getByRole('table', { name: 'Stock' })).toBeVisible()
  await expect(page.getByLabel('Store', { exact: true })).toHaveCount(0)
  await expectNoAxeViolations(page)

  // Another store in the URL changes nothing: core is asked for the staff member's own store.
  const asked = page.waitForRequest((request) => request.method() === 'GET' && /\/admin\/stores\/[^/]+\/stock/.test(request.url()))
  await page.goto(`./stock?store=${indiranagar}`)
  expect(new URL((await asked).url()).pathname).toBe(`/api/core/v1/admin/stores/${koramangala}/stock`)
  await expect(page.getByRole('table', { name: 'Stock' })).toBeVisible()
  await expect(page.getByLabel('Store', { exact: true })).toHaveCount(0)
})
