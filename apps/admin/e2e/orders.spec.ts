import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demo rows from core's seed. The e2e database is reset before every run (e2e/global-setup.ts), which this file needs:
// the first test moves the seeded placed order SS-DEMOAAAD (...0703) to delivered, and nothing can move it back.
// SS-DEMOAAAB (...0701) is seeded delivered and SS-DEMOAAAC (...0702) cancelled, all three at Koramangala.
const koramangala = '00000000-0000-4000-8000-000000000401'

async function signIn(page: Page, email: string, password: string) {
  await page.goto('./sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
}

async function expectNoAxeViolations(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
}

test('store staff take the placed order to delivered and find it in History', async ({ page }) => {
  await signIn(page, 'koramangala@shopperstop.local', 'staff12345')
  const nav = page.getByRole('navigation', { name: 'Admin' })
  await nav.getByRole('link', { name: 'Orders' }).click()
  await expect(page.getByText('Store: Koramangala')).toBeVisible()
  await expect(page.getByLabel('Store', { exact: true })).toHaveCount(0)

  // The card of the seeded order, in the Placed column.
  const card = page.getByRole('listitem').filter({ hasText: 'SS-DEMOAAAD' })
  await expect(page.getByRole('region', { name: /^Placed/ }).getByRole('listitem').filter({ hasText: 'SS-DEMOAAAD' })).toBeVisible()
  await expect(card).toContainText('4 items, pincode 560034')
  await expect(card).toContainText('₹1,030')
  await expect(card).toContainText(/\d+ min ago/)
  await expectNoAxeViolations(page)

  // The detail sheet, and its cancel dialog left unused.
  await card.getByRole('button', { name: 'SS-DEMOAAAD', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Order SS-DEMOAAAD' })
  await expect(sheet).toContainText('Demo Customer')
  await expect(sheet.getByRole('link', { name: '+919800000000' })).toBeVisible()
  await expect(sheet).toContainText('Home: 12 80 Feet Rd, Koramangala, 560034')
  await expect(sheet).toContainText('3 × Pomegranate Bhagwa, 1 kg')
  await expect(sheet).toContainText('Placed by the customer')
  await expectNoAxeViolations(page)
  await sheet.getByRole('button', { name: 'Cancel order' }).click()
  const cancel = page.getByRole('dialog', { name: 'Cancel order SS-DEMOAAAD?' })
  await expect(cancel.getByLabel('Reason')).toBeFocused()
  await expectNoAxeViolations(page)
  await cancel.getByRole('button', { name: 'Keep order' }).click()
  await sheet.getByRole('button', { name: 'Close' }).click()

  // One step at a time, as the store does it.
  for (const [button, status] of [['Accept', 'Accepted'], ['Start packing', 'Packing'], ['Mark ready', 'Ready'], ['Send out', 'Out for delivery']]) {
    await page.getByRole('button', { name: `${button} SS-DEMOAAAD` }).click()
    await expect(page.getByRole('status').filter({ hasText: `SS-DEMOAAAD is now ${status}.` })).toBeVisible()
    await expect(page.getByRole('region', { name: new RegExp(`^${status}`) }).getByRole('listitem').filter({ hasText: 'SS-DEMOAAAD' })).toBeVisible()
  }
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Mark delivered SS-DEMOAAAD' }).click()
  const confirm = page.getByRole('dialog', { name: 'Mark SS-DEMOAAAD delivered?' })
  await expectNoAxeViolations(page)
  await confirm.getByRole('button', { name: 'Mark delivered' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'SS-DEMOAAAD is now Delivered.' })).toBeVisible()
  await expect(card).toHaveCount(0)
  await expectNoAxeViolations(page)

  // History: delivered now holds it next to the seeded delivered order; cancelled holds the seeded cancelled one.
  await page.getByRole('navigation', { name: 'Orders' }).getByRole('link', { name: 'History' }).click()
  const history = page.getByRole('table', { name: 'Order history' })
  await expect(history.getByRole('button', { name: 'SS-DEMOAAAD' })).toBeVisible()
  await expect(history.getByRole('button', { name: 'SS-DEMOAAAB' })).toBeVisible()
  await expectNoAxeViolations(page)
  await history.getByRole('button', { name: 'SS-DEMOAAAD' }).click()
  await expect(sheet).toContainText('Delivered by staff')
  await expect(sheet.getByRole('button', { name: 'Cancel order' })).toHaveCount(0)
  await expectNoAxeViolations(page)
  await sheet.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Cancelled' }).click()
  await expect(history.getByRole('button')).toHaveText(['SS-DEMOAAAC'])
  await page.reload()
  await expect(history.getByRole('button')).toHaveText(['SS-DEMOAAAC'])
  await expect(page).toHaveURL(/\/admin\/orders\?tab=history&status=cancelled$/)
})

test('an admin sees the dashboard cards and opens a store\'s orders from one', async ({ page }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Indiranagar', 'Koramangala'])
  const store = page.getByRole('region', { name: 'Koramangala' })
  await expect(store).toContainText('Orders today')
  await expect(store).toContainText('Revenue today')
  await expect(store).toContainText(/Low stock\d+ products/)
  await expect(store.getByRole('link', { name: 'Low stock at Koramangala' })).toHaveAttribute('href', `/admin/stock?store=${koramangala}&lowStock=true`)
  await expectNoAxeViolations(page)

  await store.getByRole('link', { name: 'Orders at Koramangala' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/orders\\?store=${koramangala}$`))
  await expect(page.getByLabel('Store', { exact: true }).locator('option:checked')).toHaveText('Koramangala')
  await expect(page.getByRole('navigation', { name: 'Orders' }).getByRole('link', { name: 'Board' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('navigation', { name: 'Orders' }).getByRole('link', { name: 'History' }).click()
  await expect(page.getByRole('table', { name: 'Order history' }).getByRole('button', { name: 'SS-DEMOAAAB' })).toBeVisible()
  await expectNoAxeViolations(page)
})
