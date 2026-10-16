import { expect, test, type Page } from '@playwright/test'
import { addAddress, adminHeaders, cartBar, cartSheet, core, expectNoViolations, fillCart, freshShopper, guest, koramangala, openSearch, orderPick, searchFor, serverCart, signedIn } from './support'

// Checkout on the web export at 390×844, against core on 18080 (helpers from ./support). Dynamic routes
// 404 on a direct load of the static export, so /checkout is reached only through the cart sheet's "Proceed to checkout".

// Home's "View cart" bar, the cart sheet, and its "Proceed to checkout" link: the path a customer takes to /checkout.
async function proceedToCheckout(page: Page, units: number) {
  await page.goto('/')
  await cartBar(page, String(units)).click()
  const sheet = cartSheet(page)
  // The sheet's dialog role arrives after its slide, so the link is waited for on the dialog.
  await expect(sheet).toBeVisible()
  await sheet.getByRole('link', { name: 'Proceed to checkout', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
}

test('Address added at checkout against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Checkout Address')
  const pick = orderPick(2)
  await fillCart(request, shopper, pick)
  await signedIn(page, shopper)
  await proceedToCheckout(page, pick.units)

  const main = page.getByRole('main')
  await expect(main.getByText('No addresses yet', { exact: true })).toBeVisible()
  await main.getByRole('button', { name: 'Add address', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add address', exact: true })
  await expect(dialog).toBeVisible()
  await expectNoViolations(page)

  await dialog.getByLabel('House, flat, floor', { exact: true }).fill('12 80 Feet Rd, Koramangala')
  await dialog.getByLabel('Pincode', { exact: true }).fill('560034')
  await dialog.getByRole('button', { name: 'Save address', exact: true }).click()
  await expect(dialog).toBeHidden()

  await expect(main.getByText('Delivering to Home', { exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Place order', exact: true })).toBeVisible()
  await expectNoViolations(page)
})

test('Order placed against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Order Placed')
  const pick = orderPick(3)
  await addAddress(request, shopper)

  // A guest adds the product from search, then signs in from the cart sheet: the cart merges into the customer's.
  await guest(page)
  await page.goto('/')
  await openSearch(page)
  await searchFor(page, pick.name)
  await page.getByRole('button', { name: `Add ${pick.name}`, exact: true }).click()
  for (let i = 1; i < pick.units; i++) {
    await page.getByRole('button', { name: `Add one ${pick.name}`, exact: true }).click()
  }
  await expect(page.getByRole('group', { name: `Quantity of ${pick.name}`, exact: true })).toHaveText(String(pick.units))
  await cartBar(page, String(pick.units)).click()
  const sheet = cartSheet(page)
  await expect(sheet).toBeVisible()
  await sheet.getByRole('link', { name: 'Proceed to checkout', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  await page.getByLabel('Email', { exact: true }).fill(shopper.email)
  await page.getByLabel('Password', { exact: true }).fill(shopper.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)

  const main = page.getByRole('main')
  await expect(main.getByText(pick.name, { exact: true })).toBeVisible()
  await expectNoViolations(page)

  await main.getByRole('button', { name: 'Place order', exact: true }).click()
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/)
  await expect(main.getByRole('heading', { level: 1, name: /^Order SS-.{8}$/ })).toBeVisible()
  await expect(main.getByText('Order placed. Waiting for the store to accept it.', { exact: true })).toBeVisible()
  // The tracking screen draws each line as one text: "<qty> × <name>".
  await expect(main.getByText(`${pick.units} × ${pick.name}`, { exact: true })).toBeVisible()
  await expectNoViolations(page)

  expect((await serverCart(request, shopper.token)).items).toEqual([])
})

test('Out of stock at checkout against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Out Of Stock')
  const pick = orderPick(4)
  await addAddress(request, shopper)
  await fillCart(request, shopper, pick)

  // The seeded admin sets the stock to 0 once the page has loaded; the real value is read first and restored in finally.
  const staff = await adminHeaders(request)
  const stockUrl = `${core}/admin/stores/${koramangala}/stock`
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
    await proceedToCheckout(page, pick.units)
    const main = page.getByRole('main')
    await expect(main.getByText(pick.name, { exact: true })).toBeVisible()
    expect((await setStock(0)).status()).toBe(204)

    await main.getByRole('button', { name: 'Place order', exact: true }).click()
    await expect(main.getByText('Some products are not available in the quantity you chose.', { exact: true })).toBeVisible()
    await expect(main.getByText('Out of stock', { exact: true })).toBeVisible()
    await expectNoViolations(page)

    const orders = await request.get(`${core}/orders`, { headers: shopper.headers })
    expect(((await orders.json()) as { total: number }).total).toBe(0)

    await main.getByRole('button', { name: `Remove ${pick.name}`, exact: true }).click()
    await expect(main.getByText('Your cart is empty', { exact: true })).toBeVisible()
  } finally {
    expect((await setStock(original)).status()).toBe(204)
  }
})

test('Address not served against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Not Served')
  const pick = orderPick(5)
  // Indiranagar's pincode: the only address does not reach Koramangala's cart.
  await addAddress(request, shopper, 'Work', '560038')
  await fillCart(request, shopper, pick)
  await signedIn(page, shopper)
  await proceedToCheckout(page, pick.units)

  const main = page.getByRole('main')
  await expect(main.getByText('Delivering to Work', { exact: true })).toBeVisible()
  await main.getByRole('button', { name: 'Place order', exact: true }).click()
  await expect(
    main.getByText('Koramangala does not deliver to this address. Choose another address or add one.', { exact: true }),
  ).toBeVisible()
  await expect(main.getByText('Not delivered here', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  expect((await serverCart(request, shopper.token)).items).toHaveLength(1)
})
