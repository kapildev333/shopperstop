import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { ApiError } from './api'
import { RegisterForm, SignInForm } from './auth-forms'

test('required fields checked', async () => {
  const submit = vi.fn()
  render(<SignInForm submit={submit} />)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByText('Enter your email')).toBeInTheDocument()
  expect(screen.getByText('Enter your password')).toBeInTheDocument()
  expect(submit).not.toHaveBeenCalled()
})

test('short password on register', async () => {
  const submit = vi.fn()
  render(<RegisterForm submit={submit} />)
  await userEvent.type(screen.getByLabelText('Name'), 'E2E Shopper')
  await userEvent.type(screen.getByLabelText('Email'), 'shopper@example.com')
  await userEvent.type(screen.getByLabelText('Password'), '1234567')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(await screen.findByText('Use 8 to 72 characters')).toBeInTheDocument()
  expect(submit).not.toHaveBeenCalled()
})

test('field error from the envelope', async () => {
  const error: ApiError = { code: 'conflict', message: 'Email already registered', field: 'email' }
  const submit = vi.fn().mockResolvedValue(error)
  render(<RegisterForm submit={submit} />)
  await userEvent.type(screen.getByLabelText('Name'), 'E2E Shopper')
  await userEvent.type(screen.getByLabelText('Email'), 'shopper@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  expect(submit).toHaveBeenCalledWith({ name: 'E2E Shopper', email: 'shopper@example.com', password: 'password123' })
})

test('non-field error in a banner', async () => {
  const error: ApiError = { code: 'unauthorized', message: 'Wrong email or password' }
  const submit = vi.fn().mockResolvedValue(error)
  render(<SignInForm submit={submit} />)
  await userEvent.type(screen.getByLabelText('Email'), 'shopper@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password')
})
