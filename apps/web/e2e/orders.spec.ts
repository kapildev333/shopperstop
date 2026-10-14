import { expect, test } from '@playwright/test'
import { demoShopper, expectNoViolations, signedIn } from './shopper'

// Stored pincode so the first-visit pincode sheet does not cover Home.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034')))

// The demo customer's orders are read only here: 701 delivered, 702 cancelled, 703 placed (read by number and position).
const delivered = '00000000-0000-4000-8000-000000000701'

test('tracking against core', async ({ page, request }) => {
  const shopper = await demoShopper(request)
  await signedIn(page, shopper)
  await page.goto(`/orders/${delivered}`)

  await expect(page.getByRole('heading', { level: 1, name: 'Order SS-DEMOAAAB', exact: true })).toBeVisible()
  await expect(page.getByText('Your order was delivered.', { exact: true })).toBeVisible()
  const history = page.getByRole('region', { name: 'Status history', exact: true })
  await expect(history.getByRole('listitem')).toHaveCount(6)
  await expect(history.getByRole('listitem').last().getByText('Delivered', { exact: true })).toBeVisible()
  await expectNoViolations(page)
})

test('history against core', async ({ page, request }) => {
  const shopper = await demoShopper(request)
  await signedIn(page, shopper)
  await page.goto('/orders')

  const cards = page.getByRole('main').getByRole('listitem')
  await expect(cards).toHaveCount(3)
  await expect(cards.nth(0)).toContainText('SS-DEMOAAAD')
  await expect(cards.nth(1).getByText('Cancelled', { exact: true })).toBeVisible()
  await expect(cards.nth(2).getByText('Delivered', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  await page.getByRole('link', { name: 'View order SS-DEMOAAAB', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/orders/${delivered}$`))
})
