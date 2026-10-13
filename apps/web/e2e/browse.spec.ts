import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const admin = { email: 'admin@shopperstop.local', password: 'admin12345' }
const closedPincode = '560076'
const closedName = 'E2E Closed'

function sheet(page: Page) {
  return page.getByRole('dialog', { name: 'Your delivery pincode' })
}

async function savePincode(page: Page, pincode: string) {
  await page.getByLabel('Pincode', { exact: true }).fill(pincode)
  await page.getByRole('button', { name: 'Save pincode' }).click()
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

// Core answers 200 for a closed store's pincode too, so a re-run without a reset finds it and creates nothing.
async function ensureClosedStore(request: APIRequestContext) {
  const served = await request.get(`/api/core/v1/serviceability?pincode=${closedPincode}`)
  if (served.status() === 200) return
  expect(served.status()).toBe(404)
  const signIn = await request.post('/api/core/v1/admin/auth/sign-in', { data: admin })
  expect(signIn.status()).toBe(200)
  const headers = { Authorization: `Bearer ${(await signIn.json()).token}` }
  const created = await request.post('/api/core/v1/admin/stores', {
    headers,
    data: { name: closedName, addressLine: '1 Test Rd', pincode: closedPincode, promisedMinutes: 15 },
  })
  expect(created.status()).toBe(201)
  const { id } = await created.json()
  const areas = await request.put(`/api/core/v1/admin/stores/${id}/service-areas`, {
    headers,
    data: { pincodes: [closedPincode] },
  })
  expect(areas.status()).toBe(200)
}

test('pincode resolves against core', async ({ page }) => {
  await page.goto('/')
  await expect(sheet(page)).toBeVisible()
  await savePincode(page, '560034')
  await expect(sheet(page)).toHaveCount(0)
  const promise = page.getByRole('button', { name: 'Delivery in 10 minutes 560034' })
  await expect(promise).toBeVisible()
  await expectNoViolations(page)

  await page.reload()
  await expect(promise).toBeVisible()
  await expect(sheet(page)).toHaveCount(0)
  await expectNoViolations(page)

  await promise.click()
  await expect(sheet(page)).toBeVisible()
  await expectNoViolations(page)
})

test('notices against core', async ({ page, request }) => {
  await ensureClosedStore(request)
  await page.goto('/')
  await savePincode(page, '110001')
  await expect(page.getByRole('heading', { level: 2, name: 'We do not deliver to 110001 yet' })).toBeVisible()
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Change pincode' }).click()
  await savePincode(page, closedPincode)
  await expect(page.getByRole('heading', { level: 2, name: `${closedName} is closed right now` })).toBeVisible()
  await expectNoViolations(page)
})

test('home against core', async ({ page }) => {
  await page.goto('/')
  await savePincode(page, '560034')
  const picked = page.getByRole('region', { name: 'Picked for you' })
  await expect(picked.getByRole('link')).toHaveCount(12)
  const shop = page.getByRole('region', { name: 'Shop by category' })
  await expect(shop.getByRole('link', { name: 'Fruits & Vegetables' })).toHaveAttribute('href', '/c/fruits-vegetables')
  await expectNoViolations(page)
})
