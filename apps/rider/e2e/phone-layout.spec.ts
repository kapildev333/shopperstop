import { expect, test, type Page } from '@playwright/test'
import { asRider, expectNoViolations, readyOrder, riderToken, staffHeaders } from './helpers'

const riderEmail = 'rider1-koramangala@shopperstop.local'
const riderPassword = 'rider12345'
// The phone layout's pick index (design Decision 19).
const pickIndex = 1

// The page fits the 390 px width, and every visible button and button-styled link is at least 44 px tall.
// A link counts as button-styled when it is not inline (Tailwind's inline-flex, block and the like); text links stay inline.
async function expectFitsPhone(page: Page) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(390)
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button, a[href]'))
      .filter((element) => element.tagName === 'BUTTON' || getComputedStyle(element).display !== 'inline')
      .filter((element) => {
        const box = element.getBoundingClientRect()
        return box.width > 0 && box.height > 0
      })
      .map((element) => ({ text: element.textContent?.trim() ?? '', height: element.getBoundingClientRect().height }))
      .filter((target) => target.height < 44),
  )
  // Compared unrounded (43.5 px fails); rounded only here, so the failure text reads in whole pixels.
  expect(small.map((target) => ({ text: target.text, height: Math.round(target.height) }))).toEqual([])
  await expectNoViolations(page)
}

test('pages fit a phone', async ({ page, request }) => {
  await page.goto('./sign-in')
  await expectFitsPhone(page)

  const order = await readyOrder(request, await staffHeaders(request), pickIndex)
  await asRider(page, await riderToken(request, riderEmail, riderPassword))

  await page.goto('./')
  const card = page.getByRole('list', { name: 'Ready orders', exact: true }).getByRole('listitem').filter({ hasText: order.number })
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expectFitsPhone(page)

  await card.getByRole('button', { name: `Pick up ${order.number}`, exact: true }).click()
  await page.getByRole('dialog', { name: `Pick up ${order.number}?`, exact: true }).getByRole('button', { name: 'Pick up', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Order ${order.number}`, exact: true })).toBeVisible()
  await expectFitsPhone(page)

  await page.goto('./history')
  await expect(page.getByRole('heading', { level: 1, name: 'History', exact: true })).toBeVisible()
  await expectFitsPhone(page)
})
