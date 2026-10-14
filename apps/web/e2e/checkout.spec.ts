import { expect, test } from '@playwright/test'
import {
  addAddress,
  expectNoViolations,
  fillCart,
  freshShopper,
  koramangala,
  orderPick,
  signedIn,
  staffHeaders,
} from './shopper'

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

// Each test places its own order for its own customer; the stock index is its own (0 is the address test above).
test('order placed against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Order Placed')
  const pick = await orderPick(request, 1)
  await addAddress(request, shopper)

  // A guest adds the product to the cart, then signs in from the drawer: the cart merges into the customer's.
  await page.goto(`/search?q=${encodeURIComponent(pick.name)}`)
  await page.getByRole('button', { name: `Add ${pick.name}`, exact: true }).click()
  for (let i = 1; i < pick.units; i++) {
    await page.getByRole('button', { name: `Add one ${pick.name}`, exact: true }).click()
  }
  await expect(page.getByRole('group', { name: `Quantity of ${pick.name}`, exact: true })).toHaveText(String(pick.units))
  await page.getByRole('banner').getByRole('button', { name: new RegExp(`^${pick.units} items?`) }).click()
  await page.getByRole('dialog', { name: 'Your cart', exact: true }).getByRole('link', { name: 'Proceed to checkout', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(shopper.email)
  await page.getByLabel('Password', { exact: true }).fill(shopper.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)

  const summary = page.getByRole('region', { name: 'Order summary', exact: true })
  await expect(summary.getByText(pick.name, { exact: true })).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Place order (COD)', exact: true }).click()

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Order SS-\w{8}$/)
  await expect(page.getByText('Order placed. Waiting for the store to accept it.', { exact: true })).toBeVisible()
  await expect(page.getByRole('main').getByText(pick.name, { exact: true })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('button', { name: 'Cart', exact: true })).toBeVisible()
  await expectNoViolations(page)

  const cart = await request.get('/api/core/v1/me/cart', { headers: shopper.headers })
  expect(((await cart.json()) as { items: unknown[] }).items).toEqual([])
})

test('out of stock at checkout against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Out Of Stock')
  const pick = await orderPick(request, 2)
  await addAddress(request, shopper)
  await fillCart(request, shopper, pick)

  // The seeded admin sets the stock to 0 once the page has loaded; the real value is read first and restored in finally.
  const staff = await staffHeaders(request)
  const stockUrl = `/api/core/v1/admin/stores/${koramangala}/stock`
  const stock = await request.get(`${stockUrl}?q=${encodeURIComponent(pick.name)}&pageSize=100`, { headers: staff })
  expect(stock.status()).toBe(200)
  const row = ((await stock.json()) as { items: { productId: string; quantity: number }[] }).items.find(
    (item) => item.productId === pick.id,
  )
  if (!row) throw new Error(`no stock row for ${pick.name}`)
  const original = row.quantity
  const setStock = (quantity: number) =>
    request.put(stockUrl, { headers: staff, data: { rows: [{ productId: pick.id, quantity }] } })

  try {
    await signedIn(page, shopper)
    await page.goto('/checkout')
    const summary = page.getByRole('region', { name: 'Order summary', exact: true })
    await expect(summary.getByText(pick.name, { exact: true })).toBeVisible()
    expect((await setStock(0)).status()).toBe(204)

    await page.getByRole('button', { name: 'Place order (COD)', exact: true }).click()
    await expect(page.getByText('Some products are not available in the quantity you chose.', { exact: true })).toBeVisible()
    await expect(summary.getByText('Out of stock', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/checkout$/)
    await expectNoViolations(page)

    const orders = await request.get('/api/core/v1/orders', { headers: shopper.headers })
    expect(((await orders.json()) as { total: number }).total).toBe(0)

    await summary.getByRole('button', { name: `Remove ${pick.name}`, exact: true }).click()
    await expect(page.getByText('Your cart is empty', { exact: true })).toBeVisible()
  } finally {
    expect((await setStock(original)).status()).toBe(204)
  }
})

test('address not served against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Not Served')
  const pick = await orderPick(request, 3)
  await addAddress(request, shopper, '560038', 'Work')
  await fillCart(request, shopper, pick)
  await signedIn(page, shopper)

  await page.goto('/checkout')
  const addresses = page.getByRole('region', { name: 'Delivery address', exact: true })
  await expect(addresses.getByRole('button', { name: 'Deliver to Work', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Place order (COD)', exact: true }).click()

  await expect(
    page.getByText('Koramangala does not deliver to this address. Choose another address or add one.', { exact: true }),
  ).toBeVisible()
  await expect(addresses.getByText('Not delivered here', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Order summary', exact: true }).getByText(pick.name, { exact: true })).toBeVisible()
  await expectNoViolations(page)

  const cart = await request.get('/api/core/v1/me/cart', { headers: shopper.headers })
  expect(((await cart.json()) as { items: unknown[] }).items).toHaveLength(1)
})
