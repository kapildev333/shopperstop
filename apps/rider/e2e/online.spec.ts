import { expect, test } from '@playwright/test'
import { addAddress, asRider, expectNoViolations, fillCart, freshShopper, indiranagar, placeByApi, riderToken, staffHeaders, storePick } from './helpers'

// Dispatch at Indiranagar, which no other rider spec uses (design.md Decision 12): the dispatcher works per store, so
// the Koramangala specs running in parallel can never be offered this order, and their riders never go online.
const riderEmail = 'rider1-indiranagar@shopperstop.local'
const riderPassword = 'rider12345'
const staffEmail = 'indiranagar@shopperstop.local'
const storeLocation = { latitude: 12.9719, longitude: 77.6412 } // core's seed for Indiranagar

test('online rider offered a readied order', async ({ page, context, request }) => {
  test.slow()
  const token = await riderToken(request, riderEmail, riderPassword)
  const auth = { Authorization: `Bearer ${token}` }
  await context.setGeolocation(storeLocation)
  await asRider(page, token)
  try {
    // Offline to start: the badge and the toggle.
    await page.goto('./')
    const banner = page.getByRole('banner')
    await expect(banner.getByText('Offline', { exact: true })).toBeVisible()
    const goOnline = banner.getByRole('button', { name: 'Go online', exact: true })
    await expect(goOnline).not.toHaveAttribute('aria-pressed')
    await expectNoViolations(page)

    // Online: the app reports the store's position.
    await goOnline.click()
    await expect(banner.getByText('Online', { exact: true })).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Go offline', exact: true })).not.toHaveAttribute('aria-pressed')
    await expectNoViolations(page)

    // The staff ready a new order at Indiranagar.
    const shopper = await freshShopper(request, 'E2E Dispatch Customer')
    const addressId = await addAddress(request, shopper, '560038', '100 Feet Rd, Indiranagar')
    await fillCart(request, shopper, await storePick(request, indiranagar), indiranagar)
    const order = await placeByApi(request, shopper, addressId)
    const staff = await staffHeaders(request, staffEmail)
    for (const status of ['accepted', 'packing', 'ready']) {
      const answer = await request.post(`/api/core/v1/admin/orders/${order.id}/status`, { headers: staff, data: { status } })
      expect(answer.status()).toBe(200)
    }

    // The offer opens within 10 seconds (one 3 s tick plus one 3 s poll), with axe.
    const sheet = page.getByRole('dialog', { name: `New order ${order.number}`, exact: true })
    await expect(sheet).toBeVisible({ timeout: 10_000 })
    await expect(sheet.getByText('Cash', { exact: true })).toBeVisible()
    await expect(sheet.getByText('560038')).toBeVisible()
    await expectNoViolations(page)

    // Accept lands on the delivery page; deliver it.
    await sheet.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(page).toHaveURL(/\/rider\/deliveries\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { level: 1, name: `Order ${order.number}`, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Mark delivered', exact: true }).click()
    const delivered = page.getByRole('dialog', { name: `Mark ${order.number} delivered?`, exact: true })
    await delivered.getByRole('button', { name: 'Mark delivered', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: `${order.number} delivered.` })).toBeVisible()

    // Go offline from the banner; the service agrees.
    await banner.getByRole('button', { name: 'Go offline', exact: true }).click()
    await expect(banner.getByText('Offline', { exact: true })).toBeVisible()
    const me = await request.get('/api/rider/v1/me', { headers: auth })
    expect(((await me.json()) as { isOnline: boolean }).isOnline).toBe(false)
  } finally {
    // Never leave a rider online for a later spec or suite, whatever failed above.
    await request.put('/api/rider/v1/me/availability', { headers: auth, data: { online: false } })
  }
})
