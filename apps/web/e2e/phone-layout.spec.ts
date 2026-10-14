import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

// Stored pincode so the first-visit pincode sheet does not cover Home.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034')))

const koramangala = '00000000-0000-4000-8000-000000000401'
const tolerance = 0.5

type Box = { x: number; y: number; width: number; height: number }
type Listed = { name: string; slug: string; inStock: boolean; quantity: number; priceCents: number; mrpCents: number }

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

async function koramangalaProducts(request: APIRequestContext): Promise<Listed[]> {
  const listed = await request.get(`/api/core/v1/stores/${koramangala}/products?pageSize=100`)
  expect(listed.status()).toBe(200)
  return ((await listed.json()) as { items: Listed[] }).items
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no box (hidden or detached)')
  return box
}

// The first in-stock product whose MRP is above its price, picked from core.
async function struckPick(request: APIRequestContext): Promise<Listed> {
  const found = (await koramangalaProducts(request)).find(
    (item) => item.inStock && item.quantity >= 1 && item.mrpCents > item.priceCents,
  )
  expect(found).toBeDefined()
  if (!found) throw new Error('no in-stock product with an MRP above its price')
  return found
}

// The card is the list item that holds the product's link; that link's box is the card's content area.
function cardOf(page: Page, slug: string) {
  return page.locator('li').filter({ has: page.locator(`a[href="/p/${slug}"]`) })
}

async function openSearch(page: Page, product: Listed): Promise<Locator> {
  await page.goto(`/search?q=${encodeURIComponent(product.name)}`)
  await expect(page.locator(`a[href="/p/${product.slug}"]`)).toBeVisible()
  return cardOf(page, product.slug)
}

// Every button of the card, the struck MRP, the price and the extra parts lie inside the content area
// horizontally and inside the card vertically (tolerance 0.5 px).
async function expectInsideContent(card: Locator, slug: string, extra: Locator[] = []) {
  const content = await boxOf(card.locator(`a[href="/p/${slug}"]`))
  const item = await boxOf(card)
  const area: Box = { x: content.x, width: content.width, y: item.y, height: item.height }
  const parts = [
    ...(await card.locator('button').all()),
    card.locator('s'),
    ...(await card.getByText(/₹/).all()),
    ...extra,
  ]
  for (const [index, part] of parts.entries()) {
    const box = await boxOf(part)
    const overflow = Math.max(
      area.x - box.x,
      box.x + box.width - (area.x + area.width),
      area.y - box.y,
      box.y + box.height - (area.y + area.height),
    )
    expect(overflow, `part ${index} of the card for ${slug} sticks out by ${overflow} px`).toBeLessThanOrEqual(tolerance)
  }
}

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('card controls stay inside the card on a phone', async ({ page, request }) => {
    const product = await struckPick(request)
    const card = await openSearch(page, product)
    const add = card.getByRole('button', { name: `Add ${product.name}`, exact: true })
    await expect(add).toBeVisible()
    await expectInsideContent(card, product.slug)
    await expectNoViolations(page)

    await add.click()
    const group = card.getByRole('group', { name: `Quantity of ${product.name}`, exact: true })
    await expect(group).toBeVisible()
    await expectInsideContent(card, product.slug, [group])
    await expectNoViolations(page)
  })

  test('out-of-stock card on a phone', async ({ page, request }) => {
    const found = (await koramangalaProducts(request)).find((item) => !item.inStock)
    expect(found).toBeDefined()
    if (!found) throw new Error('no out-of-stock product at Koramangala')
    const card = await openSearch(page, found)
    await expect(card.getByRole('button', { name: 'Out of stock', exact: true })).toBeDisabled()
    await expectInsideContent(card, found.slug)
    await expectNoViolations(page)
  })

  test('wordmark tap target on a phone', async ({ page }) => {
    await page.goto('/')
    const banner = page.getByRole('banner')
    const wordmark = banner.getByRole('link', { name: 'ShopperStop', exact: true })
    await expect(wordmark).toBeVisible()
    const box = await boxOf(wordmark)
    expect(box.height, 'wordmark height').toBeGreaterThanOrEqual(44)

    const others = banner.locator('a, button, input').filter({ hasNotText: 'ShopperStop' })
    for (const [index, other] of (await others.all()).entries()) {
      if (!(await other.isVisible())) continue
      const target = await boxOf(other)
      const overlapX = Math.min(box.x + box.width, target.x + target.width) - Math.max(box.x, target.x)
      const overlapY = Math.min(box.y + box.height, target.y + target.height) - Math.max(box.y, target.y)
      expect(overlapX > tolerance && overlapY > tolerance, `banner control ${index} overlaps the wordmark`).toBe(false)
    }
    await expectNoViolations(page)
  })
})

test.describe('six columns', () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test('card controls stay inside the card in the six-column grid', async ({ page, request }) => {
    const product = await struckPick(request)
    const card = await openSearch(page, product)
    await expect(card.getByRole('button', { name: `Add ${product.name}`, exact: true })).toBeVisible()
    await expectInsideContent(card, product.slug)
    await expectNoViolations(page)
  })
})
