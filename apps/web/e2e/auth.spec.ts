import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const tokenKey = 'shopperstop:customer-token'
const demo = { email: 'demo@shopperstop.local', password: 'demo12345' }

function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

function storedToken(page: import('@playwright/test').Page) {
  return page.evaluate((key) => localStorage.getItem(key), tokenKey)
}

test('register signs in', async ({ page }) => {
  await page.goto('/register')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Enter your name')).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
  await page.getByLabel('Name').fill('E2E Shopper')
  await page.getByLabel('Email').fill(freshEmail())
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/')
  expect(await storedToken(page)).not.toBeNull()
})

test('demo customer signs in', async ({ page }) => {
  await page.goto('/sign-in')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
  await page.getByLabel('Email').fill(demo.email)
  await page.getByLabel('Password').fill(demo.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
  expect(await storedToken(page)).not.toBeNull()
})

test('wrong password against core', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(freshEmail())
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText(/wrong email or password/i)
  await expect(page).toHaveURL(/\/sign-in$/)
  expect(await storedToken(page)).toBeNull()
})
