import { expect, test } from '@playwright/test'
import { expectNoViolations, fillCart, freshShopper, orderPick, signedIn } from './shopper'

// Stored pincode so the first-visit pincode sheet does not cover Home.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034')))

test('address added at checkout', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Checkout Address')
  const pick = await orderPick(request, 0)
  await fillCart(request, shopper, pick)
  await signedIn(page, shopper)

  await page.goto('/checkout')
  const addresses = page.getByRole('region', { name: 'Delivery address', exact: true })
  await addresses.getByRole('button', { name: 'Add address', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add address', exact: true })
  await expect(dialog).toBeVisible()
  await expectNoViolations(page)

  await dialog.getByLabel('Label', { exact: true }).fill('Home')
  await dialog.getByLabel('Address line 1', { exact: true }).fill('12 80 Feet Rd, Koramangala')
  await dialog.getByLabel('Pincode', { exact: true }).fill('560034')
  await dialog.getByRole('button', { name: 'Save address', exact: true }).click()
  await expect(dialog).toBeHidden()

  await expect(addresses.getByRole('button', { name: 'Deliver to Home', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Place order (COD)', exact: true })).toBeEnabled()
  await expectNoViolations(page)
})
