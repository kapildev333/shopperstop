import { expect, test, type Page } from '@playwright/test'
import { expectNoViolations, freshEmail, koramangala, orderPick } from './shopper'

// The admin app on its preview (playwright.config.ts starts it); its base path is /admin/.
const adminOrigin = 'http://localhost:15174/admin/'

// Signs the browser in on the admin app; every flow does it once per role (core allows 10 sign-ins per email per hour).
async function staffSignIn(page: Page, email: string, password: string) {
  await page.goto('./sign-in')
  await expectNoViolations(page)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await expectNoViolations(page)
}

// Spec 2 §13, "customer order taken to delivered": one customer across both apps, the store staff move it to delivered.
test('customer order to delivered across both apps', async ({ page, request, browser }) => {
  test.slow()
  // 0 to 6 are checkout's and orders' tests, 9 was the manager's manual walk.
  const a = await orderPick(request, 7)
  const b = await orderPick(request, 8)
  const detail = await request.get(`/api/core/v1/stores/${koramangala}`)
  const { minOrderCents } = (await detail.json()) as { minOrderCents: number }
  const qa = Math.max(2, Math.ceil((minOrderCents - b.priceCents) / a.priceCents))
  expect(qa).toBeLessThanOrEqual(10)

  const banner = page.getByRole('banner')
  const drawer = page.getByRole('dialog', { name: 'Your cart', exact: true })
  const quantityOf = (name: string) => page.getByRole('group', { name: 'Quantity of ' + name, exact: true })
  async function search(name: string) {
    await banner.getByRole('searchbox', { name: 'Search products', exact: true }).fill(name)
    await banner.getByRole('searchbox', { name: 'Search products', exact: true }).press('Enter')
    await expect(page).toHaveURL(/\/search\?q=/)
  }

  // 1. Register on the customer site.
  const email = freshEmail()
  await page.goto('/register')
  await expectNoViolations(page)
  await page.getByLabel('Name', { exact: true }).fill('E2E Flow Customer')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL('/')

  // 2. The pincode sheet opens on Home with no stored pincode.
  const sheet = page.getByRole('dialog', { name: 'Your delivery pincode', exact: true })
  await expect(sheet).toBeVisible()
  await expectNoViolations(page)
  await sheet.getByLabel('Pincode', { exact: true }).fill('560034')
  await sheet.getByRole('button', { name: 'Save pincode', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(banner.getByRole('button', { name: 'Delivery in 10 minutes 560034', exact: true })).toBeVisible()
  await expectNoViolations(page)

  // 3. Browse one category from Home.
  await page.getByRole('region', { name: 'Shop by category', exact: true }).getByRole('link', { name: 'Dairy, Bread & Eggs', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dairy, Bread & Eggs', exact: true })).toBeVisible()
  await expectNoViolations(page)

  // 4. Add two products from search.
  await search(a.name)
  await page.getByRole('button', { name: `Add ${a.name}`, exact: true }).click()
  await expect(quantityOf(a.name)).toHaveText('1')
  await expectNoViolations(page)
  await search(b.name)
  await page.getByRole('button', { name: `Add ${b.name}`, exact: true }).click()
  await expect(quantityOf(b.name)).toHaveText('1')

  // 5. Raise the first product's quantity in the cart drawer.
  await banner.getByRole('button', { name: /^2 items/ }).click()
  for (let i = 1; i < qa; i++) {
    await drawer.getByRole('button', { name: `Add one ${a.name}`, exact: true }).click()
  }
  await expect(drawer.getByRole('group', { name: 'Quantity of ' + a.name, exact: true })).toHaveText(String(qa))
  await expectNoViolations(page)
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()

  // 6. Sign out; the cart goes with the session. The guest-line merge itself is covered by cart.spec.ts › "guest cart merges against core"; this step checks the cart survives sign-out and sign-in.
  await banner.getByRole('link', { name: 'E2E Flow Customer', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(banner.getByRole('button', { name: 'Cart', exact: true })).toBeVisible()

  // 7. Sign back in.
  await banner.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expectNoViolations(page)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')

  // 8. The signed-in cart is restored: the same two lines and quantities.
  await banner.getByRole('button', { name: new RegExp('^' + (qa + 1) + ' items') }).click()
  await expect(drawer.getByRole('listitem')).toHaveCount(2)
  await expect(drawer.getByRole('group', { name: 'Quantity of ' + a.name, exact: true })).toHaveText(String(qa))
  await expect(drawer.getByRole('group', { name: 'Quantity of ' + b.name, exact: true })).toHaveText('1')
  await expectNoViolations(page)
  await drawer.getByRole('link', { name: 'Proceed to checkout', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)

  // 9. Add a delivery address at checkout, then check the summary.
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
  await expect(addresses.getByRole('radio', { name: 'Deliver to Home', exact: true })).toHaveAttribute('aria-checked', 'true')
  const summary = page.getByRole('region', { name: 'Order summary', exact: true })
  await expect(summary.getByText(a.name, { exact: true })).toBeVisible()
  await expect(summary.getByText(b.name, { exact: true })).toBeVisible()
  await expectNoViolations(page)

  // 10. Place the order; the tracking page stays open from here on.
  await page.getByRole('button', { name: 'Place order (COD)', exact: true }).click()
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/)
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toHaveText(/^Order SS-\w{8}$/)
  const number = ((await heading.textContent()) ?? '').replace(/^Order /, '')
  await expect(page.getByText('Order placed. Waiting for the store to accept it.', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  // Staff half: the Koramangala store staff, in a second context on the admin app.
  const staffContext = await browser.newContext({ baseURL: adminOrigin })
  try {
    // 11. Sign in as the store staff.
    const board = await staffContext.newPage()
    await staffSignIn(board, 'koramangala@shopperstop.local', 'staff12345')

    // 12. Find the order's card in the Placed column.
    await board.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Orders', exact: true }).click()
    await expect(board.getByText('Store: Koramangala')).toBeVisible()
    await expect(board.getByRole('region', { name: /^Placed/ }).getByRole('listitem').filter({ hasText: number })).toBeVisible()
    await expectNoViolations(board)

    // 13. Move it one step at a time.
    for (const [button, status] of [['Accept', 'Accepted'], ['Start packing', 'Packing'], ['Mark ready', 'Ready'], ['Send out', 'Out for delivery']]) {
      await board.getByRole('button', { name: `${button} ${number}`, exact: true }).click()
      await expect(board.getByRole('status').filter({ hasText: `${number} is now ${status}.` })).toBeVisible()
    }
    await expectNoViolations(board)

    // 14. Mark it delivered, confirmed in the dialog.
    await board.getByRole('button', { name: `Mark delivered ${number}`, exact: true }).click()
    const confirm = board.getByRole('dialog', { name: `Mark ${number} delivered?`, exact: true })
    await expectNoViolations(board)
    await confirm.getByRole('button', { name: 'Mark delivered', exact: true }).click()
    await expect(board.getByRole('status').filter({ hasText: `${number} is now Delivered.` })).toBeVisible()
    await expectNoViolations(board)
  } finally {
    await staffContext.close()
  }

  // Back on the customer's tracking page, never reloaded: the poll shows the delivery.
  await expect(page.getByText('Your order was delivered.', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(
    page.getByRole('region', { name: 'Status history', exact: true }).getByRole('listitem').last().getByText('Delivered', { exact: true }),
  ).toBeVisible()
  await expectNoViolations(page)
})

// Spec 2 §13, "admin product found by customer search": the admin creates and stocks a product, a guest finds it by search.
test('admin product found by customer search', async ({ page, browser }) => {
  const run = Date.now().toString(36)
  // "Zzz" sorts after every seeded product, so no product moves between pages; stock 5 keeps it out of orderPick's stock-10 filter (design Decision 3).
  const name = `Zzz E2E Paneer ${run}`

  const adminContext = await browser.newContext({ baseURL: adminOrigin })
  const admin = await adminContext.newPage()
  try {
    // 1. The seeded admin signs in.
    await staffSignIn(admin, 'admin@shopperstop.local', 'admin12345')

    // 2. Create the product.
    await admin.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Products', exact: true }).click()
    await expect(admin.getByRole('heading', { level: 1, name: 'Products', exact: true })).toBeVisible()
    await admin.getByRole('link', { name: 'New product', exact: true }).click()
    await admin.getByLabel('Name').fill(name)
    await admin.getByLabel('Category').selectOption({ label: 'Dairy, Bread & Eggs › Paneer & Curd' })
    await admin.getByLabel('Unit').fill('200 g')
    await admin.getByLabel('MRP (₹)').fill('90')
    await admin.getByLabel('Price (₹)').fill('85')
    await expectNoViolations(admin)
    await admin.getByRole('button', { name: 'Create product', exact: true }).click()
    await expect(admin.getByRole('heading', { level: 1, name, exact: true })).toBeVisible()
    await expectNoViolations(admin)

    // 3. Set its stock at Koramangala to 5.
    await admin.goto(`./stock?store=${koramangala}`)
    await admin.getByRole('searchbox', { name: 'Search', exact: true }).fill(run)
    await admin.getByRole('button', { name: 'Search', exact: true }).click()
    const quantity = admin.getByRole('textbox', { name: `Quantity of ${name}`, exact: true })
    await expect(quantity).toHaveValue('0')
    await expectNoViolations(admin)
    await quantity.fill('5')
    await admin.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(admin.getByRole('status').filter({ hasText: 'Stock saved.' })).toBeVisible()
    await expectNoViolations(admin)
  } finally {
    await adminContext.close()
  }

  // 4. A guest with pincode 560034 searches the customer site for the name.
  await page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034'))
  await page.goto('/')
  const search = page.getByRole('banner').getByRole('searchbox', { name: 'Search products', exact: true })
  await search.fill(run)
  await search.press('Enter')
  await expect(page).toHaveURL(/\/search\?q=/)
  await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  await expect(page.getByRole('button', { name: `Add ${name}`, exact: true })).toBeVisible()
  await expectNoViolations(page)
})
