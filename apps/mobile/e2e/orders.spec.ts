import { expect, test, type APIRequestContext } from '@playwright/test'
import { addAddress, core, expectNoViolations, fillCart, freshShopper, orderPick, type Shopper, signedIn, staffHeaders } from './support'

// The order screens on the web export at 390×844, against core on 18080 (helpers from ./support).
const delivered = '00000000-0000-4000-8000-000000000701'

// The demo customer, read only here: 701 delivered, 702 cancelled, 703 placed (globalSetup reseeds before the run).
async function demoShopper(request: APIRequestContext): Promise<Shopper> {
  const answer = await request.post(`${core}/auth/sign-in`, { data: { email: 'demo@shopperstop.local', password: 'demo12345' } })
  expect(answer.status()).toBe(200)
  const { token } = (await answer.json()) as { token: string }
  return { token, headers: { Authorization: `Bearer ${token}` }, email: 'demo@shopperstop.local', password: 'demo12345' }
}

async function placeByApi(request: APIRequestContext, shopper: Shopper): Promise<{ id: string; number: string }> {
  const addresses = await request.get(`${core}/me/addresses`, { headers: shopper.headers })
  const { items } = (await addresses.json()) as { items: { id: string }[] }
  const answer = await request.post(`${core}/orders`, { headers: shopper.headers, data: { addressId: items[0]!.id } })
  expect(answer.status()).toBe(201)
  const { id, number } = (await answer.json()) as { id: string; number: string }
  return { id, number }
}

test('History and a delivered order against core', async ({ page, request }) => {
  const shopper = await demoShopper(request)
  await signedIn(page, shopper)
  await page.goto('/')
  await page.getByRole('tab', { name: 'Orders', exact: true }).click()

  await expect(page.getByRole('link', { name: /^View order SS-DEMOAAA[BCD],/ })).toHaveCount(3)
  await expect(page.getByRole('link', { name: /^View order SS-DEMOAAAD,/ })).toContainText('Placed')
  await expect(page.getByRole('link', { name: /^View order SS-DEMOAAAC,/ })).toContainText('Cancelled')
  await expect(page.getByRole('link', { name: /^View order SS-DEMOAAAB,/ })).toContainText('Delivered')
  await expectNoViolations(page)

  await page.getByRole('link', { name: /^View order SS-DEMOAAAB,/ }).click()
  await expect(page).toHaveURL(new RegExp(`/orders/${delivered}$`))
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1, name: 'Order SS-DEMOAAAB', exact: true })).toBeVisible()
  await expect(main.getByText('Delivered', { exact: true }).first()).toBeVisible()
  await expect(main.getByText('Your order was delivered.', { exact: true })).toBeVisible()
  await expect(main.getByText('Out for delivery', { exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { level: 2, name: 'Your rider', exact: true })).toBeVisible()
  await expect(main.getByText('Arjun Rao', { exact: true })).toBeVisible()
  await expect(main.getByText('Open in Maps', { exact: true })).toHaveCount(0)
  await expectNoViolations(page)
})

test('Tracking follows the order against core', async ({ page, request }) => {
  test.slow()
  const shopper = await freshShopper(request, 'E2E Tracking')
  const pick = orderPick(0)
  await addAddress(request, shopper)
  await fillCart(request, shopper, pick)
  const placed = await placeByApi(request, shopper)
  await signedIn(page, shopper)

  await page.goto('/')
  await page.getByRole('tab', { name: 'Orders', exact: true }).click()
  await page.getByRole('link', { name: new RegExp(`^View order ${placed.number},`) }).click()
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1, name: `Order ${placed.number}`, exact: true })).toBeVisible()
  await expect(main.getByText(/^Arriving in \d+ min$/)).toBeVisible()
  await expect(main.getByText('Order placed. Waiting for the store to accept it.', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  const staff = await staffHeaders(request)
  for (const status of ['accepted', 'packing', 'ready', 'out_for_delivery', 'delivered']) {
    const answer = await request.post(`${core}/admin/orders/${placed.id}/status`, { headers: staff, data: { status } })
    expect(answer.status()).toBe(200)
  }
  // The screen changes by itself: the poll reads the order again, with no reload.
  await expect(main.getByText('Your order was delivered.', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(main.getByText('Delivered', { exact: true }).first()).toBeVisible()
  await expectNoViolations(page)
})

test('Cancel against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Cancel')
  const pick = orderPick(1)
  await addAddress(request, shopper)
  await fillCart(request, shopper, pick)
  const placed = await placeByApi(request, shopper)
  await signedIn(page, shopper)

  await page.goto('/')
  await page.getByRole('tab', { name: 'Orders', exact: true }).click()
  await page.getByRole('link', { name: new RegExp(`^View order ${placed.number},`) }).click()
  await expect(page).toHaveURL(new RegExp(`/orders/${placed.id}$`))
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1, name: `Order ${placed.number}`, exact: true })).toBeVisible()

  await main.getByRole('button', { name: 'Cancel order', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Cancel this order?', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  await dialog.getByRole('button', { name: 'Ordered by mistake', exact: true }).click()
  await dialog.getByRole('button', { name: 'Cancel order', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(main.getByText('This order was cancelled. Reason: Ordered by mistake', { exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Cancel order', exact: true })).toHaveCount(0)
  await expectNoViolations(page)

  const answer = await request.get(`${core}/orders/${placed.id}`, { headers: shopper.headers })
  const order = (await answer.json()) as { status: string; cancelReason?: string }
  expect(order.status).toBe('cancelled')
  expect(order.cancelReason).toBe('Ordered by mistake')
})
