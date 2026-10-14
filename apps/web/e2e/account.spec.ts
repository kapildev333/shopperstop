import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Stored pincode so the first-visit pincode sheet does not cover Home.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034')))

const tokenKey = 'shopperstop:customer-token'

function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

function storedToken(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), tokenKey)
}

// Registers through the form, so the browser ends signed in on '/'.
async function registerInBrowser(page: Page) {
  await page.goto('/register')
  await page.getByLabel('Name').fill('E2E Shopper')
  await page.getByLabel('Email').fill(freshEmail())
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/')
}

async function addAddress(page: Page, label: string, line1: string, pincode: string) {
  await page.getByRole('button', { name: 'Add address', exact: true }).click()
  await page.getByLabel('Label').fill(label)
  await page.getByLabel('Address line 1').fill(line1)
  await page.getByLabel('Pincode').fill(pincode)
  await page.getByRole('button', { name: 'Save address' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('sign in returns to where the customer was', async ({ page, request }) => {
  const email = freshEmail()
  const registered = await request.post('/api/core/v1/auth/register', {
    data: { email, password: 'password123', name: 'E2E Shopper' },
  })
  expect(registered.status()).toBe(201)

  await page.goto('/account')
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Faccount$/)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/account')
  await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible()
})

test('profile saved', async ({ page }) => {
  await registerInBrowser(page)
  const banner = page.getByRole('banner')
  await expect(banner.getByRole('link', { name: 'E2E Shopper' })).toHaveAttribute('href', '/account')

  await banner.getByRole('link', { name: 'E2E Shopper' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible()
  await page.getByLabel('Phone').fill('9876543210')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Phone')).toHaveValue('9876543210')
})

test('addresses and default', async ({ page }) => {
  await registerInBrowser(page)
  await page.getByRole('link', { name: 'E2E Shopper' }).click()
  await expect(page.getByText('No addresses yet')).toBeVisible()

  await addAddress(page, 'Home', '12 MG Road', '560001')
  await addAddress(page, 'Work', '4 Park Street', '560002')
  await page.getByRole('button', { name: 'Set Home as default' }).click()
  await page.getByRole('button', { name: 'Set Work as default' }).click()
  const home = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name: 'Home' }) })
  const work = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name: 'Work' }) })
  // Reload only once the save is visible: the reload would otherwise cut the request.
  await expect(work.getByText('Default', { exact: true })).toBeVisible()
  await page.reload()

  await expect(work.getByText('Default', { exact: true })).toBeVisible()
  await expect(home.getByText('Default', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Default', { exact: true })).toHaveCount(1)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])

  await page.getByRole('button', { name: 'Edit Home' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit address' })).toBeVisible()
  const dialogResults = await new AxeBuilder({ page }).analyze()
  expect(dialogResults.violations).toEqual([])
  await page.getByLabel('Address line 1').fill('2 New Road')
  await page.getByRole('button', { name: 'Save address' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(home.getByText('2 New Road')).toBeVisible()

  await page.getByRole('button', { name: 'Delete Work' }).click()
  await expect(page.getByRole('heading', { level: 3, name: 'Work' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(1)
})

test('sign out', async ({ page }) => {
  await registerInBrowser(page)
  await page.getByRole('link', { name: 'E2E Shopper' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible()
  expect(await storedToken(page)).toBeNull()
  await page.goto('/account')
  await expect(page).toHaveURL(/\/sign-in/)
})
