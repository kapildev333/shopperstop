import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demo rows from core's seed (the e2e database is reset before every run); ids as `core-admin seed-demo --reset` prints
// them (services/core/internal/seed/summary.go). Core has no route that deletes a staff user: the one created here is
// left inactive and goes with the next reset.
const indiranagar = '00000000-0000-4000-8000-000000000402'
const created = { name: 'E2E Store Staff', email: 'e2e-staff@shopperstop.local', password: 'e2e-staff-12345' }

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

test('admin creates store staff, who see their store only until the admin deactivates them', async ({ page, browser }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Staff' }).click()
  const staff = page.getByRole('table', { name: 'Staff users' })
  await expect(staff.getByRole('button')).toHaveText(['Edit', 'Edit', 'Edit'])
  const adminRow = staff.getByRole('row').filter({ hasText: 'admin@shopperstop.local' })
  await expect(adminRow).toContainText('You')
  await expect(adminRow).toContainText('All stores')
  await expect(staff.getByRole('row').filter({ hasText: 'koramangala@shopperstop.local' })).toContainText('Koramangala')
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: 'New staff user' }).click()
  const dialog = page.getByRole('dialog', { name: 'New staff user' })
  await dialog.getByLabel('Name').fill(created.name)
  await dialog.getByLabel('Email').fill(created.email)
  await dialog.getByLabel('Password').fill(created.password)
  await dialog.getByLabel('Store').selectOption(indiranagar)
  await expectNoAxeViolations(page)
  await dialog.getByRole('button', { name: 'Create staff user' }).click()
  await expect(dialog).toHaveCount(0)
  const row = staff.getByRole('row').filter({ hasText: created.email })
  await expect(row).toContainText('Store staff')
  await expect(row).toContainText('Indiranagar')
  await expect(row).toContainText('Active')
  await page.reload()
  await expect(row).toContainText(created.name)

  // The new staff member signs in in a browser of their own, so the admin signs in once (core limits sign-ins per email).
  const context = await browser.newContext()
  const theirs = await context.newPage()
  await signIn(theirs, created.email, created.password)
  await expect(theirs.getByRole('banner')).toContainText(created.name)
  await expect(theirs.getByRole('navigation', { name: 'Admin' }).getByRole('link')).toHaveText(['Dashboard', 'Orders', 'Stock', 'Riders'])
  await theirs.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Stock' }).click()
  await expect(theirs.getByRole('table', { name: 'Stock' })).toBeVisible()
  await expect(theirs.getByText('Store: Indiranagar')).toBeVisible()
  await expect(theirs.getByLabel('Store', { exact: true })).toHaveCount(0)
  await theirs.goto('./staff')
  await expect(theirs.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(theirs).toHaveURL(/\/admin\/staff$/)
  await expectNoAxeViolations(theirs)

  await page.getByRole('button', { name: `Edit ${created.email}` }).click()
  const edit = page.getByRole('dialog', { name: `Edit ${created.name}` })
  await expect(edit.getByLabel('New password')).toHaveValue('')
  await edit.getByLabel('Status').selectOption('inactive')
  await expectNoAxeViolations(page)
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(edit).toHaveCount(0)
  await expect(row).toContainText('Inactive')

  // Their session ended with the save: the next page they open asks them to sign in.
  await theirs.goto('./stock')
  await expect(theirs).toHaveURL(/\/admin\/sign-in\?redirect=%2Fstock$/)
  await context.close()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in$/)
})
