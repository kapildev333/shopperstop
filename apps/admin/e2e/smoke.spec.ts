import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('not found passes axe', async ({ page }) => {
  await page.goto('./nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('preview proxies to core', async ({ request }) => {
  const response = await request.get('/api/core/v1/healthz')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})
