import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demo rows from core's seed (the e2e database is reset before every run); the test puts back what it changes.
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

async function savePromisedMinutes(page: Page, minutes: string) {
  await page.getByLabel('Promised minutes').fill(minutes)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Store saved.' })).toBeVisible()
}

async function addPincode(page: Page, pincode: string) {
  await page.getByLabel('Add pincode').fill(pincode)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
}

async function savePincodes(page: Page) {
  await page.getByRole('button', { name: 'Save pincodes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Pincodes saved.' })).toBeVisible()
}

test('admin edits a store and meets the pincode conflict', async ({ page }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Stores' }).click()
  const stores = page.getByRole('table', { name: 'Stores' })
  await expect(stores.getByRole('link')).toHaveText(['Indiranagar', 'Koramangala'])
  await expectNoAxeViolations(page)

  await stores.getByRole('link', { name: 'Koramangala' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Koramangala' })).toBeVisible()
  await expect(page.getByLabel('Promised minutes')).toHaveValue('10')
  await expectNoAxeViolations(page)

  await savePromisedMinutes(page, '11')
  await page.reload()
  await expect(page.getByLabel('Promised minutes')).toHaveValue('11')
  await savePromisedMinutes(page, '10')

  const pincodes = page.getByRole('table', { name: 'Pincodes' })
  await expect(pincodes).toContainText('560034')
  await addPincode(page, '560038')
  await page.getByRole('button', { name: 'Save pincodes' }).click()
  await expect(page.getByRole('alert')).toHaveText('Pincode 560038 is served by Indiranagar.')
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Remove 560038' }).click()
  await expect(page.getByRole('button', { name: 'Save pincodes' })).toBeDisabled()

  await addPincode(page, '560001')
  await savePincodes(page)
  await page.reload()
  await expect(pincodes).toContainText('560001')
  await page.getByRole('button', { name: 'Remove 560001' }).click()
  await savePincodes(page)
  await expect(pincodes).not.toContainText('560001')
})

test('store staff open the stores page', async ({ page }) => {
  await signIn(page, 'koramangala@shopperstop.local', 'staff12345')
  await expect(page.getByRole('navigation', { name: 'Admin' }).getByRole('link')).toHaveText(['Dashboard', 'Orders', 'Stock'])
  await page.goto('./stores')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/stores$/)
  await expectNoAxeViolations(page)
})
