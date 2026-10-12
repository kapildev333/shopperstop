import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Demo staff account from core's seed (the e2e database is reset before every run).
const adminEmail = 'admin@shopperstop.local'
const adminPassword = 'admin12345'
const sections = ['Dashboard', 'Orders', 'Stock', 'Stores', 'Categories', 'Products', 'Staff']

test('admin signs in, reloads and signs out', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveURL(/\/admin\/sign-in\?redirect=%2F$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 246, 248)')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.goto('./stock')
  await expect(page).toHaveURL(/sign-in\?redirect=%2Fstock$/)

  await page.getByLabel('Email').fill(adminEmail)
  await page.getByLabel('Password').fill(adminPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/stock$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Stock' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Admin' })
  await nav.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin/')
  await expect(nav.getByRole('link')).toHaveText(sections)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await expect(nav.getByRole('link')).toHaveText(sections)

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('shopperstop:staff-token'))).toBeNull()
  await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('wrong password shows the error', async ({ page }) => {
  await page.goto('./sign-in')
  // A different email keeps the admin account under core's sign-in limit.
  await page.getByLabel('Email').fill('nobody@shopperstop.local')
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Email or password is wrong, or the account is inactive.')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
