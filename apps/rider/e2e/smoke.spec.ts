import { expect, test } from '@playwright/test'
import { asRider, expectNoViolations, riderToken } from './helpers'

const riderEmail = 'rider1-koramangala@shopperstop.local'
const riderPassword = 'rider12345'

test('built app opens under the prefix', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveURL(/\/rider\/sign-in\?redirect=%2F$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in', exact: true })).toBeVisible()
  // The build's own stylesheet, served under the prefix.
  const hrefs = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(hrefs.length).toBeGreaterThan(0)
  for (const href of hrefs) expect(href).toMatch(/^\/rider\/assets\//)
})

test('preview proxies both services', async ({ request }) => {
  for (const service of ['core', 'rider']) {
    const answer = await request.get(`http://localhost:15175/api/${service}/v1/healthz`)
    expect(answer.status()).toBe(200)
    expect(await answer.json()).toEqual({ status: 'ok' })
  }
})

test('smoke pages pass axe', async ({ page }) => {
  await page.goto('./sign-in')
  await expectNoViolations(page)

  // The UI sign-in: once per rider per run (the sign-in budget).
  await page.getByLabel('Email', { exact: true }).fill(riderEmail)
  await page.getByLabel('Password', { exact: true }).fill(riderPassword)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/rider\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Ready to pick up', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pick up', exact: true })).toHaveAttribute('href', '/rider/')
  await expectNoViolations(page)

  await page.getByRole('navigation', { name: 'Rider', exact: true }).getByRole('link', { name: 'History', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'History', exact: true })).toBeVisible()
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/rider\/sign-in$/)
  await expectNoViolations(page)

  await page.goto('./nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found', exact: true })).toBeVisible()
  await expectNoViolations(page)
})

test('suite seeds its own data', async ({ page, request }) => {
  await asRider(page, await riderToken(request, riderEmail, riderPassword))
  await page.goto('./history')
  const history = page.getByRole('table', { name: 'Delivered deliveries', exact: true })
  await expect(history.getByRole('link', { name: 'SS-DEMOAAAB', exact: true })).toBeVisible()
  await expectNoViolations(page)
})
