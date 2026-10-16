import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import Account from './app/account'
import { queryClient } from './api'
import { CheckoutScreen } from './checkout-screen'
import { apiError, fakeCore, json } from './fake-core'
import { setToken } from './session'

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: 'Inter_400Regular',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
}))

const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.com', name: 'Asha Rao' }

const CARD_TEXT = 'Verify your email to pay online'
const SEND = 'Send verification email'

// The screens render under no router: each test owns one render, with the query client as the root layout provides it.
function renderAccount() {
  return render(
    <QueryClientProvider client={queryClient}>
      <Account />
    </QueryClientProvider>,
  )
}

function renderCheckout() {
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutScreen />
    </QueryClientProvider>,
  )
}

test('unverified customer sees the card', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me': () => json(200, { ...customer, emailVerified: false }),
    'GET /me/addresses': () => json(200, { items: [] }),
  })
  const account = await renderAccount()

  expect(await screen.findByText(CARD_TEXT)).toBeTruthy()
  expect(screen.getByRole('button', { name: SEND })).toBeTruthy()
  await account.unmount()

  // Checkout with no cart answer (fakeCore's 404): the card still shows under the header.
  fakeCore({
    'GET /me': () => json(200, { ...customer, emailVerified: false }),
    'GET /me/addresses': () => json(200, { items: [] }),
  })
  await renderCheckout()

  expect(await screen.findByText(CARD_TEXT)).toBeTruthy()
  expect(screen.getByRole('button', { name: SEND })).toBeTruthy()
})

test('verified customer sees no card', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me': () => json(200, { ...customer, emailVerified: true }),
    'GET /me/addresses': () => json(200, { items: [] }),
  })
  await renderAccount()

  expect(await screen.findByText('Asha Rao')).toBeTruthy()
  expect(screen.queryByText(CARD_TEXT)).toBeNull()
  expect(screen.queryByRole('button', { name: SEND })).toBeNull()
})

test('verification email sent', async () => {
  setToken('t-1')
  const calls = fakeCore({
    'GET /me': () => json(200, { ...customer, emailVerified: false }),
    'GET /me/addresses': () => json(200, { items: [] }),
    'POST /me/email-verification': () => json(202),
  })
  await renderAccount()

  await fireEvent.press(await screen.findByRole('button', { name: SEND }))

  expect(await screen.findByText('Verification email sent')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Enter the code' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: SEND })).toBeNull()
  const sends = calls.filter((request) => request.method === 'POST' && new URL(request.url).pathname.endsWith('/api/core/v1/me/email-verification'))
  expect(sends).toHaveLength(1)
})

test('already verified when sending', async () => {
  setToken('t-1')
  let verified = false
  const calls = fakeCore({
    'GET /me': () => json(200, { ...customer, emailVerified: verified }),
    'GET /me/addresses': () => json(200, { items: [] }),
    'POST /me/email-verification': () => {
      verified = true
      return apiError(409, 'conflict', 'email already verified')
    },
  })
  await renderAccount()

  await fireEvent.press(await screen.findByRole('button', { name: SEND }))

  await waitFor(() => expect(screen.queryByText(CARD_TEXT)).toBeNull())
  expect(calls.filter((request) => request.method === 'GET' && new URL(request.url).pathname.endsWith('/me')).length).toBeGreaterThanOrEqual(2)
})

test('sending fails', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me': () => json(200, { ...customer, emailVerified: false }),
    'GET /me/addresses': () => json(200, { items: [] }),
    'POST /me/email-verification': () => {
      throw new TypeError('Network request failed')
    },
  })
  await renderAccount()

  await fireEvent.press(await screen.findByRole('button', { name: SEND }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach ShopperStop. Try again.')
  expect(screen.getByRole('button', { name: SEND })).toHaveProp('accessibilityState', { disabled: false, busy: false })
})
