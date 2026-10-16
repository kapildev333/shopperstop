import { expect, test } from '@playwright/test'
import { mailedCode } from './mail'
import { expectNoViolations, freshShopper, signedIn, tokenKey } from './shopper'

// Stored pincode so the first-visit pincode sheet does not cover Home.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034')))

test('email verified against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Verifier')
  await signedIn(page, shopper)
  await page.goto('/account')
  await expect(page.getByText('Verify your email to pay online')).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Send verification email' }).click()
  await expect(page.getByText('Verification email sent')).toBeVisible()

  const code = await mailedCode(shopper.email, 'Verify your ShopperStop email')
  await page.goto(`/verify-email?token=${code}`)
  await expect(page.getByText('Your email is verified')).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('link', { name: 'Continue' }).click()
  await expect(page).toHaveURL('/account')
  await expect(page.getByText('Verify your email to pay online')).toHaveCount(0)
})

test('password reset against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Forgetful')
  await page.goto('/sign-in')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL('/forgot-password')
  await expectNoViolations(page)
  await page.getByLabel('Email').fill(shopper.email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByText('If that email has an account, a reset link is on its way')).toBeVisible()

  const code = await mailedCode(shopper.email, 'Reset your ShopperStop password')
  await page.goto(`/reset-password?token=${code}`)
  await expectNoViolations(page)
  await page.getByLabel('New password').fill('newpass123')
  await page.getByLabel('Confirm password').fill('newpass123')
  await page.getByRole('button', { name: 'Set password' }).click()
  await expect(page.getByText('Your password is changed')).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('main').getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/sign-in')
  await page.getByLabel('Email').fill(shopper.email)
  await page.getByLabel('Password').fill('newpass123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
  expect(await page.evaluate((key) => localStorage.getItem(key), tokenKey)).not.toBeNull()

  const old = await request.post('/api/core/v1/auth/sign-in', { data: { email: shopper.email, password: shopper.password } })
  expect(old.status()).toBe(401)
})
