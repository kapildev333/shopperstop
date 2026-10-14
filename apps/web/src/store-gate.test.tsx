import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { keys } from './catalog'
import { setPincode } from './pincode'
import { renderAt, store } from './test-data'

test('not serviceable notice', async () => {
  setPincode('110001')
  queryClient.setQueryData(keys.serviceability('110001'), null)
  renderAt('/')
  expect(await screen.findByRole('heading', { level: 2, name: 'We do not deliver to 110001 yet' })).toBeInTheDocument()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Change pincode' }))
  expect(await screen.findByRole('dialog', { name: 'Your delivery pincode' })).toBeInTheDocument()
})

test('closed store notice', async () => {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store({ name: 'Koramangala', isOpen: false }))
  renderAt('/')
  expect(await screen.findByRole('heading', { level: 2, name: 'Koramangala is closed right now' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Change pincode' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Picked for you' })).not.toBeInTheDocument()
})

test('store lookup fails', async () => {
  // No cached answer: core cannot be reached under jsdom, so the lookup fails.
  setPincode('560034')
  renderAt('/')
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not check your pincode.')
  expect(alert).toContainElement(screen.getByRole('button', { name: 'Try again' }))
})
