import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { mailedCode } from './mail'

// Verify and reset on the web export at 390×844, against core on 18080 (helpers copied from checkout.spec.ts).
// The mail's code is read from core's log (mail.ts); a direct load of /verify-email?token= is the static export's check of the link.
const core = 'http://localhost:18080/api/core/v1'
const tokenKey = 'shopperstop.customer-token'
const pincodeKey = 'shopperstop:pincode'

type Shopper = { token: string; headers: { Authorization: string }; email: string; password: string }

function freshEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

// The top screen: Expo Router keeps the screens below it mounted, so the sign-in beneath a forgot-password screen has the same fields.
const top = (page: Page) => page.getByRole('main').last()

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

async function freshShopper(request: APIRequestContext, name: string): Promise<Shopper> {
  const email = freshEmail()
  const password = 'password123'
  const registered = await request.post(`${core}/auth/register`, { data: { name, email, password } })
  expect(registered.status()).toBe(201)
  const { token } = (await registered.json()) as { token: string }
  return { token, headers: { Authorization: `Bearer ${token}` }, email, password }
}

// Signs the browser in before any page script runs, with the pincode preset so the first-visit sheet does not cover the screen.
async function signedIn(page: Page, shopper: Shopper) {
  await page.addInitScript(
    ([key, token, pincodeStorage]) => {
      localStorage.setItem(key, token)
      localStorage.setItem(pincodeStorage, '560034')
    },
    [tokenKey, shopper.token, pincodeKey],
  )
}

test('email verified against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Verifier')
  await signedIn(page, shopper)
  await page.goto('/account')
  await expect(page.getByText('Verify your email to pay online')).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Send verification email', exact: true }).click()
  await expect(page.getByText('Verification email sent', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  const code = await mailedCode(shopper.email, 'Verify your ShopperStop email')
  await page.goto(`/verify-email?token=${code}`)
  await expect(page.getByText('Your email is verified', { exact: true })).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible()
  await expect(page.getByText('Verify your email to pay online', { exact: true })).toHaveCount(0)
})

test('password reset against core', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Forgetful')
  await page.goto('/sign-in')
  await page.getByRole('link', { name: 'Forgot password?', exact: true }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  await expectNoViolations(page)
  await top(page).getByLabel('Email', { exact: true }).fill(shopper.email)
  await top(page).getByRole('button', { name: 'Send reset code', exact: true }).click()
  await expect(page.getByText('If that email has an account, a reset code is on its way', { exact: true })).toBeVisible()
  await expectNoViolations(page)

  const code = await mailedCode(shopper.email, 'Reset your ShopperStop password')
  await top(page).getByRole('button', { name: 'Enter the code', exact: true }).click()
  await expect(page).toHaveURL(/\/reset-password$/)
  await expectNoViolations(page)
  await top(page).getByLabel('Code from the email', { exact: true }).fill(code)
  await top(page).getByLabel('New password', { exact: true }).fill('newpass123')
  await top(page).getByLabel('Confirm password', { exact: true }).fill('newpass123')
  await top(page).getByRole('button', { name: 'Set password', exact: true }).click()
  await expect(page.getByText('Your password is changed. Sign in with your new password.', { exact: true })).toBeVisible()
  await expectNoViolations(page)
  await top(page).getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await top(page).getByLabel('Email', { exact: true }).fill(shopper.email)
  await top(page).getByLabel('Password', { exact: true }).fill('newpass123')
  await top(page).getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(await page.evaluate((key) => localStorage.getItem(key), tokenKey)).not.toBeNull()

  const old = await request.post(`${core}/auth/sign-in`, { data: { email: shopper.email, password: shopper.password } })
  expect(old.status()).toBe(401)
})
