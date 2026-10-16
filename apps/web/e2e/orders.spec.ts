import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  addAddress,
  demoShopper,
  expectNoViolations,
  fillCart,
  freshShopper,
  orderPick,
  placeByApi,
  signedIn,
  staffHeaders,
} from './shopper'

// Stored pincode so the first-visit pincode sheet does not cover Home.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034')))

// The demo customer's orders are read only here: 701 delivered, 702 cancelled, 703 placed (read by number and position).
const delivered = '00000000-0000-4000-8000-000000000701'
const tolerance = 0.5

type Box = { x: number; y: number; width: number; height: number }

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no box (hidden or detached)')
  return box
}

// The phone page is no wider than its viewport.
async function expectNoSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

// Every button, link and price of a card lies inside its content area (the card's box inset by its own left and right
// padding) and inside the card vertically; every button and link is at least 44 px tall.
async function expectCard(card: Locator) {
  const area = await boxOf(card)
  const padding = await card.evaluate((el) => ({
    left: parseFloat(getComputedStyle(el).paddingLeft),
    right: parseFloat(getComputedStyle(el).paddingRight),
  }))
  const left = area.x + padding.left
  const right = area.x + area.width - padding.right
  const controls = await card.locator('button, a').all()
  const parts = [...(await card.getByText(/₹/).all()), ...controls]
  for (const [index, part] of parts.entries()) {
    const box = await boxOf(part)
    const overflow = Math.max(left - box.x, box.x + box.width - right, area.y - box.y, box.y + box.height - (area.y + area.height))
    expect(overflow, `part ${index} of the card sticks out by ${overflow} px`).toBeLessThanOrEqual(tolerance)
  }
  for (const control of controls) {
    expect((await boxOf(control)).height, 'tap target height').toBeGreaterThanOrEqual(44)
  }
}

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

// Each test below places its own order for its own customer; orderPick indexes 4 to 6 are its own (0 to 3 are checkout's).
test('tracking follows the order against core', async ({ page, request }) => {
  test.slow()
  const shopper = await freshShopper(request, 'E2E Tracking')
  const pick = await orderPick(request, 4)
  const addressId = await addAddress(request, shopper)
  await fillCart(request, shopper, pick)
  const placed = await placeByApi(request, shopper, addressId)
  await signedIn(page, shopper)

  let reads = 0
  page.on('request', (outgoing) => {
    if (outgoing.method() === 'GET' && new URL(outgoing.url()).pathname === `/api/core/v1/orders/${placed.id}`) reads++
  })
  await page.goto(`/orders/${placed.id}`)
  await expect(page.getByRole('heading', { level: 1, name: `Order ${placed.number}`, exact: true })).toBeVisible()
  await expect(page.getByText('Order placed. Waiting for the store to accept it.', { exact: true })).toBeVisible()

  const staff = await staffHeaders(request)
  for (const status of ['accepted', 'packing', 'ready', 'out_for_delivery', 'delivered']) {
    const answer = await request.post(`/api/core/v1/admin/orders/${placed.id}/status`, { headers: staff, data: { status } })
    expect(answer.status()).toBe(200)
  }
  // The page changes by itself: the poll reads the order again, with no reload.
  await expect(page.getByText('Your order was delivered.', { exact: true })).toBeVisible({ timeout: 15_000 })
  const history = page.getByRole('region', { name: 'Status history', exact: true })
  await expect(history.getByRole('listitem').last().getByText('Delivered', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  // Finished: the poll has stopped, so no GET for the order in the next 11 seconds.
  const settled = reads
  await page.waitForTimeout(11_000)
  expect(reads).toBe(settled)
})

test('cancel against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Cancel')
  const pick = await orderPick(request, 5)
  const addressId = await addAddress(request, shopper)
  await fillCart(request, shopper, pick)
  const placed = await placeByApi(request, shopper, addressId)
  await signedIn(page, shopper)
  await page.goto(`/orders/${placed.id}`)

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1, name: `Order ${placed.number}`, exact: true })).toBeVisible()
  await main.getByRole('button', { name: 'Cancel order', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Cancel this order?', exact: true })
  await expect(dialog).toBeVisible()
  await expectNoViolations(page)

  await dialog.getByRole('button', { name: 'Cancel order', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(main.getByText('This order was cancelled.', { exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Cancel order', exact: true })).toHaveCount(0)
  await expectNoViolations(page)

  const answer = await request.get(`/api/core/v1/orders/${placed.id}`, { headers: shopper.headers })
  expect(((await answer.json()) as { status: string }).status).toBe('cancelled')
})

// A read-only visit: no order of the shopper's, the real 404 from core.
test('unknown order against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Unknown Order')
  await signedIn(page, shopper)
  await page.goto(`/orders/${crypto.randomUUID()}`)

  await expect(page.getByRole('heading', { level: 1, name: 'Order not found', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Your orders', exact: true })).toHaveAttribute('href', '/orders')
  await expectNoViolations(page)
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('checkout and orders on a phone', async ({ page, request }) => {
    const shopper = await freshShopper(request, 'E2E Phone')
    const pick = await orderPick(request, 6)
    const addressId = await addAddress(request, shopper)
    await fillCart(request, shopper, pick)
    await signedIn(page, shopper)

    await page.goto('/checkout')
    const addresses = page.getByRole('region', { name: 'Delivery address', exact: true })
    const summary = page.getByRole('region', { name: 'Order summary', exact: true })
    await expect(summary.getByText(pick.name, { exact: true })).toBeVisible()
    await expect(addresses.getByRole('radio', { name: 'Deliver to Home', exact: true })).toBeVisible()
    await expect(addresses.getByRole('button', { name: 'Add address', exact: true })).toBeVisible()
    await expect(summary.getByRole('button', { name: 'Edit cart', exact: true })).toBeVisible()
    await expect(summary.getByRole('button', { name: 'Place order (COD)', exact: true })).toBeVisible()
    await expectNoSideScroll(page)
    await expectCard(addresses)
    await expectCard(summary)
    await expectNoViolations(page)

    const placed = await placeByApi(request, shopper, addressId)
    await page.goto('/orders')
    const card = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: `View order ${placed.number}`, exact: true }) })
    await expect(card).toBeVisible()
    await expectNoSideScroll(page)
    await expectCard(card)
    await expectNoViolations(page)

    await page.goto(`/orders/${placed.id}`)
    await expect(page.getByRole('heading', { level: 1, name: `Order ${placed.number}`, exact: true })).toHaveCSS(
      'font-variant-numeric',
      'tabular-nums',
    )
    await expectNoSideScroll(page)
    // The status message's card holds the cancel control.
    const statusCard = page.getByRole('status').filter({ hasText: 'Order placed. Waiting for the store to accept it.' }).locator('xpath=..')
    await expect(page.getByRole('button', { name: 'Cancel order', exact: true })).toBeVisible()
    await expectCard(statusCard)
    const items = page.getByRole('region', { name: 'Items', exact: true })
    await expectCard(items)
    await expect(items.getByText('Total', { exact: true }).locator('xpath=following-sibling::dd[1]/span[1]')).toHaveCSS(
      'font-variant-numeric',
      'tabular-nums',
    )
    await expectCard(page.getByRole('region', { name: 'Delivery address', exact: true }))
    await expectNoViolations(page)
  })
})
