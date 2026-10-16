import { expect, test, type APIRequestContext } from '@playwright/test'
import { adminHeaders, cartBar, cartSheet, core, expectNoViolations, freshShopper, guest, guestCartKey, homePicks, indiranagar, koramangala, pincodeSheet, quantityOf, savePincode, section, serverCart, signedIn } from './support'

// The cart on the web export at 390×844, against core on 18080 (helpers from ./support). Dynamic routes
// 404 on a direct load of the static export, so /product/<slug> is reached only by in-app navigation.

test('Guest cart against core', async ({ page }) => {
  const [first, second] = homePicks(2)
  expect(second).toBeDefined()
  await guest(page)

  await page.goto('/')
  await page.getByRole('button', { name: `Add ${first}`, exact: true }).click()
  await page.getByRole('button', { name: `Add ${second}`, exact: true }).click()
  await page.getByRole('button', { name: `Add one ${first}`, exact: true }).click()
  await expect(quantityOf(page, first)).toHaveText('2')
  await expect(cartBar(page, '3')).toBeVisible()

  await page.reload()
  await expect(cartBar(page, '3')).toBeVisible()
  await expectNoViolations(page)

  await cartBar(page, '3').click()
  const sheet = cartSheet(page)
  await expect(sheet).toBeVisible()
  await expect(quantityOf(page, first).first()).toBeVisible()
  await expect(sheet.getByRole('link', { name: 'Proceed to checkout', exact: true })).toBeVisible()
  await expectNoViolations(page)

  await sheet.getByRole('button', { name: `Remove one ${first}`, exact: true }).click()
  await sheet.getByRole('button', { name: `Remove one ${first}`, exact: true }).click()
  await sheet.getByRole('button', { name: `Remove one ${second}`, exact: true }).click()
  await expect(sheet.getByText('Your cart is empty', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  await sheet.getByRole('button', { name: 'Close sheet', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(cartBar(page, '3')).toHaveCount(0)
})

test('Quick taps against core', async ({ page, request }) => {
  const [name] = homePicks(3)
  expect(name).toBeDefined()
  const shopper = await freshShopper(request, 'E2E Quick Taps')
  await signedIn(page, shopper)

  // Core's first answer is held back; the later taps must not overtake it on the wire.
  let held = false
  await page.route('**/api/core/v1/me/cart/items', async (route) => {
    if (!held) {
      held = true
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
    await route.continue()
  })

  await page.goto('/')
  const picks = section(page, 'Picked for you')
  await picks.getByRole('button', { name: `Add ${name}`, exact: true }).click()
  await picks.getByRole('button', { name: `Add one ${name}`, exact: true }).click()
  await picks.getByRole('button', { name: `Add one ${name}`, exact: true }).click()
  await picks.getByRole('button', { name: `Remove one ${name}`, exact: true }).click()
  await expect(quantityOf(page, name).first()).toHaveText('2')

  await expect
    .poll(async () => (await serverCart(request, shopper.token)).items.find((line) => line.product.name === name)?.quantity)
    .toBe(2)
  await expectNoViolations(page)
})

test('Merge at sign-in against core', async ({ page, request }) => {
  const [first, second] = homePicks(2)
  expect(second).toBeDefined()
  const shopper = await freshShopper(request, 'E2E Cart Merge')
  await guest(page)

  await page.goto('/')
  await page.getByRole('button', { name: `Add ${first}`, exact: true }).click()
  await page.getByRole('button', { name: `Add one ${first}`, exact: true }).click()
  await page.getByRole('button', { name: `Add ${second}`, exact: true }).click()
  await expect(quantityOf(page, first)).toHaveText('2')

  await page.getByRole('button', { name: 'Delivering to 560034, Bengaluru', exact: true }).click()
  await expect(pincodeSheet(page)).toBeVisible()
  await page.getByRole('link', { name: /^Have an account\?/ }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  await page.getByLabel('Email', { exact: true }).fill(shopper.email)
  await page.getByLabel('Password', { exact: true }).fill(shopper.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  await expect(quantityOf(page, first)).toHaveText('2')
  await expect(quantityOf(page, second)).toHaveText('1')
  expect(await page.evaluate((key) => localStorage.getItem(key), guestCartKey)).toBeNull()
  await expectNoViolations(page)
})

test('Clamp against core', async ({ page, request }) => {
  // A Home pick with a stock of at least 2: its product screen is opened from Home, so no search screen (L2's, not axe-clean) is visited.
  const [name] = homePicks(2)
  expect(name).toBeDefined()
  const target = await listedProduct(request, koramangala, name!)

  // The seeded demo admin changes the stock; the real value is read first and restored in finally.
  const staff = await adminHeaders(request)
  const stockUrl = `${core}/admin/stores/${koramangala}/stock`
  const stock = await request.get(`${stockUrl}?q=${encodeURIComponent(name)}&pageSize=100`, { headers: staff })
  expect(stock.status()).toBe(200)
  const row = ((await stock.json()) as { items: { productId: string; quantity: number }[] }).items.find(
    (item) => item.productId === target.id,
  )
  if (!row) throw new Error(`no stock row for ${name}`)
  const original = row.quantity
  const setStock = (quantity: number) =>
    request.put(stockUrl, { headers: staff, data: { rows: [{ productId: target.id, quantity }] } })

  const shopper = await freshShopper(request, 'E2E Clamp')
  const seeded = await request.put(`${core}/me/cart/items`, {
    headers: shopper.headers,
    data: { storeId: koramangala, productId: target.id, quantity: 2 },
  })
  expect(seeded.status()).toBe(200)
  await signedIn(page, shopper)

  try {
    await page.goto('/')
    await expect(section(page, 'Picked for you').getByRole('button', { name: `Add one ${name}`, exact: true })).toBeVisible()
    await page.locator(`a[href="/product/${target.slug}"]:visible`).click()
    await expect(page).toHaveURL(new RegExp(`/product/${target.slug}$`))
    await expect(quantityOf(page, name)).toContainText('2')

    // The customer has 2 and the page is open; the stock drops to 1, so "Add one" is cut to 1.
    expect((await setStock(1)).status()).toBe(204)
    await page.getByRole('button', { name: `Add one ${name}`, exact: true }).click()
    await expect(quantityOf(page, name)).toContainText('1')
    await expectNoViolations(page)

    await page.goBack()
    await cartBar(page, '1').click()
    const sheet = cartSheet(page)
    await expect(sheet.getByText('Some quantities were lowered to what the store has.', { exact: true })).toBeVisible()
    await expectNoViolations(page)
  } finally {
    expect((await setStock(original)).status()).toBe(204)
  }
})

test('Server store change against core', async ({ page, request }) => {
  const [name] = homePicks(1)
  const shopper = await freshShopper(request, 'E2E Store Change')
  await signedIn(page, shopper)

  await page.goto('/')
  await page.getByRole('button', { name: `Add ${name}`, exact: true }).click()
  await expect(cartBar(page, '1')).toBeVisible()

  // A cart switch the customer has to confirm: the pincode sheet, then the dialog's "Switch store".
  await page.getByRole('button', { name: 'Delivering to 560034, Bengaluru', exact: true }).click()
  await savePincode(page, '560038')
  const switching = page.getByRole('dialog', { name: /^Switch to the / })
  await expect(switching).toBeVisible()
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Switch store', exact: true }).click()
  await expect(switching).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delivering to 560038, Bengaluru', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^View cart/ })).toHaveCount(0)
  await expect.poll(async () => (await serverCart(request, shopper.token)).items.length).toBe(0)
  await expectNoViolations(page)
})

test('Replaced notice against core', async ({ page, request }) => {
  const [atKoramangala] = homePicks(1, koramangala)
  const [atIndiranagar] = homePicks(1, indiranagar)
  expect(atKoramangala).toBeDefined()
  expect(atIndiranagar).toBeDefined()
  const shopper = await freshShopper(request, 'E2E Replaced')
  const seeded = await request.put(`${core}/me/cart/items`, {
    headers: shopper.headers,
    data: { storeId: koramangala, productId: (await listedProduct(request, koramangala, atKoramangala!)).id, quantity: 1 },
  })
  expect(seeded.status()).toBe(200)
  await signedIn(page, shopper, '560038')

  const notice = 'Your cart from Koramangala was replaced. A cart holds products from one store.'
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Delivering to 560038, Bengaluru', exact: true })).toBeVisible()
  await expect(cartBar(page, '1')).toBeVisible()
  const picks = section(page, 'Picked for you')
  await picks.getByRole('button', { name: `Add ${atIndiranagar}`, exact: true }).click()

  const sheet = cartSheet(page)
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText(notice, { exact: true })).toBeVisible()
  await expectNoViolations(page)

  // A tap on the scrim above the panel closes it: the panel covers the scrim's centre, where Playwright would click.
  await sheet.getByRole('button', { name: 'Close sheet', exact: true }).click({ position: { x: 4, y: 4 } })
  await expect(sheet).toBeHidden()
  await expect(cartBar(page, '1')).toBeVisible()
  await expect(page.getByText(notice, { exact: true })).toBeVisible()
  await expectNoViolations(page)
})

// The listed product of a name at a store (page one, as Home reads it): its id and slug.
async function listedProduct(request: APIRequestContext, storeId: string, name: string): Promise<{ id: string; slug: string }> {
  const listed = await request.get(`${core}/stores/${storeId}/products?pageSize=24`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as { items: { id: string; name: string; slug: string }[] }
  const found = items.find((item) => item.name === name)
  if (!found) throw new Error(`no product ${name} at ${storeId}`)
  return found
}
