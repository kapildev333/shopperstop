import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { queryClient } from './api'
import { keys } from './catalog'
import { setPincode } from './pincode'
import { renderAt, store } from './test-data'

const key = 'shopperstop:pincode'

test('first visit opens the pincode sheet', async () => {
  renderAt('/')
  const dialog = await screen.findByRole('dialog', { name: 'Your delivery pincode' })
  expect(within(dialog).getByLabelText('Pincode')).toHaveValue('')
})

test('invalid pincode refused', async () => {
  renderAt('/')
  const user = userEvent.setup()
  const dialog = await screen.findByRole('dialog', { name: 'Your delivery pincode' })
  await user.type(within(dialog).getByLabelText('Pincode'), '5600')
  await user.click(within(dialog).getByRole('button', { name: 'Save pincode' }))
  expect(within(dialog).getByText('Enter a 6-digit pincode')).toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Your delivery pincode' })).toBeInTheDocument()
  expect(localStorage.getItem(key)).toBeNull()
})

test('pincode saved from the sheet', async () => {
  queryClient.setQueryData(keys.serviceability('560034'), store())
  renderAt('/')
  const user = userEvent.setup()
  const dialog = await screen.findByRole('dialog', { name: 'Your delivery pincode' })
  await user.type(within(dialog).getByLabelText('Pincode'), '560034')
  await user.click(within(dialog).getByRole('button', { name: 'Save pincode' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(localStorage.getItem(key)).toBe('560034')
})

test('banner control opens the sheet', async () => {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store())
  renderAt('/')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Delivery in 10 minutes 560034' }))
  const dialog = await screen.findByRole('dialog', { name: 'Your delivery pincode' })
  expect(within(dialog).getByLabelText('Pincode')).toHaveValue('560034')
})

test('banner shows the delivery promise', async () => {
  setPincode('560034')
  queryClient.setQueryData(keys.serviceability('560034'), store({ promisedMinutes: 10 }))
  renderAt('/')
  const banner = await screen.findByRole('banner')
  expect(within(banner).getByRole('button', { name: 'Delivery in 10 minutes 560034' })).toBeInTheDocument()
})
