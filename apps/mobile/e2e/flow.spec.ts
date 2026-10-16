import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

// Spec 2 §13, the customer flow on the web export at 390×844 against core on 18080: one customer from the pincode to a delivered order.
// Helpers copied from orders.spec.ts, catalog.spec.ts, cart.spec.ts and checkout.spec.ts (design.md Decision 3). Dynamic routes 404 on a
// direct load of the static export, so /category/<slug> and /orders/<id> are reached only by in-app navigation.
const core = 'http://localhost:18080/api/core/v1'
const koramangala = '00000000-0000-4000-8000-000000000401'

function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

type Pick = { id: string; name: string; priceCents: number; unitLabel: string }

// The n-th product of page 2 with stock of exactly 10 and a price of at least 20 rupees (orders.spec 0 and 1, checkout.spec 2 to 5, this flow 6 and 7).
async function orderPick(request: APIRequestContext, n: number): Promise<Pick> {
  const listed = await request.get(`${core}/stores/${koramangala}/products?page=2&pageSize=100`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as {
    items: { id: string; name: string; priceCents: number; unitLabel: string; inStock: boolean; quantity: number }[]
  }
  const picks = items.filter((item) => item.inStock && item.quantity === 10 && item.priceCents >= 2000)
  const pick = picks[n]
  if (!pick) throw new Error(`no order pick ${n}: ${picks.length} qualify at Koramangala`)
  return { id: pick.id, name: pick.name, priceCents: pick.priceCents, unitLabel: pick.unitLabel }
}

// The seeded Koramangala store staff, for the status moves.
async function staffHeaders(request: APIRequestContext): Promise<{ Authorization: string }> {
  const answer = await request.post(`${core}/admin/auth/sign-in`, {
    data: { email: 'koramangala@shopperstop.local', password: 'staff12345' },
  })
  expect(answer.status()).toBe(200)
  const { token } = (await answer.json()) as { token: string }
  return { Authorization: `Bearer ${token}` }
}

function sheet(page: Page) {
  return page.getByRole('dialog', { name: 'Where should we deliver?' })
}

// The sheet's field and Continue; the sheet's dialog is waited for first (its slide ends before the field takes input).
async function savePincode(page: Page, pincode: string) {
  await expect(sheet(page)).toBeVisible()
  await sheet(page).getByLabel('Pincode', { exact: true }).fill(pincode)
  await sheet(page).getByRole('button', { name: 'Continue', exact: true }).click()
}

function quantityOf(page: Page, name: string): Locator {
  return page.getByRole('group', { name: `Quantity of ${name}`, exact: true })
}

// The cart bar's count, e.g. "1 item" or "7 items".
function cartBar(page: Page, countText: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^View cart, ${countText}`) })
}

function cartSheet(page: Page): Locator {
  return page.getByRole('dialog', { name: 'My cart', exact: true })
}

// From Home's search control; the search screen's own box takes over after that.
async function searchFor(page: Page, text: string) {
  await page.getByRole('button', { name: 'Search products', exact: true }).click()
  await expect(page).toHaveURL(/\/search$/)
  const box = page.getByRole('textbox', { name: 'Search products', exact: true })
  await box.fill(text)
  await box.press('Enter')
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(text)
}

test('Customer order to delivered against core', async ({ page, request }) => {
  test.slow()
  const a = await orderPick(request, 6)
  const b = await orderPick(request, 7)
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
  await expect(sheet(page)).toBeVisible()
  await expectNoViolations(page)
  await savePincode(page, '560034')
  await expect(sheet(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delivering to 560034, Bengaluru', exact: true })).toBeVisible()
  await expectNoViolations(page)

  // 3. Browse one category from Home, then go back.
  await page.getByRole('link', { name: 'Dairy, Bread & Eggs', exact: true }).click()
  await expect(page).toHaveURL(/\/category\/dairy-bread-eggs$/)
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  // 4. Add the first product from search, signed in.
  await searchFor(page, a.name)
  await page.getByRole('button', { name: `Add ${a.name}`, exact: true }).click()
  await expect(quantityOf(page, a.name)).toHaveText('1')
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  // 5. Raise the first product's quantity in the "My cart" sheet.
  await cartBar(page, '1 item').click()
  const cart = cartSheet(page)
  await expect(cart).toBeVisible()
  for (let i = 1; i < qa; i++) {
    await cart.getByRole('button', { name: `Add one ${a.name}`, exact: true }).click()
  }
  await expect(cart.getByRole('group', { name: `Quantity of ${a.name}`, exact: true })).toHaveText(String(qa))
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
  await cartBar(page, `${qa + 1} items`).click()
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
