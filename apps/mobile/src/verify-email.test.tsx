import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Stack } from 'expo-router'
import { queryClient } from './api'
import { apiError, fakeCore, json } from './fake-core'
import VerifyEmail from './app/verify-email'
import { setToken } from './session'

function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack />
    </QueryClientProvider>
  )
}

const routes = { _layout: Layout, 'verify-email': VerifyEmail }

test('empty code checked', async () => {
  const calls = fakeCore({})
  await renderRouter(routes, { initialUrl: '/verify-email' })
  await screen.findByRole('heading', { name: 'Verify email' })

  await fireEvent.press(screen.getByRole('button', { name: 'Verify email' }))

  expect(await screen.findByText('Enter the code from the email')).toBeTruthy()
  expect(calls).toHaveLength(0)
})

test('email verified from the link', async () => {
  const calls = fakeCore({ 'POST /auth/verify-email': () => json(204) })
  await renderRouter(routes, { initialUrl: '/verify-email?token=c-1' })

  expect(await screen.findByText('Your email is verified')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
  expect(calls).toHaveLength(1)
  expect(await calls[0].clone().json()).toEqual({ token: 'c-1' })
})

test('email verified with a typed code', async () => {
  const calls = fakeCore({ 'POST /auth/verify-email': () => json(204) })
  await renderRouter(routes, { initialUrl: '/verify-email' })
  await screen.findByRole('heading', { name: 'Verify email' })

  await fireEvent.changeText(screen.getByLabelText('Code from the email'), ' c-2 ')
  await fireEvent.press(screen.getByRole('button', { name: 'Verify email' }))

  expect(await screen.findByText('Your email is verified')).toBeTruthy()
  expect(calls).toHaveLength(1)
  expect(await calls[0].clone().json()).toEqual({ token: 'c-2' })
})

test('expired code while signed in', async () => {
  setToken('t-1')
  fakeCore({
    'GET /me': () => json(200, { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.com', name: 'Asha Rao', emailVerified: false }),
    'GET /me/addresses': () => json(200, { items: [] }),
    'POST /auth/verify-email': () => apiError(400, 'validation', 'invalid or expired token', 'token'),
  })
  await renderRouter(routes, { initialUrl: '/verify-email?token=old' })

  expect(await screen.findByText('This code is invalid or has expired.')).toBeTruthy()
  expect(screen.getByLabelText('Code from the email')).toBeTruthy()
  expect(await screen.findByRole('button', { name: 'Send verification email' })).toBeTruthy()
})

test('expired code while signed out', async () => {
  fakeCore({ 'POST /auth/verify-email': () => apiError(400, 'validation', 'invalid or expired token', 'token') })
  await renderRouter(routes, { initialUrl: '/verify-email?token=old' })

  expect(await screen.findByText('This code is invalid or has expired.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Sign in to get a new code' })).toHaveProp('href', '/sign-in?returnTo=%2Faccount')
})

test('verification unreachable then retried', async () => {
  let attempts = 0
  const calls = fakeCore({
    'POST /auth/verify-email': () => {
      attempts += 1
      if (attempts === 1) throw new TypeError('Network request failed')
      return json(204)
    },
  })
  await renderRouter(routes, { initialUrl: '/verify-email?token=c-1' })

  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByText('Could not reach ShopperStop. Try again.')).toBeTruthy()

  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('Your email is verified')).toBeTruthy()
  expect(calls).toHaveLength(2)
})
