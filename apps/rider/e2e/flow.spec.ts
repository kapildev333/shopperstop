import { expect, test, type Page } from '@playwright/test'
import { asShopper, coreOrder, customerDelivery, expectNoViolations, fillCart, addAddress, freshShopper, orderPick } from './helpers'

// The previews as playwright.config.ts starts them: the customer site on 15173, the admin app under /admin/ on 15174, the rider app (the baseURL) on 15175.
const webOrigin = 'http://localhost:15173/'
const adminOrigin = 'http://localhost:15174/admin/'
const riderOrigin = 'http://localhost:15175/rider/'

const flowPick = 2
const riderEmail = 'rider2-koramangala@shopperstop.local'
const riderPassword = 'rider12345'

// The rider card on the tracking page polls every 10 seconds, so the name may take a poll to appear.
async function expectRiderCard(page: Page, name: string) {
  await expect(page.getByRole('region', { name: 'Rider', exact: true }).getByText(name, { exact: true })).toBeVisible({ timeout: 20_000 })
}

// Spec 2 §13 with the rider: one customer on web, the Koramangala staff on admin, the rider on the rider app.
test('customer to rider to delivered', async ({ request, browser }) => {
  test.slow()
  const shopper = await freshShopper(request, 'E2E Flow Customer')
  await addAddress(request, shopper)
  const pick = await orderPick(request, flowPick)
  await fillCart(request, shopper, pick)

  const contexts = []
  try {
    // 1. The customer places a cash on delivery order at checkout on web.
    const customer = await browser.newContext({ baseURL: webOrigin })
    contexts.push(customer)
    const checkout = await customer.newPage()
    await asShopper(checkout, shopper)
    await checkout.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034'))
    await checkout.goto('./checkout')
    await expectNoViolations(checkout)
    await checkout.getByRole('button', { name: 'Place order (COD)', exact: true }).click()
    await expect(checkout).toHaveURL(/\/orders\/[0-9a-f-]{36}$/)
    const orderId = new URL(checkout.url()).pathname.split('/').pop() ?? ''
    const heading = checkout.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText(/^Order SS-\w{8}$/)
    const number = ((await heading.textContent()) ?? '').replace(/^Order /, '')
    await expect(checkout.getByText('Order placed. Waiting for the store to accept it.', { exact: true })).toBeVisible()
    await expectNoViolations(checkout)

    // 2. Koramangala staff move it to Ready on the admin Orders board.
    const staff = await browser.newContext({ baseURL: adminOrigin })
    contexts.push(staff)
    const board = await staff.newPage()
    await board.goto('./sign-in')
    await board.getByLabel('Email', { exact: true }).fill('koramangala@shopperstop.local')
    await board.getByLabel('Password', { exact: true }).fill('staff12345')
    await board.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(board.getByRole('heading', { level: 1, name: 'Dashboard', exact: true })).toBeVisible()
    await board.getByRole('navigation', { name: 'Admin', exact: true }).getByRole('link', { name: 'Orders', exact: true }).click()
    await expect(board.getByText('Store: Koramangala', { exact: true })).toBeVisible()
    for (const [button, status] of [
      ['Accept', 'Accepted'],
      ['Start packing', 'Packing'],
      ['Mark ready', 'Ready'],
    ] as const) {
      await board.getByRole('button', { name: `${button} ${number}`, exact: true }).click()
      await expect(board.getByRole('status').filter({ hasText: `${number} is now ${status}.` })).toBeVisible()
    }
    await expectNoViolations(board)

    // 3. The rider picks it up and marks it delivered on the rider app.
    const rider = await browser.newContext({
      baseURL: riderOrigin,
      viewport: { width: 390, height: 844 },
      geolocation: { latitude: 12.9352, longitude: 77.6245 },
      permissions: ['geolocation'],
    })
    contexts.push(rider)
    const phone = await rider.newPage()
    await phone.goto('./sign-in')
    await phone.getByLabel('Email', { exact: true }).fill(riderEmail)
    await phone.getByLabel('Password', { exact: true }).fill(riderPassword)
    await phone.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(phone.getByRole('heading', { level: 1, name: 'Ready to pick up', exact: true })).toBeVisible()
    const card = phone.getByRole('list', { name: 'Ready orders', exact: true }).getByRole('listitem').filter({ hasText: number })
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(card.getByText('Cash', { exact: true })).toBeVisible()
    await card.getByRole('button', { name: `Pick up ${number}`, exact: true }).click()
    const pickUp = phone.getByRole('dialog', { name: `Pick up ${number}?`, exact: true })
    await expect(pickUp).toBeVisible()
    await expectNoViolations(phone)
    await pickUp.getByRole('button', { name: 'Pick up', exact: true }).click()
    await expect(phone.getByRole('heading', { level: 1, name: `Order ${number}`, exact: true })).toBeVisible()
    await expect(phone.getByRole('status').filter({ hasText: /^Collect ₹[\d,]+(\.\d{2})? in cash$/ })).toBeVisible()
    await expectNoViolations(phone)

    // The tracking page shows the pick up, and core and the rider service name the rider.
    await expect(checkout.getByText('Your order is out for delivery.', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expectRiderCard(checkout, 'Meera Iyer')
    await expectNoViolations(checkout)
    expect((await coreOrder(request, shopper, orderId)).riderName).toBe('Meera Iyer')
    expect((await customerDelivery(request, shopper, orderId)).riderName).toBe('Meera Iyer')

    await phone.getByRole('button', { name: 'Mark delivered', exact: true }).click()
    const delivered = phone.getByRole('dialog', { name: `Mark ${number} delivered?`, exact: true })
    await expect(delivered).toBeVisible()
    await expectNoViolations(phone)
    await delivered.getByRole('button', { name: 'Mark delivered', exact: true }).click()
    await expect(phone.getByRole('status').filter({ hasText: `${number} delivered.` })).toBeVisible()
    await expectNoViolations(phone)

    // 4. The tracking page, never reloaded, shows the delivery.
    await expect(checkout.getByText('Your order was delivered.', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expectRiderCard(checkout, 'Meera Iyer')
    await expectNoViolations(checkout)
    expect((await coreOrder(request, shopper, orderId)).status).toBe('delivered')
    expect((await customerDelivery(request, shopper, orderId)).status).toBe('delivered')
  } finally {
    for (const context of contexts) await context.close()
  }
})
