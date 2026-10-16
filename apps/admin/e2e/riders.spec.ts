import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demo rows from both seeds, reset before every run (e2e/global-setup.ts): core's admin and Koramangala store staff, and
// the rider service's four riders (services/rider/internal/seed). The service has no route that deletes a rider: the one
// created here is left inactive and goes with the next reset.
const created = { name: 'E2E Rider', email: 'e2e-rider@shopperstop.local', phone: '+919000000099', password: 'e2e-rider-12345' }

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

test('an admin lists, filters, creates and deactivates riders; store staff see only their store\'s', async ({ page, browser }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Riders' }).click()
  const riders = page.getByRole('table', { name: 'Riders' })
  const rows = riders.getByRole('row').filter({ hasText: '@shopperstop.local' })
  await expect(rows).toHaveCount(4)
  const arjun = rows.filter({ hasText: 'rider1-koramangala@shopperstop.local' })
  await expect(arjun).toContainText('Arjun Rao')
  await expect(arjun).toContainText('Koramangala')
  await expect(arjun).toContainText('Active')
  await expectNoAxeViolations(page)

  await page.getByLabel('Store', { exact: true }).selectOption({ label: 'Indiranagar' })
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('rider1-indiranagar@shopperstop.local')
  await expect(rows.nth(1)).toContainText('rider2-indiranagar@shopperstop.local')

  await page.getByRole('button', { name: 'New rider' }).click()
  const dialog = page.getByRole('dialog', { name: 'New rider' })
  await expect(dialog.getByLabel('Store').locator('option:checked')).toHaveText('Indiranagar')
  await dialog.getByLabel('Name').fill(created.name)
  await dialog.getByLabel('Email').fill(created.email)
  await dialog.getByLabel('Phone').fill(created.phone)
  await dialog.getByLabel('Password').fill(created.password)
  await expectNoAxeViolations(page)
  await dialog.getByRole('button', { name: 'Create rider' }).click()
  await expect(dialog).toHaveCount(0)
  const row = rows.filter({ hasText: created.email })
  await expect(row).toContainText(created.name)
  await expect(row).toContainText('Indiranagar')
  await expect(row).toContainText('Active')
  await page.reload()
  await expect(row).toContainText(created.name)

  await page.getByRole('button', { name: `Edit ${created.email}` }).click()
  const edit = page.getByRole('dialog', { name: `Edit ${created.name}` })
  await expect(edit.getByLabel('Phone')).toHaveValue(created.phone)
  await edit.getByLabel('Status').selectOption('inactive')
  await expectNoAxeViolations(page)
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(edit).toHaveCount(0)
  await expect(row).toContainText('Inactive')

  // Store staff in a browser of their own: their store's riders, nothing to choose.
  const context = await browser.newContext()
  const theirs = await context.newPage()
  await signIn(theirs, 'koramangala@shopperstop.local', 'staff12345')
  const nav = theirs.getByRole('navigation', { name: 'Admin' })
  await expect(nav.getByRole('link')).toHaveText(['Dashboard', 'Orders', 'Stock', 'Riders'])
  await nav.getByRole('link', { name: 'Riders' }).click()
  await expect(theirs.getByText('Store: Koramangala')).toBeVisible()
  await expect(theirs.getByLabel('Store', { exact: true })).toHaveCount(0)
  const theirRows = theirs.getByRole('table', { name: 'Riders' }).getByRole('row').filter({ hasText: '@shopperstop.local' })
  await expect(theirRows).toHaveCount(2)
  await expect(theirRows.nth(0)).toContainText('rider1-koramangala@shopperstop.local')
  await expect(theirRows.nth(1)).toContainText('rider2-koramangala@shopperstop.local')
  await expectNoAxeViolations(theirs)
  await context.close()
})
