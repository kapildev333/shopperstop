import { expect, test } from '@playwright/test'
import { cartBar, cartSheet, core, expectNoViolations, freshEmail, koramangala, openSearch, orderPick, pincodeSheet, quantityOf, savePincode, searchFor, staffHeaders } from './support'

// Spec 2 §13, the customer flow on the web export at 390×844 against core on 18080: one customer from the pincode to a delivered order.
// Helpers from ./support (design.md Decision 3). Dynamic routes 404 on a
// direct load of the static export, so /category/<slug> and /orders/<id> are reached only by in-app navigation.

test('Customer order to delivered against core', async ({ page, request }) => {
  test.slow()
  const a = orderPick(6)
  const b = orderPick(7)
  const detail = await request.get(`${core}/stores/${koramangala}`)
  expect(detail.status()).toBe(200)
  const { minOrderCents } = (await detail.json()) as { minOrderCents: number }
  const qa = Math.max(2, Math.ceil((minOrderCents - b.priceCents) / a.priceCents))
  expect(qa).toBeLessThanOrEqual(10)
  const email = freshEmail()
  const password = 'password123'
  const main = page.getByRole('main')

  // 1. Register in the app; the browser ends signed in on Home.
  await page.goto('/register')
  await expectNoViolations(page)
  await page.getByLabel('Name', { exact: true }).fill('E2E Flow Customer')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL('/')

  // 2. The pincode sheet opens on the first visit.
  await expect(pincodeSheet(page)).toBeVisible()
  await expectNoViolations(page)
  await savePincode(page, '560034')
  await expect(pincodeSheet(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delivering to 560034, Bengaluru', exact: true })).toBeVisible()
  await expectNoViolations(page)

  // 3. Browse one category from Home, then go back.
  await page.getByRole('link', { name: 'Dairy, Bread & Eggs', exact: true }).click()
  await expect(page).toHaveURL(/\/category\/dairy-bread-eggs$/)
  // The heading fills in once the tree loads; the first product link once the grid does. Axe runs after both.
  await expect(page.getByRole('heading', { level: 1, name: 'Dairy, Bread & Eggs', exact: true })).toBeVisible()
  await expect(page.getByRole('link').first()).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  // 4. Add the first product from search, signed in.
  await openSearch(page)
  await searchFor(page, a.name)
  await page.getByRole('button', { name: `Add ${a.name}`, exact: true }).click()
  await expect(quantityOf(page, a.name)).toHaveText('1')
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  // 5. Raise the first product's quantity in the "My cart" sheet.
  await cartBar(page, '1').click()
  const cart = cartSheet(page)
  await expect(cart).toBeVisible()
  for (let i = 1; i < qa; i++) {
    await cart.getByRole('button', { name: `Add one ${a.name}`, exact: true }).click()
  }
  await expect(cart.getByRole('group', { name: `Quantity of ${a.name}`, exact: true })).toHaveText(String(qa))
  // The last write has reached the server once the cart bar counts qa items; only then close the sheet and sign out.
  await expect(cartBar(page, `${qa}`)).toBeVisible()
  await expectNoViolations(page)
  await cart.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(cart).toBeHidden()

  // 6. Sign out on My account; as a guest add the second product, then sign in through Home's "Account" button.
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My account', exact: true })).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: 'Account', exact: true })).toBeVisible()

  await openSearch(page)
  await searchFor(page, b.name)
  await page.getByRole('button', { name: `Add ${b.name}`, exact: true }).click()
  await expect(quantityOf(page, b.name)).toHaveText('1')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Faccount$/)
  await expectNoViolations(page)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My account', exact: true })).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  // 7. The cart bar counts both products after the merge; the sheet lists the first at qa and the second at 1.
  await cartBar(page, `${qa + 1}`).click()
  await expect(cart).toBeVisible()
  await expect(cart.getByRole('group', { name: `Quantity of ${a.name}`, exact: true })).toHaveText(String(qa))
  await expect(cart.getByRole('group', { name: `Quantity of ${b.name}`, exact: true })).toHaveText('1')
  await expectNoViolations(page)
  await cart.getByRole('link', { name: 'Proceed to checkout', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)

  // The checkout: no address yet, so one is added in the sheet; the summary lists both products.
  await expect(main.getByText('No addresses yet', { exact: true })).toBeVisible()
  await expectNoViolations(page)
  await main.getByRole('button', { name: 'Add address', exact: true }).click()
  const addressSheet = page.getByRole('dialog', { name: 'Add address', exact: true })
  await expect(addressSheet).toBeVisible()
  await expectNoViolations(page)
  await addressSheet.getByLabel('House, flat, floor', { exact: true }).fill('12 80 Feet Rd, Koramangala')
  await addressSheet.getByLabel('Pincode', { exact: true }).fill('560034')
  await addressSheet.getByRole('button', { name: 'Save address', exact: true }).click()
  await expect(addressSheet).toBeHidden()
  await expect(main.getByText('Delivering to Home', { exact: true })).toBeVisible()
  await expect(main.getByText(a.name, { exact: true })).toBeVisible()
  await expect(main.getByText(`${qa} × ${a.unitLabel}`, { exact: true })).toBeVisible()
  await expect(main.getByText(b.name, { exact: true })).toBeVisible()
  await expect(main.getByText(`1 × ${b.unitLabel}`, { exact: true })).toBeVisible()
  await expectNoViolations(page)

  // 8. Place the order; the tracking screen opens on the order's id.
  await main.getByRole('button', { name: 'Place order', exact: true }).click()
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/)
  const orderId = new URL(page.url()).pathname.split('/').pop() ?? ''
  await expect(main.getByRole('heading', { level: 1, name: /^Order SS-\w{8}$/ })).toBeVisible()
  await expect(main.getByText('Order placed. Waiting for the store to accept it.', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  // 9. The Koramangala store staff move the order through core's API, five steps.
  const staff = await staffHeaders(request)
  for (const status of ['accepted', 'packing', 'ready', 'out_for_delivery', 'delivered']) {
    const answer = await request.post(`${core}/admin/orders/${orderId}/status`, { headers: staff, data: { status } })
    expect(answer.status()).toBe(200)
  }

  // 10. The screen changes by itself: the poll reads the order again, with no reload.
  await expect(main.getByText('Your order was delivered.', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expectNoViolations(page)
})
