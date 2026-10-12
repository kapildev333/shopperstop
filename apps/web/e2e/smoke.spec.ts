import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('home passes axe', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Groceries in minutes' })).toBeVisible()
  await expect(page.getByRole('banner')).toContainText('ShopperStop')
  await expect(page.getByRole('button', { name: 'Enter pincode' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 246, 248)')
  await expect(page.getByRole('banner')).toHaveCSS('background-color', 'rgb(248, 203, 70)')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('not found passes axe', async ({ page }) => {
  await page.goto('/nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('not found link returns home', async ({ page }) => {
  await page.goto('/nope')
  await page.getByRole('link', { name: 'Go to Home' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Groceries in minutes' })).toBeVisible()
})

test('web preview proxies to core', async ({ request }) => {
  const response = await request.get('/api/core/v1/healthz')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})
