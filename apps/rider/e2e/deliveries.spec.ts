import { expect, test } from '@playwright/test'
import { asRider, coreOrder, customerDelivery, expectNoViolations, readyOrder, riderToken, staffHeaders } from './helpers'

const riderEmail = 'rider1-koramangala@shopperstop.local'
const riderPassword = 'rider12345'
// The rider flow's pick index (design Decision 19): rider flow 0, phone layout 1, cross-app flow 2.
const pickIndex = 0

test('ready order to delivered', async ({ page, request }) => {
  test.slow()
  const order = await readyOrder(request, await staffHeaders(request), pickIndex)
  await asRider(page, await riderToken(request, riderEmail, riderPassword))

  // The order is on the Pick up page.
  await page.goto('./')
  const card = page.getByRole('list', { name: 'Ready orders', exact: true }).getByRole('listitem').filter({ hasText: order.number })
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expectNoViolations(page)

  // Pick up, confirmed in the dialog: the rider lands on the delivery page.
  await card.getByRole('button', { name: `Pick up ${order.number}`, exact: true }).click()
  const pickUp = page.getByRole('dialog', { name: `Pick up ${order.number}?`, exact: true })
  await expect(pickUp).toBeVisible()
  await expectNoViolations(page)
  await pickUp.getByRole('button', { name: 'Pick up', exact: true }).click()
  await expect(page).toHaveURL(/\/rider\/deliveries\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { level: 1, name: `Order ${order.number}`, exact: true })).toBeVisible()
  await expect(page.getByText('On the way', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  // The browser's fixed position reaches the customer's read, and the customer sees the rider's name.
  await expect
    .poll(() => customerDelivery(request, order.shopper, order.id), { timeout: 20_000 })
    .toMatchObject({ riderName: 'Arjun Rao', status: 'assigned', location: { lat: 12.9352, lng: 77.6245 } })

  // Mark delivered, confirmed in the dialog.
  await page.getByRole('button', { name: 'Mark delivered', exact: true }).click()
  const delivered = page.getByRole('dialog', { name: `Mark ${order.number} delivered?`, exact: true })
  await expect(delivered).toBeVisible()
  await expectNoViolations(page)
  await delivered.getByRole('button', { name: 'Mark delivered', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: `${order.number} delivered.` })).toBeVisible()
  await expect(page.getByText('Delivered', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark delivered', exact: true })).toHaveCount(0)
  await expectNoViolations(page)

  // Core holds the order delivered.
  expect((await coreOrder(request, order.shopper, order.id)).status).toBe('delivered')

  // History lists it.
  await page.getByRole('navigation', { name: 'Rider', exact: true }).getByRole('link', { name: 'History', exact: true }).click()
  const history = page.getByRole('table', { name: 'Delivered deliveries', exact: true })
  await expect(history.getByRole('link', { name: order.number, exact: true })).toBeVisible()
  await expectNoViolations(page)
})
