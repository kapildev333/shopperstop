import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { admin, core, expectNoViolations, koramangala, openSearch, pincodeSheet, savePincode, searchFor, section } from './support'

// The catalog screens on the web export at 390×844, against core on 18080. Dynamic routes 404 on a direct load of the static export, so
// /category/<slug> and /product/<slug> are reached only by in-app navigation.
const closedPincode = '560076'
const closedName = 'E2E Closed'

// Every visible product link: the screens under the one shown stay mounted at 0×0 (Home's picks, for one).
function productLinks(page: Page): Locator {
  return page.locator('a[href^="/product/"]:visible')
}

// Core answers 200 for a closed store's pincode too, so a re-run without a reset finds it and creates nothing.
async function ensureClosedStore(request: APIRequestContext) {
  const served = await request.get(`${core}/serviceability?pincode=${closedPincode}`)
  if (served.status() === 200) return
  expect(served.status()).toBe(404)
  const signIn = await request.post(`${core}/admin/auth/sign-in`, { data: admin })
  expect(signIn.status()).toBe(200)
  const headers = { Authorization: `Bearer ${(await signIn.json()).token}` }
  const created = await request.post(`${core}/admin/stores`, {
    headers,
    data: { name: closedName, addressLine: '1 Test Rd', pincode: closedPincode, promisedMinutes: 15 },
  })
  expect(created.status()).toBe(201)
  const { id } = await created.json()
  const areas = await request.put(`${core}/admin/stores/${id}/service-areas`, { headers, data: { pincodes: [closedPincode] } })
  expect(areas.status()).toBe(200)
}

test('pincode resolves against core', async ({ page }) => {
  await page.goto('/')
  await savePincode(page, '560034')
  await expect(pincodeSheet(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'ShopperStop in 10 minutes', exact: true })).toBeVisible()
  const pincode = page.getByRole('button', { name: 'Delivering to 560034, Bengaluru', exact: true })
  await expect(pincode).toBeVisible()
  await expectNoViolations(page)

  await page.reload()
  await expect(pincode).toBeVisible()
  await expect(pincodeSheet(page)).toHaveCount(0)
  await expectNoViolations(page)

  await pincode.click()
  await expect(pincodeSheet(page)).toBeVisible()
  await expectNoViolations(page)
})

test('notices against core', async ({ page, request }) => {
  await ensureClosedStore(request)
  await page.goto('/')
  await savePincode(page, '110001')
  await expect(page.getByRole('heading', { level: 2, name: "We don't deliver here yet", exact: true })).toBeVisible()
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Change pincode', exact: true }).click()
  await savePincode(page, closedPincode)
  await expect(page.getByRole('heading', { level: 2, name: `${closedName} store is closed`, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'See your orders', exact: true })).toBeVisible()
  await expectNoViolations(page)
})

test('home against core', async ({ page }) => {
  await page.goto('/')
  await savePincode(page, '560034')
  await expect(section(page, 'Picked for you').getByRole('link')).toHaveCount(12)
  await expect(section(page, 'Shop by category').getByRole('link', { name: 'Fruits & Vegetables', exact: true })).toBeVisible()
  await expectNoViolations(page)
})

test('browse a category against core', async ({ page }) => {
  await page.goto('/')
  await savePincode(page, '560034')
  await page.getByRole('link', { name: 'Dairy, Bread & Eggs', exact: true }).click()
  await expect(page).toHaveURL(/\/category\/dairy-bread-eggs$/)
  await expect(productLinks(page).first()).toBeVisible()
  await expectNoViolations(page)

  await page.getByRole('tab', { name: 'Milk', exact: true }).click()
  await expect(page).toHaveURL(/\/category\/milk$/)
  await expect(productLinks(page).first()).toBeVisible()
  await expectNoViolations(page)
})

test('search and load more against core', async ({ page }) => {
  await page.goto('/')
  await savePincode(page, '560034')
  await openSearch(page)
  await searchFor(page, 'banana')
  await expect(page.getByRole('link', { name: /^Banana Robusta /, exact: false })).toBeVisible()

  await searchFor(page, 'a')
  await expect(productLinks(page).first()).toBeVisible()
  await page.getByRole('button', { name: 'Load more', exact: true }).click()
  await expect.poll(() => productLinks(page).count()).toBeGreaterThan(24)
  await expectNoViolations(page)
})

test('product pages against core', async ({ page, request }) => {
  const listed = await request.get(`${core}/stores/${koramangala}/products?pageSize=100`)
  expect(listed.status()).toBe(200)
  const { items } = (await listed.json()) as { items: { slug: string; name: string; inStock: boolean }[] }
  const outOfStock = items.find((item) => !item.inStock)
  if (!outOfStock) throw new Error('the demo store holds no out-of-stock product on page one')

  await page.goto('/')
  await savePincode(page, '560034')
  await openSearch(page)
  await searchFor(page, 'banana')
  await page.getByRole('link', { name: /^Banana Robusta /, exact: false }).click()
  await expect(page).toHaveURL(/\/product\/banana-robusta$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Banana Robusta', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Banana Robusta', exact: true })).toBeEnabled()
  await expectNoViolations(page)

  await page.goBack()
  await searchFor(page, outOfStock.name)
  await page.locator(`a[href="/product/${outOfStock.slug}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/product/${outOfStock.slug}$`))
  await expect(page.getByRole('heading', { level: 1, name: outOfStock.name, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Out of stock', exact: true })).toBeDisabled()
  await expectNoViolations(page)
})

test('category filters against core', async ({ page }) => {
  await page.goto('/')
  await savePincode(page, '560034')
  await page.getByRole('link', { name: 'Dairy, Bread & Eggs', exact: true }).click()
  await expect(productLinks(page).first()).toBeVisible()

  await page.getByRole('button', { name: 'In stock', exact: true }).click()
  await page.getByRole('button', { name: 'Price: low to high', exact: true }).click()
  await expect(productLinks(page).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Out of stock', exact: true })).toHaveCount(0)

  // The rupee texts on screen that are not an MRP (the MRP carries an "MRP …" label); screens under this one sit at 0×0.
  const prices = await page.evaluate(() =>
    Array.from(document.querySelectorAll('div,span'))
      .filter((el) => el.children.length === 0 && el.getBoundingClientRect().width > 0 && /^₹[\d,]+(\.\d+)?$/.test(el.textContent ?? '') && !(el.getAttribute('aria-label') ?? '').startsWith('MRP'))
      .map((el) => Number((el.textContent ?? '').replace(/[₹,]/g, ''))),
  )
  expect(prices.length).toBeGreaterThanOrEqual(2)
  expect(prices[0]).toBeLessThanOrEqual(prices[1]!)
  await expectNoViolations(page)
})

test('store change against core', async ({ page }) => {
  await page.goto('/')
  await savePincode(page, '560034')
  const picks = section(page, 'Picked for you')
  await picks.getByRole('button', { name: /^Add / }).first().click()
  await expect(picks.getByRole('group', { name: /^Quantity of / }).first()).toBeVisible()

  // The first switch offers the change; "Keep cart" keeps the pincode and the count.
  await page.getByRole('button', { name: 'Delivering to 560034, Bengaluru', exact: true }).click()
  await savePincode(page, '560038')
  await expect(page.getByRole('dialog', { name: 'Switch to the Indiranagar store?', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Keep cart', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Switch to the Indiranagar store?', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delivering to 560034, Bengaluru', exact: true })).toBeVisible()
  await expect(picks.getByRole('group', { name: /^Quantity of / }).first()).toContainText('1')

  // Again, and this time the switch empties the cart and stores the new pincode.
  await page.getByRole('button', { name: 'Delivering to 560034, Bengaluru', exact: true }).click()
  await savePincode(page, '560038')
  const switching = page.getByRole('dialog', { name: 'Switch to the Indiranagar store?', exact: true })
  await expect(switching).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Switch store', exact: true }).click()
  await expect(switching).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'ShopperStop in 12 minutes', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delivering to 560038, Bengaluru', exact: true })).toBeVisible()
  await expectNoViolations(page)
})
