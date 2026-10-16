import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The customer token lives in localStorage on the web export (session.ts uses the same key as the secure store).
const tokenKey = 'shopperstop.customer-token'
const demo = { email: 'demo@shopperstop.local', password: 'demo12345' }

function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

function storedToken(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), tokenKey)
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

// Registers through the form, so the browser ends signed in on '/'.
async function registerInBrowser(page: Page) {
  await page.goto('/register')
  await page.getByLabel('Name', { exact: true }).fill('E2E Shopper')
  await page.getByLabel('Email', { exact: true }).fill(freshEmail())
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL('/')
}

// Signs in from the account route, which sends the browser to sign-in first.
async function openAccountSignedIn(page: Page) {
  await registerInBrowser(page)
  await page.goto('/account')
  await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible()
}

test('demo customer signs in', async ({ page }) => {
  await page.goto('/account')
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Faccount$/)
  await expectNoViolations(page)

  await page.getByLabel('Email', { exact: true }).fill(demo.email)
  await page.getByLabel('Password', { exact: true }).fill(demo.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible()
  expect(await storedToken(page)).not.toBeNull()
  await expectNoViolations(page)
})

test('register with a field error', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Name', { exact: true }).fill('E2E Shopper')
  await page.getByLabel('Email', { exact: true }).fill(demo.email)
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()

  // Core's conflict answer names the field, so the message sits under Email.
  await expect(page.getByText('email already registered', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  await page.getByLabel('Email', { exact: true }).fill(freshEmail())
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Groceries in minutes' })).toBeVisible()
})

test('addresses against core', async ({ page }) => {
  await openAccountSignedIn(page)
  await expect(page.getByText('No saved addresses. Add one to check out faster.', { exact: true })).toBeVisible()

  for (const label of ['Home', 'Work']) {
    await page.getByRole('button', { name: 'Add address', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Add address', exact: true })).toBeVisible()
    if (label !== 'Home') await page.getByRole('button', { name: label, exact: true }).click()
    await page.getByLabel('House, flat, floor', { exact: true }).fill(`${label} flat 12`)
    await page.getByLabel('Pincode', { exact: true }).fill(label === 'Home' ? '560001' : '560002')
    await page.getByRole('button', { name: 'Save address', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Add address', exact: true })).toHaveCount(0)
  }

  await page.getByRole('button', { name: 'Set Work as default', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Set Work as default', exact: true })).toHaveCount(0)

  // Reload only once the save is visible: the reload would otherwise cut the request.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Set Work as default', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Set Home as default', exact: true })).toBeVisible()
  await expect(page.getByText('Default', { exact: true })).toHaveCount(1)
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Add address', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Add address', exact: true })).toBeVisible()
  await expectNoViolations(page)
})

test('sign out against core', async ({ page }) => {
  await openAccountSignedIn(page)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: 'Account', exact: true })).toBeVisible()
  expect(await storedToken(page)).toBeNull()

  await page.goto('/account')
  await expect(page).toHaveURL(/\/sign-in/)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
})
