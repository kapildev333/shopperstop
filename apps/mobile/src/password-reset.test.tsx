import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Stack } from 'expo-router'
import { queryClient } from './api'
import { apiError, fakeCore, json } from './fake-core'
import ForgotPassword from './app/forgot-password'
import ResetPassword from './app/reset-password'
import { getToken, setToken } from './session'

function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack />
    </QueryClientProvider>
  )
}

const routes = { _layout: Layout, 'forgot-password': ForgotPassword, 'reset-password': ResetPassword }

test('empty email checked', async () => {
  const calls = fakeCore({})
  await renderRouter(routes, { initialUrl: '/forgot-password' })
  await screen.findByRole('heading', { name: 'Forgot password' })

  await fireEvent.press(screen.getByRole('button', { name: 'Send reset code' }))

  expect(await screen.findByText('Enter your email')).toBeTruthy()
  expect(calls).toHaveLength(0)
})

test('reset code requested', async () => {
  const calls = fakeCore({ 'POST /auth/password-reset': () => json(202) })
  await renderRouter(routes, { initialUrl: '/forgot-password' })
  await screen.findByRole('heading', { name: 'Forgot password' })

  await fireEvent.changeText(screen.getByLabelText('Email'), ' asha@example.com ')
  await fireEvent.press(screen.getByRole('button', { name: 'Send reset code' }))

  expect(await screen.findByText('If that email has an account, a reset code is on its way')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Enter the code' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Send reset code' })).toBeNull()
  expect(calls).toHaveLength(1)
  expect(await calls[0].clone().json()).toEqual({ email: 'asha@example.com' })
})

test('malformed email from core', async () => {
  fakeCore({ 'POST /auth/password-reset': () => apiError(400, 'validation', 'must be a valid email address', 'email') })
  await renderRouter(routes, { initialUrl: '/forgot-password' })
  await screen.findByRole('heading', { name: 'Forgot password' })

  await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@')
  await fireEvent.press(screen.getByRole('button', { name: 'Send reset code' }))

  expect(await screen.findByText('must be a valid email address')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('too many reset requests', async () => {
  fakeCore({ 'POST /auth/password-reset': () => apiError(429, 'rate_limited', 'too many attempts, try again later') })
  await renderRouter(routes, { initialUrl: '/forgot-password' })
  await screen.findByRole('heading', { name: 'Forgot password' })

  await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com')
  await fireEvent.press(screen.getByRole('button', { name: 'Send reset code' }))

  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByText('too many attempts, try again later')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Send reset code' })).toBeTruthy()
})

test('code from the link', async () => {
  await renderRouter(routes, { initialUrl: '/reset-password?token=r-1' })

  expect(await screen.findByLabelText('Code from the email')).toHaveProp('value', 'r-1')
})

test('reset form checks fields', async () => {
  const calls = fakeCore({})
  await renderRouter(routes, { initialUrl: '/reset-password' })
  await screen.findByRole('heading', { name: 'Reset password' })

  await fireEvent.press(screen.getByRole('button', { name: 'Set password' }))
  expect(await screen.findByText('Enter the code from the email')).toBeTruthy()
  expect(screen.getByText('Enter a new password')).toBeTruthy()

  await fireEvent.changeText(screen.getByLabelText('Code from the email'), 'r-1')
  await fireEvent.changeText(screen.getByLabelText('New password'), 'short1')
  await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'short1')
  await fireEvent.press(screen.getByRole('button', { name: 'Set password' }))
  expect(await screen.findByText('Use 8 to 72 characters')).toBeTruthy()

  await fireEvent.changeText(screen.getByLabelText('New password'), 'newpass123')
  await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'newpass124')
  await fireEvent.press(screen.getByRole('button', { name: 'Set password' }))
  expect(await screen.findByText('Passwords do not match')).toBeTruthy()
  expect(calls).toHaveLength(0)
})

test('password reset', async () => {
  setToken('t-1')
  const calls = fakeCore({ 'POST /auth/password-reset/confirm': () => json(204) })
  await renderRouter(routes, { initialUrl: '/reset-password?token=r-1' })
  await screen.findByRole('heading', { name: 'Reset password' })

  await fireEvent.changeText(screen.getByLabelText('New password'), 'newpass123')
  await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'newpass123')
  await fireEvent.press(screen.getByRole('button', { name: 'Set password' }))

  expect(await screen.findByText('Your password is changed. Sign in with your new password.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
  expect(getToken()).toBeUndefined()
  expect(calls).toHaveLength(1)
  expect(await calls[0].clone().json()).toEqual({ token: 'r-1', password: 'newpass123' })
})

test('password refused by core', async () => {
  fakeCore({ 'POST /auth/password-reset/confirm': () => apiError(400, 'validation', 'must be 8 to 72 bytes', 'password') })
  await renderRouter(routes, { initialUrl: '/reset-password?token=r-1' })
  await screen.findByRole('heading', { name: 'Reset password' })

  await fireEvent.changeText(screen.getByLabelText('New password'), 'newpass123')
  await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'newpass123')
  await fireEvent.press(screen.getByRole('button', { name: 'Set password' }))

  expect(await screen.findByText('must be 8 to 72 bytes')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Set password' })).toBeTruthy()
})

test('expired reset code', async () => {
  fakeCore({ 'POST /auth/password-reset/confirm': () => apiError(400, 'validation', 'token is invalid or has expired', 'token') })
  await renderRouter(routes, { initialUrl: '/reset-password?token=r-1' })
  await screen.findByRole('heading', { name: 'Reset password' })

  await fireEvent.changeText(screen.getByLabelText('New password'), 'newpass123')
  await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'newpass123')
  await fireEvent.press(screen.getByRole('button', { name: 'Set password' }))

  expect(await screen.findByText('This code is invalid or has expired.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Request a new code' })).toHaveProp('href', '/forgot-password')
  expect(screen.getByRole('button', { name: 'Set password' })).toBeTruthy()
})
